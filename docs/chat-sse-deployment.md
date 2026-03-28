# Chat SSE streaming (`POST /api/chat/ask-stream`)

## `chat_logs.client_delivery_sse`

The server sets this boolean when persisting a turn:

- **`true`** — Answer was produced for the **SSE** route `POST /api/chat/ask-stream`.
- **`false`** — Answer came from GraphQL **`ask`** (single JSON response).

That matches the web app when **`VITE_CHAT_STREAM`** is enabled (default): the SPA uses the SSE endpoint; if streaming is disabled (`VITE_CHAT_STREAM=0`), it falls back to GraphQL and logs get `false`. The value is **not** read from the client (avoids spoofing).

---

## Render.com

Render’s **Web Services** proxy HTTP to your Node process; **chunked streaming usually works** for long-lived responses. If tokens arrive in large bursts:

1. **Call the API origin directly** (your `*.onrender.com` URL or API custom domain) — avoid putting a **buffering CDN** (or Cloudflare “orange cloud”) in front of the streaming path without tuning.
2. **Keep** `CHAT_SSE_PING_MS` set (e.g. `15000`) so the connection sends periodic SSE comments; the app also sets **`X-Accel-Buffering: no`** and **`Cache-Control: no-cache`** on the stream.
3. If you use **Cloudflare** in front of Render: test with DNS-only (grey cloud) on the API hostname, or review their docs on **SSE / streaming** and buffer settings for your plan.

Render does not expose nginx to you on the standard Web Service; you only add a **custom reverse proxy** if you run your own VM or container with nginx in front of Render (unusual).

---

## nginx in front of Node (self-hosted or custom proxy)

Use a dedicated `location` for the streaming path and **disable response buffering** so chunks reach the browser immediately:

```nginx
location /api/chat/ask-stream {
  proxy_pass http://127.0.0.1:4000;  # your Node listen address
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
  chunked_transfer_encoding on;
}
```

The Node handler already sends **`X-Accel-Buffering: no`** for nginx. Reload nginx after changes (`nginx -t && nginx -s reload`).
