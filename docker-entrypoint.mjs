/**
 * Container entrypoint (Lambda image and plain container).
 *
 * Fills DATABASE_URL / DIRECT_URL / JWT_SECRET from AWS Secrets Manager only when they are not
 * already set in the environment, then starts the Express server. On the live Lambda these values
 * are set as function environment variables, so Secrets Manager is not called at all.
 *
 * The Secrets Manager SDK is imported lazily so a container that already has its env does not
 * depend on the SDK or on AWS credentials.
 */
import { spawn } from 'node:child_process';

let smClient;

async function getSecretsClient() {
  if (!smClient) {
    const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');
    smClient = new SecretsManagerClient({});
  }
  return smClient;
}

async function loadSecret(arnOrName, envKey) {
  if (process.env[envKey]) return;
  if (!arnOrName) return;
  const { GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
  const client = await getSecretsClient();
  const out = await client.send(new GetSecretValueCommand({ SecretId: arnOrName }));
  if (!out.SecretString) throw new Error(`Secret ${arnOrName} is empty`);
  process.env[envKey] = out.SecretString;
}

const dbSecret =
  process.env.AIASTRA_DATABASE_SECRET_ARN || process.env.AIASTRA_DATABASE_SECRET_NAME || 'aiastra/database-url';
const jwtSecret =
  process.env.AIASTRA_JWT_SECRET_ARN || process.env.AIASTRA_JWT_SECRET_NAME || 'aiastra/jwt-secret';

try {
  await loadSecret(dbSecret, 'DATABASE_URL');
  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  await loadSecret(jwtSecret, 'JWT_SECRET');
} catch (err) {
  // Never print secret values; the message only names the secret id.
  console.error(JSON.stringify({ msg: 'entrypoint secret load failed', error: err?.message ?? String(err) }));
  process.exit(1);
}

const child = spawn('node', ['dist/server.js'], { stdio: 'inherit', env: process.env });

// Forward termination so Lambda / container shutdown reaches the server process.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => child.kill(sig));
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
