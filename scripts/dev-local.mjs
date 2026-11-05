// Runs the API locally for the full-stack walkthrough (docs/reading-engine/49 test plan): every new board flag on, and
// Cloudflare's always-pass Turnstile test secret so sign-up and sign-in work without a real challenge. Never deployed.
import { spawn } from 'node:child_process';
const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: process.env.PORT ?? '3000',
  LUCKY_ENABLED: '1',
  AREA_ENABLED: '1',
  TIMELINE_ENABLED: '1',
  // the question quota in the header (free plan) needs plans on, as on staging
  PLANS_ENABLED: process.env.PLANS_ENABLED ?? '1',
  PLAN_FREE_QUESTIONS: process.env.PLAN_FREE_QUESTIONS ?? '20',
  PLAN_PLUS_QUESTIONS: process.env.PLAN_PLUS_QUESTIONS ?? '200',
  // https://developers.cloudflare.com/turnstile/troubleshooting/testing/ : always passes
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
};
const child = spawn('npx', ['tsx', 'server.ts'], { env, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
