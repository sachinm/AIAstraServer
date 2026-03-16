## Backend Improvement Plan — AdAstra

Internal roadmap for hardening and evolving the backend to support a high‑trust, high‑scale astrology assistant that feels like a long‑term guide rather than a one‑off chat.

---

## 1. Current Capabilities (Backend)

- **Core platform**
  - **GraphQL + REST**: Single GraphQL endpoint (Yoga) for all app concerns; REST `/query` for kundli RAG and a gated debug endpoint.
  - **Domain model**: `Auth`, `Kundli`, `SystemPrompt`, `UserGeneratedContent`, `Chat`, `Message` already support personalized insights, content, and persisted conversations.
- **Security**
  - **Auth**: JWT-based auth with 7‑day expiry, strong `JWT_SECRET` enforced at startup.
  - **Passwords**: Bcrypt hashing with salt rounds; no raw password storage.
  - **PII at rest**: AES‑256‑GCM encryption for DOB/TOB/POB with opt‑in via `ENCRYPTION_KEY`.
  - **RBAC**: Roles and resolvers wired through `rbac.ts` with `requireRoles`/`ALL_AUTHENTICATED_ROLES`.
  - **DB access**: Backend talks to Supabase Postgres via Prisma; RLS enabled on public tables with `auth` protected from anon/authenticated roles.
- **Astrology + AI**
  - **Kundli sync queue**: Background worker calling AstroKundli per user, writing biodata and multiple divisional charts plus vimsottari dasa.
  - **RAG**: Kundli chunks, fake embeddings + cosine similarity, and LLM‑based answers for personal questions.
  - **Generated content**: Separate LLM flows to create remedies, mantras, and routines and store them in `UserGeneratedContent`.
- **Observability**
  - **Queue logging**: Structured logs for kundli queue events and AstroKundli API responses.
  - **Startup health**: DB check and superadmin ensure step at boot.

---

## 2. Security Hardening

### 2.1 Token & Session Model

- **What’s there**
  - JWTs validated on every request; tokens stored client‑side, passed via `Authorization: Bearer`.
  - No refresh tokens; 7‑day lifetime is a good default but still long for browser localStorage.
- **Gaps / risks**
  - **LocalStorage token storage**: Vulnerable to XSS; no HTTPOnly/session cookies.
  - **Logout**: Frontend logout currently does not call `clearAuth()`; tokens can linger.
  - **Device/session management**: No concept of multiple devices, session revocation, or forced logout.
- **Recommendations (phased)**
  - **Phase 1 (near‑term)**
    - **Introduce HTTPOnly secure cookies** for access and optional refresh tokens:
      - Access token: short TTL (15–30 minutes).
      - Refresh token: 7–30 days, rotation on each use.
    - **Continue supporting Bearer JWT for now** for admin and UAT, but mark as deprecated and behind an env flag.
    - Ensure **logout clears all server‑side refresh tokens** and instructs clients to delete local state.
  - **Phase 2 (medium‑term)**
    - Add a **`Session` table** (user, device, IP, user agent, created_at, last_seen, revoked_at).
    - Support **“Sign out from all devices”** and show a list of active sessions to users.
    - Add **refresh token rotation + reuse detection** (invalidate the chain on suspicious activity).

### 2.2 Data Protection & Privacy

- **What’s there**
  - AES‑256‑GCM encryption for key PII fields; DOB/POB/TOB at rest can be strongly protected.
  - API design primarily exposes derived insights instead of raw kundli JSON to the frontend.
- **Gaps**
  - **Best‑effort encryption**: If `ENCRYPTION_KEY` is missing, PII falls back to plaintext; this is acceptable for local dev but dangerous in non‑dev environments.
  - No explicit separation between **“highly sensitive”** (birth details, contact, payment in future) and **“derived insights”** (remedies, mantras).
- **Recommendations**
  - **Enforce encryption in non‑dev**:
    - At startup: if `NODE_ENV !== 'development'` and `ENCRYPTION_KEY` is missing, **fail fast and refuse to start**.
  - **Classify and tag data**:
    - Mark which Prisma fields are **sensitive** (PII), **regulatory** (KYC, payment later), or **derived** (LLM outputs).
    - Ensure logs and debug routes never emit PII or sensitive fields.
  - **Redact logs**
    - Introduce a **logging utility** that redacts PII by default before writing queue or app logs.
    - Add structured error codes instead of leaking upstream error messages to clients.

### 2.3 API & RBAC Surface

- **What’s there**
  - Centralized context builder; clear `requireRoles` use.
  - Dev‑only `/debug/kundli/:user_id` route correctly disabled in production.
- **Gaps**
  - No explicit **rate limits** on GraphQL or `/query`.
  - Admin mutations are tied purely to JWT role with no **just‑in‑time re‑auth** for sensitive actions (e.g., future payout settings).
- **Recommendations**
  - **Rate limiting**
    - Add **per‑IP and per‑user rate limits** (fastify plugin equivalent for Express or middleware) for:
      - Login and signup.
      - Chat message mutations / `/query`.
      - Admin endpoints.
  - **Hard fences around admin**
    - Ensure **admin endpoints are strictly behind `admin`/`superadmin` roles** and log all usage for audit trails.
    - Later: add **“step‑up auth”** for risky actions (e.g., require password re‑entry or OTP).

---

## 3. Scalability & Reliability

### 3.1 Application Layer

- **Current**
  - Single Express instance hosting GraphQL Yoga and REST; Prisma with a shared pool.
  - Kundli queue worker runs in‑process on the same node.
- **Gaps**
  - **Tight coupling** of web and queue worker; scaling web traffic also scales background jobs unnecessarily.
  - No explicit **health probes** (liveness/readiness) for orchestration.
- **Improvements**
  - **Split workers from web**
    - Package the kundli queue as a **separate process** (same codebase, different entrypoint) so web can scale horizontally without duplicating cron behaviour.
    - Consider a **real queue** (e.g. Redis‑backed BullMQ) once volume grows, but current DB‑backed polling is fine for early stage.
  - **Add health endpoints**
    - `GET /health/live` (basic process alive) and `GET /health/ready` (DB + critical dependencies).
    - Use in container orchestration (Kubernetes, ECS) for safe rollouts.

### 3.2 Database & Query Design

- **Current**
  - Prisma schema already models chats/messages; kundli and generated content are per‑user and append‑only.
- **Gaps**
  - Untested performance at **high chat volume** (thousands of messages per user) and **heavy RAG workloads**.
  - No **archival** or TTL strategy for very old LLM outputs that users no longer need at full fidelity.
- **Improvements**
  - **Indexes and access patterns**
    - Ensure composite indexes on `(user_id, created_at desc)` for `Chat` and `Message` to support “inbox” and “conversation history”.
  - **Archival strategy**
    - Introduce a **cold storage / archived messages** table or blob store for conversations older than N months, while keeping recent threads highly queryable.

---

## 4. Conversation Model — “Picking Up Where You Left Off”

### 4.1 Current State

- **Backend**
  - `Chat` and `Message` tables, GraphQL queries `chats`, `activeChat`, `chatMessages`, and mutations `createChat`, `setChatInactive`, `addMessage`.
  - `/query` RAG route is per‑question and user‑scoped but stateless in terms of conversation.
- **Strengths**
  - Data model already supports **multiple threads per user** with active/inactive flags.

### 4.2 Gaps

- RAG currently **does not incorporate conversation history**; it only uses stored kundli chunks.
- No backend notion of **“episodes”** (e.g., a series of related questions under one theme).

### 4.3 Recommendations

- **Phase 1 (wire what exists)**
  - Ensure the frontend uses `createChat`, `addMessage`, `chatMessages` consistently:
    - Each question/answer pair should be persisted as a `Message` linked to a `Chat`.
  - Extend `runRagQuery` to optionally take:
    - **Chat context**: last N messages (questions + answers) and include them in the system/user prompt.
- **Phase 2 (semantic threads)**
  - Add an explicit **`topic` or `intent` field** on `Chat` inferred from the first message (e.g. “job prospects 2025”, “health in the next 6 months”).
  - Enable **cross‑chat recall**: when answering a new question, optionally look at previous chats with similar intents (cosine similarity over chat summaries) to enrich the answer.

---

## 5. Feature Roadmap for Astrology Use Cases

### 5.1 Everyday Queries (Short‑Horizon Guidance)

- **Target users**: teens and young professionals asking about:
  - “When is a good time to talk to my boss/partner?”
  - “Is today good for a first date / exam / investment?”
- **Backend requirements**
  - Expand **system prompts** for time‑bound questions (e.g. daily transit overlays) once AstroKundli or other ephemeris data is available.
  - Add a **“micro‑decision” API** that takes:
    - Context: upcoming event, time window, relationship type.
    - Kundli baseline + current planetary positions.
    - Returns: 1–3 recommended windows + confidence + suggested tone (how to phrase, how to approach).

### 5.2 Deeper Life Themes (Medium/Long‑Horizon Guidance)

- **Use cases**
  - Career transitions, health vigilance, marriage and family planning.
- **Backend roadmap**
  - Introduce specialized **system prompts** per theme (career, health, relationships, finances).
  - Model **“intent type”** on each chat and log which remedies/mantras/routines are suggested per intent for future analytics.

---

## 6. Gamification & Social Features (Backend Perspective)

### 6.1 Phase 0–1: Foundations

- **Conversation history as a first‑class entity**
  - Already supported via `Chat`/`Message`. Ensure mutation/query patterns are robust and audited.
- **User progress**
  - Extend data model with a **`UserProgress`** or similar table:
    - Completed onboarding steps.
    - Number of sessions/week, messages/day.
    - “Streaks” of daily check‑ins.

### 6.2 Phase 2: Light Gamification

- **Concepts**
  - **Daily check‑in**: small astrology tip or ritual suggestion; record in `UserProgress`.
  - **Streaks & badges**: e.g. “7‑day mindfulness streak”, “completed career focus session”.
- **Backend needs**
  - Simple endpoints or GraphQL mutations for:
    - `completeDailyCheckin`, `claimBadge`, `getProgressSummary`.
  - Scheduled job to **evaluate streaks** and award badges.

### 6.3 Phase 3: Twitter‑like Threads & Outlook‑like Inbox

- **Threads**
  - Reuse `Chat` as a **thread**, with:
    - `title`, `pinned`, `last_activity_at`, `unread_count`.
  - Support **threaded replies** by introducing:
    - Optional `parent_message_id` on `Message` for sub‑threads on specific insights.
- **Inbox view**
  - Backend query to return **paginated inbox**:
    - Chats ordered by `last_activity_at desc`.
    - Per‑chat summary: last message excerpt, unread count, tags (e.g. “health”, “career”, “relationships”).

---

## 7. Future: Marketplace & Human Astrologers

### 7.1 Marketplace Foundations

- **Data model extensions**
  - `AstrologerProfile` (linked to Auth or separate table): experience, specialties, languages, pricing, availability.
  - `Consultation` / `Booking`: links user, astrologer, timeslot, status, notes.
  - `Review` / `Rating`: post‑consultation feedback.
- **Security & trust**
  - Stronger **KYC** for astrologers.
  - Clear separation of **user PII** and what is visible to astrologers; they should get the minimum needed context for reading.

### 7.2 AI + Human Hybrid Flows

- **AI as triage**
  - Use AI to **prepare a case summary** from chats and kundli for the astrologer.
  - Allow astrologers to annotate and override AI suggestions while storing both views.

---

## 8. Operational Excellence

- **Short term**
  - Add **structured logging and correlation IDs** around each request and background job.
  - Create **alerts** for:
    - Kundli queue failures.
    - LLM error spikes.
    - Elevated login failures or suspicious access patterns.
- **Medium term**
  - Add **metrics** (Prometheus/OpenTelemetry) for:
    - Latency and error rate per resolver/mutation.
    - Queue length and processing times.
    - LLM token counts per user per day (for cost visibility).

---

## 9. Prioritized Next Steps (Backend)

- **P0 (now)**
  - Enforce `ENCRYPTION_KEY` and HTTPS in non‑dev.
  - Introduce logout that reliably invalidates tokens and clears client state.
  - Add basic rate limiting for auth and chat APIs.
- **P1 (next 4–6 weeks)**
  - Migrate to **HTTPOnly cookie‑backed sessions** plus refresh tokens and optional `Session` table.
  - Split queue worker into a **separate process**; add health endpoints.
  - Wire chat history into RAG for richer answers and “pick up where you left off”.
- **P2 (6–12 weeks)**
  - Introduce **progress tracking**, daily check‑ins, and light gamification endpoints.
  - Extend data model for **future marketplace** (astrologer profiles, bookings) while keeping the surface area behind feature flags until product is ready.

