# Threat Model & Vulnerability Analysis
**System**: AI AdAstra Distributed Platform (`AIAstra_Server`, `AIAstra_WEB`, `aiadastra_admin`, `AIAstra_Radha`)  
**Methodologies**: STRIDE, Attack Trees, OWASP Top 10 API Security (2023), OWASP Top 10 for LLM Applications (2025)  
**Classification**: Enterprise Security Baseline  
**Date**: November 2026  

---

## 1. System Decomposition & Trust Boundaries

The AI AdAstra platform is decomposed into four primary operational zones separated by distinct trust boundaries:

```
[ Public Internet ]
        |
        | (Boundary 1: TLS 1.3 / CloudFront OAC / Amplify CDN)
        v
+------------------+         +-------------------------+
|  AIAstra_WEB     |         |    aiadastra_admin      |
|  (Consumer SPA)  |         | (Staff Management Portal|
+------------------+         +-------------------------+
        |                                 |
        | (Boundary 2: Cross-Origin CORS) | (Boundary 3: Staff VPN/MFA)
        v                                 v
+-------------------------------------------------------+
|                 AIAstra_Server                        |
|  - Express / GraphQL Yoga API Gateway                 |
|  - Authentication & RBAC Engine (assertOwnAccount)    |
|  - LangGraph Multi-Agent Oracle Pipeline              |
|  - PII Sealing Layer (AES-256-GCM / KMS Provider)     |
+-------------------------------------------------------+
        |                                 |
        | (Boundary 4: AWS Internal)      | (Boundary 5: Public Internet)
        v                                 v
+-----------------------+       +------------------------------------+
|    AIAstra_Radha      |       | External Managed Services:         |
| (Lambda / pyjhora)    |       | - Render PostgreSQL (Database)     |
+-----------------------+       | - Google Gemini 2.5/3.x API        |
                                | - Groq API                         |
                                | - Cloudflare Turnstile             |
                                +------------------------------------+
```

### Trust Boundary Definitions
- **Boundary 1 (Public Client to Edge)**: Untrusted browser environments executing React SPAs communicating via HTTPS with CloudFront distributions.
- **Boundary 2 (Consumer Client to Server Gateway)**: Cross-origin HTTP requests passing through CloudFront Origin Access Control (OAC) to the AWS Lambda Web Adapter. Authenticated via Bearer JWTs.
- **Boundary 3 (Administrative Boundary)**: Dedicated staff access point requiring 2-step MFA (credentials + email OTP), restricted to staff role accounts.
- **Boundary 4 (Internal Server-to-Microservice)**: AWS IAM-authenticated synchronous Lambda invocation between `aiastra-server-api` and `aiastra-pyjhora`.
- **Boundary 5 (External Cloud Boundary)**: Outbound internet requests from Lambda to Google Gemini GenAI APIs and external database connections to Render PostgreSQL.

---

## 2. Threat Actor Profiles

| Threat Actor | Motivation | Capabilities | Target Assets |
| :--- | :--- | :--- | :--- |
| **External Anonymous Attacker (Cybercriminal)** | Financial gain, credential stuffing, extortion via leaked PII. | Automated distributed botnets, headless browsers, script injection, API fuzzer tools. | Customer database, unencrypted birth data, authentication tokens, LLM API keys. |
| **Malicious Authenticated User (Abusive Client)** | Free astrological readings, quota circumvention, model extraction. | Valid user account, reverse-engineered client scripts, prompt injection payloads. | Token quotas, system prompt templates, competitor model cloning, server resources. |
| **Rogue / Negligent Staff Member (Insider Threat)** | Stalking, unauthorized snooping, corporate espionage. | Valid admin credentials, access to internal management dashboards. | Customer birth details, natal charts, relationship/love readings, payment data. |
| **Compromised Dependency / Supply Chain** | Silent backdoors, data exfiltration via third-party scripts. | Malicious npm packages, compromised CDN bundles (e.g. Google Tag Manager). | In-memory tokens, `localStorage` contents, DOM modification. |

---

## 3. STRIDE Threat Analysis Across Components

### 3.1 Spoofing (Identity Deception)
- **TH-S1: Account Takeover via OTP Brute-Force**: Because `legacyVerifyLoginCode` (`src/auth/emailCode.ts:102`) does not lock the account after failed attempts within the 3-minute window, an attacker targeting a known user email could attempt high-frequency code guesses.
  * *Mitigation*: Enforce persistent account lockout after 5 consecutive failures; tie OTP verification to the client's session context.
- **TH-S2: Fail-Open Authentication Spoofing**: `src/auth/requestAuth.ts:139` catches database read errors and marks `locked: false` with the token's claim role. An attacker possessing a revoked or locked account token can flood the database with connection-exhausting requests to induce errors and gain authorized access.
  * *Mitigation*: Enforce fail-closed error handling in `authenticateRequest`.

### 3.2 Tampering (Data Modification)
- **TH-T1: GraphQL Mutation Batching & IDOR Injection**: Lack of uniform `assertOwnAccount` across all resolvers in `src/graphql/schema.ts` allows an attacker to manipulate object IDs in batched mutation arrays.
  * *Mitigation*: Strictly mandate `assertOwnAccount(ctx, targetUserId)` on every resolver touching user state.
- **TH-T2: Transit & Kundli Tampering**: If raw astrological computations were performed in Node, tampering with planetary degrees could produce false readings.
  * *Mitigation*: Architectural rule strictly maintained—all astrological calculations are performed deterministically in `AIAstra_Radha` using Swiss Ephemeris (`pyjhora`).

### 3.3 Repudiation (Denial of Actions)
- **TH-R1: Un-audited Customer Chart Snooping by Administrators**: Staff members executing `GET /chart-data/:id` in `aiadastra_admin/api/src/admin/chartData.ts` can view customer birth records and astrological timelines with zero rows written to `admin_actions`.
  * *Mitigation*: Implement mandatory, immutable read-access audit logging for all PII and chart retrieval endpoints in `aiadastra_admin`.

### 3.4 Information Disclosure (Data Leakage)
- **TH-I1: Database At-Rest Exposure via KMS Provider Stub**: `KmsKeyProvider` in `src/lib/pii/keys.ts:107` throws `PII_UNAVAILABLE`, forcing `PII_WRITE_MODE=plain`. An attacker gaining read access to the Render PostgreSQL instance (via SQL injection, compromised credentials, or Render backup leakage) obtains all customer birth dates, coordinates, and personal question logs in cleartext.
  * *Mitigation*: Complete AWS KMS envelope encryption provider and encrypt all `SEALED_MODELS` columns with AES-256-GCM.
- **TH-I2: GraphQL Verbose Stack Trace & Error Disclosure**: `server.ts:177` sets `maskedErrors: false`, leaking internal Prisma database errors and file paths to client responses.
  * *Mitigation*: Enable `maskedErrors: true` in non-development environments.
- **TH-I3: Gemini API Key Exposure in URL Query Strings**: `src/services/geminiCacheService.ts:203` appends the master Google API key to URL query strings, exposing it in proxy logs.
  * *Mitigation*: Pass API keys exclusively via `x-goog-api-key` HTTP headers.
- **TH-I4: Token Exfiltration from `localStorage`**: Consumer Web stores JWTs in unencrypted `localStorage` (`AIAstra_WEB/src/lib/graphql.ts:190`) with no Content Security Policy in `customHttp.yml`.
  * *Mitigation*: Implement strict CSP headers in `customHttp.yml` and migrate auth tokens to `httpOnly` secure cookies.

### 3.5 Denial of Service (System Availability Attack)
- **TH-D1: Render PostgreSQL Connection Pool Exhaustion**: 1,000 Lambda instances opening 6 connections each (`src/lib/prismaUrl.ts:20`) demand 6,000 direct database connections across the public internet to Render PostgreSQL, instantly exhausting database connection pools.
  * *Mitigation*: Migrate database to AWS RDS PostgreSQL behind AWS RDS Proxy with transaction-mode pooling.
- **TH-D2: GraphQL Recursive Query Depth DoS**: `server.ts:172` omits query depth limiters, allowing deeply nested recursive queries to exhaust server memory.
  * *Mitigation*: Enforce `@escape.tech/graphql-armor-max-depth` (max depth 6).
- **TH-D3: Gemini Rate Limit Denial of Wallet (DoW)**: Tier 1 queries trigger up to 16 parallel Gemini calls (`src/reading/oracle/readers.ts:151`). An attacker issuing rapid concurrent questions will rapidly deplete Gemini API rate quotas (360–1,000 RPM) and cause massive billing spikes.
  * *Mitigation*: Enforce strict per-user rate limits and a centralized concurrency queuing mechanism.

### 3.6 Elevation of Privilege (Unauthorized Capabilities)
- **TH-E1: Administrative Lab Token Bypass**: `src/routes/adminLabRoutes.ts:60–94` exposes decrypted customer records via a static header `x-admin-lab-token`. Any leak of this token grants root-level data inspection privileges.
  * *Mitigation*: Eliminate static lab tokens; enforce standard OAuth/JWT RBAC for internal debugging tools.
- **TH-E2: Research Hydration Privilege Escalation**: `src/routes/researchRoutes.ts:42` permits any regular authenticated user to invoke `POST /api/research/hydrate`, consuming substantial computational and database resources.
  * *Mitigation*: Enforce `requireRoles(ctx, ['admin', 'researcher'])`.

---

## 4. In-Depth Attack Trees

### Attack Tree 1: Account Takeover via OTP Brute-Force & Fail-Open Exploitation

```
[ Compromise Victim Account ]
  |
  +-- 1. Exploit OTP Verification Weakness
  |     |-- 1.1 Obtain victim's email address (via credential dump or OSINT)
  |     |-- 1.2 Request magic link / OTP code (bypassing Turnstile via solver or farming)
  |     |-- 1.3 Execute high-speed brute force against `legacyVerifyLoginCode` within 180s TTL
  |     \-- 1.4 Success: Server emits 7-day bearer JWT
  |
  +-- 2. Exploit Fail-Open Auth on Locked / Revoked Account
        |-- 2.1 Attacker obtains expired or locked user token
        |-- 2.2 Trigger database connection pool saturation (flood `/query` or deep GraphQL)
        |-- 2.3 `prismaReadRow` throws P2024 connection timeout error
        |-- 2.4 `requestAuth.ts:139` catch block executes -> returns `{ locked: false, role: claims.role }`
        \-- 2.5 Attacker accesses protected resolvers with locked account
```

---

### Attack Tree 2: Customer PII Exfiltration via Stubbed KMS & Plaintext Database

```
[ Exfiltrate Sensitive Customer Birth & Astrological Data ]
  |
  +-- 1. Compromise Primary Relational Storage (Render PostgreSQL)
  |     |-- 1.1 Exploit permissive CORS (`server.ts:135`) or misconfigured network firewall
  |     |-- 1.2 Access Render PostgreSQL database directly
  |     \-- 1.3 Query `auth`, `kundlis`, `kundli_boards`, and `chat_messages`
  |           \-- Critical Gap: `PII_WRITE_MODE=plain` means all records are unencrypted
  |
  +-- 2. Exploit Administrative Lab Token
  |     |-- 2.1 Discover `ADMIN_LAB_TOKEN` from repository history, logs, or environment leak
  |     |-- 2.2 Send `GET /api/admin-lab/people` with `x-admin-lab-token` header
  |     \-- 2.3 Server returns complete array of all customer profiles and decrypted biodata
  |
  +-- 3. Covert Staff Snooping
        |-- 3.1 Rogue employee logs into `aiadastra_admin` portal
        |-- 3.2 Navigate to User Inspection -> `GET /chart-data/:id`
        \-- 3.3 Inspect victim's exact birth time, location, and astrological dashas
              \-- Gap: `admin_actions` table receives ZERO audit log entries
```

---

### Attack Tree 3: Denial of Service / Denial of Wallet via AI Amplification

```
[ Exhaust Application Availability & Cloud Budgets ]
  |
  +-- 1. GraphQL Depth & Complexity Explosion
  |     |-- 1.1 Craft 100-level nested recursive query (`me { referrals { referrals { ... } } }`)
  |     |-- 1.2 Issue request to `/graphql` (`server.ts:172`)
  |     \-- 1.3 Yoga parser exhausts Node.js V8 memory heap -> Lambda crashes
  |
  +-- 2. Database Connection Starvation
  |     |-- 2.1 Launch 100 concurrent HTTP requests to `/api/chat/ask-stream`
  |     |-- 2.2 AWS Lambda scales horizontally to 100 containers
  |     |-- 2.3 Containers request 600 direct connections to Render PostgreSQL (`prismaUrl.ts:20`)
  |     \-- 2.4 Render PostgreSQL hits max connection cap -> rejects all platform traffic
  |
  +-- 3. LLM API Rate Limit & Quota Depletion (Denial of Wallet)
        |-- 3.1 Script 50 simultaneous Tier 1 reading queries
        |-- 3.2 Each Tier 1 query triggers 11 reader LLMs + 1 Oracle + 1 validator = ~14 Gemini calls
        |-- 3.3 50 queries × 14 calls = 700 Gemini requests in < 15 seconds
        \-- 3.4 Google Gemini returns HTTP 429 Too Many Requests -> platform AI reading fails globally
```

---

### Attack Tree 4: Client-Side Token Exfiltration via Missing CSP & Insecure Storage

```
[ Steal User Authentication Token from Client Browser ]
  |
  +-- 1. Exploit Missing Content Security Policy (CSP) in `AIAstra_WEB`
  |     |-- 1.1 Inject third-party malicious script or exploit unsanitized markdown link
  |     |-- 1.2 Browser loads malicious JavaScript (no CSP `script-src` to block execution)
  |     |-- 1.3 Script reads `localStorage.getItem('token')` (`graphql.ts:190`)
  |     \-- 1.4 Script transmits token to attacker-controlled collector endpoint
  |
  +-- 2. Exploit Missing Framing Protection (Clickjacking)
        |-- 2.1 Attacker embeds `https://vedic-astrology.app` in an iframe on a phishing site
        |-- 2.2 Lack of `X-Frame-Options` or `frame-ancestors 'none'` allows framing
        |-- 2.3 Transparent overlay tricks user into clicking "Delete Account" or "Subscribe"
```

---

## 5. OWASP Top 10 for LLM Applications (2025) Mitigation Matrix

| LLM Risk ID | Description & Platform Exposure | Technical Mitigation in AIAstra | Status |
| :--- | :--- | :--- | :---: |
| **LLM01: Prompt Injection** | Untrusted user strings concatenated directly into prompts (`groqChatService.ts:174`). | Enforce XML delimiters (`<user_question>...</user_question>`) and validate against adversarial jailbreaks. | **IN PROGRESS** |
| **LLM02: Sensitive Information Disclosure** | Accidental generation of internal system names or private data. | `scrubEngineNames` and `NEVER_SAY` filters redact internal identifiers (`Radha`, `pyjhora`). | **COMPLIANT** |
| **LLM03: Supply Chain Vulnerabilities** | Compromised AI libraries or model backdoors. | Official Google GenAI & Groq SDKs pinned in `package.json`; automated Dependabot monitoring. | **COMPLIANT** |
| **LLM04: Data and Model Poisoning** | Malicious data ingested into fine-tuning pipelines. | Zero user data is used for model fine-tuning; prompts are static and reviewed. | **COMPLIANT** |
| **LLM05: Improper Output Handling** | Generated text containing malicious HTML rendered by client. | Markdown parsed without `rehype-raw`; add `rehype-sanitize` to enforce safe link protocols. | **PARTIAL** |
| **LLM06: Excessive Agency** | LLM agents granted unauthorized write or execution tools. | LLM agents have zero tool execution privileges; outputs are restricted to structured findings. | **COMPLIANT** |
| **LLM07: System Prompt Leakage** | Extraction of proprietary astrological prompt techniques. | Rule 0 Anti-Sycophancy and `src/assistant/guard.ts:19` regex filters intercept extraction attempts. | **COMPLIANT** |
| **LLM08: Vector & Embedding Weaknesses** | Poisoning of RAG reference data. | RAG utilizes curated classical Vedic source texts with local cosine similarity calculations. | **COMPLIANT** |
| **LLM09: Misinformation & Hallucination** | Invention of planetary transits or astrological facts. | Grounded strictly in `AIAstra_Radha` Swiss Ephemeris calculations; zero Node house arithmetic. | **COMPLIANT** |
| **LLM10: Unbounded Consumption** | Unthrottled multi-agent fan-out depleting API quotas. | Implement global token bucket rate limiting and concurrency queues before reader dispatch. | **NON-COMPLIANT** |

---

## 6. Threat Mitigation Architecture

To counter the identified threat vectors, the target enterprise mitigation architecture establishes five core defense rings:

```
[ Edge Defense ]
  - CloudFront OAC + AWS WAF (Rate limiting, IP reputation, bot control)
  - Strict Web Security Headers (CSP, HSTS, X-Frame-Options: DENY)

[ Gateway Defense ]
  - Express Helmet middleware (Disable X-Powered-By)
  - Strict CORS origin validation (Fail-closed)
  - GraphQL Armor (Max Depth: 6, Cost limiting, Disable Introspection in Prod)
  - Rate limiting on all REST streaming and RAG endpoints

[ Identity & Access Defense ]
  - Fail-closed request authentication (`requestAuth.ts`)
  - Persistent OTP failure rate-limiting and account lockout
  - Short-lived JWTs (24h) + HttpOnly secure refresh cookies
  - Universal `assertOwnAccount` RBAC enforcement across all resolvers
  - Mandatory audit logging for all admin PII/chart reads

[ Cryptographic Defense ]
  - AWS KMS Key Provider implementation for `SEALED_MODELS`
  - AES-256-GCM envelope encryption at rest for all birth records and chat transcripts
  - Gemini API key transmitted via `x-goog-api-key` header

[ AI Pipeline Defense ]
  - Structured prompt framing (`<user_question>` delimiters)
  - Global token-bucket rate limiter for Gemini reader fan-out
  - Post-generation streaming output sanitizer
```
