# Skills — AI Astra Server (Grok bots)

Lessons to reuse across projects. Add dated bullets when something bites twice.

## Edge / auth
- CloudFront OAC → IAM Function URL: browser POSTs need `x-amz-content-sha256` = SHA256(body); without it → 403.
- JWT must not use `Authorization` (conflicts with SigV4). Use `X-Astra-Authorization` (and accept `Authorization` fallback only for dual-run).
- CloudFront origin request policy must **forward** custom auth headers or JWT never reaches Lambda.
- RESPONSE_STREAM Lambda **OPTIONS** must return real CORS (`Access-Control-*`). Empty 204/octet-stream breaks Amplify login preflight.

## Config / env
- `NODE_ENV` must be lowercase `staging` or `production`. Uppercase `STAGING` is invalid → falls back to **development** → CORS reflects any Origin.
- Separate Secrets Manager secrets: `aiastra/chat-llm` (server CHAT/GEMINI/GROQ) vs `aiastra/web-env` (Vite). Web dump Render URLs are stale — do not flip Amplify off CF.
- Wire Lambda env from SM refs; never paste keys in chat.

## Chat / LLM
- Latency dominated by fat Kundli prompt + generation, not CF/auth.
- `GEMINI_MAX_OUTPUT_TOKENS=50000` caused ~205s `MAX_TOKENS` + repetition collapse. Prefer ~8192 + stream n-gram loop guard.
- Gemini free-tier `cachedContents` storage limit can be **0** for `gemini-2.5-flash` — cache needs paid quota before enable; keep `GEMINI_CACHE_ENABLED=0` until then.
- Opaque `publicChatError` maps capacity/provider errors to the same soft UI string — dig CloudWatch before assuming timeouts.

## Infra
- Production API: Amplify → CF → `aiastra-server-api` Lambda only (App Runner retired).
- Render Postgres pooler: same host, port **6432**, `sslmode=require&pgbouncer=true`; Lambda `connection_limit=1`; `DIRECT_URL` stays `:5432`.
- Calc `aiastra-pyjhora` stays private IAM-invoke; not on chat critical path.

- `gemini-2.5-flash` defaults to **thinking**; if `GEMINI_THINKING_BUDGET=0` is only in Lambda/SM env and not in `generationConfig.thinkingConfig`, visible answers hit `MAX_TOKENS` early (short mid-sentence cuts at modest maxOut). Always send `thinkingConfig` in the request body.
- Stream n-gram loop guard stops repetition collapse; still log `stoppedForLoop` + `finishReason` together.

- After thinking off, long table-heavy outlook answers can still hit `MAX_TOKENS` at 8192. Prefer ~16000 with loop guard rather than 50000.
