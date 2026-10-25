# API Lambda packaging and deployment (`aiastra-server-api`)

**Added 2026-10-24.** Until now the repo only had a plain Express `Dockerfile`; the image running on the live Lambda (tag `thinking-off-20260916022820`) was built outside the repo. This document and `Dockerfile.lambda` put the packaging in source control. The infrastructure side lives in `aiastra-aws-terraform/modules/lambda_server_api`.

## How the image works

```
Lambda invoke (Function URL, RESPONSE_STREAM)
  -> Lambda Web Adapter extension (/opt/extensions/lambda-adapter, v1.1.0)
     -> HTTP to localhost:3000
        -> node docker-entrypoint.mjs  (fills DATABASE_URL / JWT_SECRET from Secrets Manager only if unset)
           -> node dist/server.js     (Express + GraphQL Yoga + SSE /api/chat/ask-stream)
```

- `AWS_LWA_INVOKE_MODE=response_stream` lets SSE chat stream through the Function URL. The Function URL itself must have `InvokeMode=RESPONSE_STREAM`; both settings are needed.
- `AWS_LWA_READINESS_CHECK_PATH=/health` waits for the server to listen, which happens after the startup DB check.
- `AWS_LWA_ASYNC_INIT=true` lets a slow cold start (Prisma connect to Render Postgres) continue into the first invoke instead of failing the 10 s init phase.
- The root filesystem is read-only on Lambda. The queue logger writes to `/tmp/kundli-queue.log` and to stdout (CloudWatch) in this image.
- `Dockerfile` (plain container, for local or non-Lambda hosts) is unchanged except that both images share the hardened `docker-entrypoint.mjs`.

## Build locally

```bash
docker build --platform linux/amd64 --provenance=false -f Dockerfile.lambda -t aiastra-server-api:local .
```

Smoke test the container without Lambda (the adapter is inert outside Lambda):

```bash
docker run --rm -p 3000:3000 --env-file .env aiastra-server-api:local
```

```bash
curl -s http://localhost:3000/health
```

## Deploy

GitHub Actions workflow **Deploy API Lambda (OIDC)** (`.github/workflows/deploy-api-lambda.yml`) is manual only (`workflow_dispatch`). It:

1. Assumes `arn:aws:iam::442728149528:role/aiastra-github-deploy` via OIDC and checks the account.
2. Builds `Dockerfile.lambda` for `linux/amd64` without provenance attestations.
3. Pushes `aiastra-server-api:<prefix>-<sha12>` to ECR.
4. Optionally runs `aws lambda update-function-code` and waits for the update.

It does **not** touch function env, memory, timeout, Function URL, CloudFront or IAM. Those are owned by Terraform.

Prerequisite to confirm before the first run: the `aiastra-github-deploy` role trust policy must allow `repo:sachinm/AIAstraServer:*` (today it is known to trust the pyjhora repo), and its permissions must include `ecr:*` push actions on `aiastra-server-api` and `lambda:UpdateFunctionCode` / `lambda:GetFunction` on `aiastra-server-api`.

## Function contract (keys only, never values)

| Setting | Value |
|---|---|
| Package type | Image, `x86_64` (assumed; confirm on the live function) |
| Memory / timeout | 2048 MB / 300 s |
| Function URL | `AWS_IAM`, `RESPONSE_STREAM`, invoked only by CloudFront `E3UPJNUU8APCT` through OAC |
| Env keys | `NODE_ENV` (lowercase `staging`), `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `CHAT_LLM_PROVIDER`, `GEMINI_*`, `GROQ_API_KEY`, `ASTROKUNDLI_*` |
| Role | `aiastra-api-lambda-exec` (InvokeCalc, ReadSecrets, DenyPublicUrl, GeminiCacheDdb) |

## Not verified yet

The live function could not be read from this machine on 2026-10-24 because no `aiastra-ops` profile is configured here. Before the first deploy from this workflow, run these read-only checks with the AI Astra operator profile and compare with the table above. If the live image uses something other than the Lambda Web Adapter, align `Dockerfile.lambda` first.

```bash
aws lambda get-function-configuration --function-name aiastra-server-api --region us-east-1 --profile aiastra-ops --query '{PackageType:PackageType,Arch:Architectures,Image:ImageConfigResponse,Layers:Layers,Memory:MemorySize,Timeout:Timeout}'
```

```bash
aws lambda get-function-url-config --function-name aiastra-server-api --region us-east-1 --profile aiastra-ops --query '{Auth:AuthType,Mode:InvokeMode}'
```

```bash
aws lambda get-function --function-name aiastra-server-api --region us-east-1 --profile aiastra-ops --query 'Code.ImageUri'
```

Rollback: point the function back at the previous image URI with `aws lambda update-function-code --image-uri <previous>`; the current live tag is `thinking-off-20260916022820`.
