import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { spawn } from 'node:child_process';

async function loadSecret(arnOrName, envKey) {
  if (process.env[envKey]) return;
  if (!arnOrName) return;
  const client = new SecretsManagerClient({});
  const out = await client.send(new GetSecretValueCommand({ SecretId: arnOrName }));
  if (!out.SecretString) throw new Error(`Secret ${arnOrName} empty`);
  process.env[envKey] = out.SecretString;
}

const dbSecret = process.env.AIASTRA_DATABASE_SECRET_ARN || process.env.AIASTRA_DATABASE_SECRET_NAME || 'aiastra/database-url';
const jwtSecret = process.env.AIASTRA_JWT_SECRET_ARN || process.env.AIASTRA_JWT_SECRET_NAME || 'aiastra/jwt-secret';

await loadSecret(dbSecret, 'DATABASE_URL');
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}
await loadSecret(jwtSecret, 'JWT_SECRET');

const child = spawn('node', ['dist/server.js'], { stdio: 'inherit', env: process.env });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
