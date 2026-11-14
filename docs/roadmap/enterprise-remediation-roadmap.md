# Enterprise Remediation Roadmap: Security, Scalability & Performance
**Target Systems**: AI AdAstra Full-Stack Ecosystem (`AIAstra_Server`, `AIAstra_WEB`, `aiadastra_admin`, `AIAstra_Radha`, AWS Infrastructure)  
**Classification**: Engineering Execution Blueprint  
**Standard**: SOC 2 Type II, ISO 27001, OWASP ASVS 5.0 (Level 2), Google Core Web Vitals  
**Date**: November 2026  
**Status**: Prioritized Strategic Plan  

---

## Executive Summary

To elevate the AI AdAstra platform from an early-stage deployment to an enterprise-grade, high-concurrency, cryptographically sealed Vedic astrology platform, this roadmap defines four prioritized execution phases spanning 12 weeks.

```
+---------------------------------------------------------------------------------------------------------+
|                                    ENTERPRISE REMEDIATION ROADMAP                                       |
+--------------------+--------------------+---------------------------------------+-----------------------+
| Phase              | Priority & Target  | Core Focus Areas                      | Key Deliverables      |
+--------------------+--------------------+---------------------------------------+-----------------------+
| Phase 1 (Wk 1-2)   | P0: Critical Sec.  | Immediate Vulnerability Hardening     | Fail-Closed Auth, CSP |
| Phase 2 (Wk 3-5)   | P1: Scalability    | AWS RDS Migration & Connection Proxy  | RDS Proxy, Batch Calc |
| Phase 3 (Wk 6-8)   | P1: Data Privacy   | KMS PII Sealing & Resumable AI Turns  | Envelope Encrypt, SSE |
| Phase 4 (Wk 9-12)  | P2: Edge & Scale   | Redis Clustering & Client CWV Polish  | Lazy Routes, Throttling|
+--------------------+--------------------+---------------------------------------+-----------------------+
```

---

## Phase 1: Immediate Security Hardening & Vulnerability Remediation
**Timeline**: Weeks 1 – 2  
**Target Milestone**: Zero High-Severity Vulnerabilities across Server, Web, and Admin  
**Prerequisites**: None  

### 1.1 Server Authentication & Access Control (P0)
- [ ] **Remediate Fail-Open Authentication in `requestAuth.ts`**:
  * *Target*: `AIAstra_Server/src/auth/requestAuth.ts:139–144`
  * *Action*: Modify the database exception `catch` block to fail closed. If the database read fails, log a critical security event and return `{ userId: null, role: 'anonymous', locked: true, reason: 'auth_db_unavailable' }`.
- [ ] **Deprecate Static `ADMIN_LAB_TOKEN` Bypass**:
  * *Target*: `AIAstra_Server/src/routes/adminLabRoutes.ts:60–94`
  * *Action*: Remove static header comparison `x-admin-lab-token === ADMIN_LAB_TOKEN`. Enforce authenticated staff JWT tokens verified against `requireRoles(ctx, ['admin', 'superadmin'])` with full audit logging.
- [ ] **Implement Mandatory Admin Chart Access Audit Logging**:
  * *Target*: `aiadastra_admin/api/src/admin/chartData.ts:263` and `contract.ts:68–88`
  * *Action*: Add `chart.inspect` to `AdminActionKind`. In `getChartData`, execute `await record(db, adminId, 'chart.inspect', userId, { reason: query.reason })` to ensure every staff view of customer birth details is permanently recorded.
- [ ] **Harden OTP Brute-Force Defense**:
  * *Target*: `AIAstra_Server/src/auth/emailCode.ts:102–144`
  * *Action*: Persist `failed_login_attempts` to the `auth` database table. Invalidate the active OTP code and lock the account for 15 minutes after 5 consecutive incorrect submissions.

### 1.2 GraphQL Hardening & Configuration Hardening (P0)
- [ ] **Enable GraphQL Error Masking**:
  * *Target*: `AIAstra_Server/server.ts:172–178`
  * *Action*: Set `maskedErrors: getNodeEnv() === 'production' || getNodeEnv() === 'staging'`. In non-development tiers, sanitize all database and Prisma errors to generic codes.
- [ ] **Deploy Query Depth & Complexity Limiters**:
  * *Target*: `AIAstra_Server/server.ts:172–178`
  * *Action*: Install `@escape.tech/graphql-armor-max-depth` (configured to max depth 6) and `@escape.tech/graphql-armor-cost-limit`. Disable schema introspection when `NODE_ENV === 'production'`.
- [ ] **Harden Express CORS & Security Headers**:
  * *Target*: `AIAstra_Server/server.ts:1–160`
  * *Action*:
    1. Import and mount `helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })`.
    2. Add `app.disable('x-powered-by')`.
    3. Update CORS fallback: when `prodOrigins` is empty, set `origin: false` to fail closed rather than reflecting unvetted origins with credentials.

### 1.3 Web & Frontend Header Hardening (P0)
- [ ] **Deploy Content Security Policy (CSP) & Clickjacking Headers in Consumer Web**:
  * *Target*: `AIAstra_WEB/customHttp.yml:42–47`
  * *Action*: Add the missing security headers matching the Admin portal:
    ```yaml
    - key: Content-Security-Policy
      value: "default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://*.cloudfront.net; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    - key: X-Frame-Options
      value: DENY
    - key: Strict-Transport-Security
      value: max-age=31536000; includeSubDomains
    - key: Permissions-Policy
      value: camera=(), microphone=(), geolocation=(), payment=()
    ```
- [ ] **Secure Gemini API Key Transmission**:
  * *Target*: `AIAstra_Server/src/services/geminiCacheService.ts:203` and `geminiChatService.ts:346`
  * *Action*: Move `apiKey` from URL query parameter (`?key=...`) to standard `x-goog-api-key` HTTP header.

---

## Phase 2: Scalability, Connection Pooling & Database Migration
**Timeline**: Weeks 3 – 5  
**Target Milestone**: Support 1,000+ Concurrent Lambda Instances Without Connection Exhaustion  
**Prerequisites**: Phase 1 Complete  

### 2.1 AWS Relational Database Migration (P0)
- [ ] **Migrate Database to AWS Aurora PostgreSQL Serverless v2**:
  * *Target*: `aiastra-aws-terraform/` and Prisma configuration
  * *Action*:
    1. Provision an Amazon Aurora PostgreSQL Serverless v2 cluster (0.5 to 16 ACUs) in the application VPC.
    2. Execute data migration from external Render PostgreSQL using AWS Database Migration Service (DMS) or pg_dump/pg_restore during a planned maintenance window.
- [ ] **Deploy AWS RDS Proxy with Transaction Connection Multiplexing**:
  * *Target*: `aiastra-aws-terraform/modules/rds_proxy/`
  * *Action*:
    1. Provision AWS RDS Proxy in front of Aurora PostgreSQL with transaction-mode pooling (`max_connections = 60`).
    2. Point `DATABASE_URL` to the RDS Proxy endpoint.
    3. Update `src/lib/prismaUrl.ts` to recognize port `6543` and RDS Proxy endpoints, enforcing `connection_limit=2` per Lambda instance.

### 2.2 Lambda Concurrency Hardening (P1)
- [ ] **Configure Reserved & Provisioned Concurrency in Terraform**:
  * *Target*: `aiastra-aws-terraform/modules/lambda_server_api/main.tf`
  * *Action*:
    1. Configure `reserved_concurrent_executions = 400` to prevent Lambda concurrency exhaustion across the AWS account.
    2. Configure `provisioned_concurrent_executions = 20` on the API Lambda to eliminate cold starts for active traffic.
- [ ] **Decouple Registry Seeding from Boot Path**:
  * *Target*: `AIAstra_Server/server.ts:460–464`
  * *Action*: Move `seedAgentRegistry` and `seedTechniqueRegistry` out of the runtime container boot path into a standalone CI/CD deployment migration step.

### 2.3 Microservice & LLM Optimization (P1)
- [ ] **Batch Full Kundli Calculation Endpoint in `AIAstra_Radha`**:
  * *Target*: `AIAstra_Radha/app.py` and `AIAstra_Server/src/lib/astroKundliClient.ts`
  * *Action*: Consolidate the 10 separate synchronous Lambda calls (`biodata`, `d1`..`d10`, `charakaraka`, `dashas`) into a single `POST /calculate-full-kundli` endpoint, reducing microservice invocations by 90%.
- [ ] **Activate Gemini Explicit Context Caching (`GEMINI_CACHE_ENABLED=1`)**:
  * *Target*: `AIAstra_Server/src/services/geminiCacheService.ts` and Terraform environment
  * *Action*: Enable explicit prompt caching on stable astrological prefixes (`DigestView`). Target a $\ge 70\%$ cache hit rate across multi-agent reader calls, reducing prompt token costs and TTFT latency.

---

## Phase 3: Enterprise Cryptography, PII Sealing & Resumable AI Turns
**Timeline**: Weeks 6 – 8  
**Target Milestone**: End-to-End At-Rest PII Encryption & Resumable Generative AI Turns  
**Prerequisites**: Phase 2 Complete  

### 3.1 AWS KMS Provider Implementation & PII Sealing (P0)
- [ ] **Build Production `KmsKeyProvider`**:
  * *Target*: `AIAstra_Server/src/lib/pii/keys.ts:107–125`
  * *Action*: Implement `KmsKeyProvider` using `@aws-sdk/client-kms`. Implement `GenerateDataKey` with AES-256 and local caching of encrypted data keys.
- [ ] **Activate `PII_WRITE_MODE=sealed` Across Lambda Environments**:
  * *Target*: `AIAstra_Server/src/lib/pii/seal.ts` and `fields.ts`
  * *Action*: Execute background migration encrypting existing plaintext columns (`birth_date`, `birth_time`, `lat`, `lon`, `chat_messages`) into `pii2:v1` AES-256-GCM ciphertexts with blind indexing for search.
- [ ] **Migrate Client Storage to Secure HttpOnly Cookies**:
  * *Target*: `AIAstra_WEB/src/lib/graphql.ts` and `AIAstra_Server/src/services/authService.ts`
  * *Action*: Replace `localStorage.setItem('token', token)` with `httpOnly`, `Secure`, `SameSite=Lax` cookies, eliminating XSS token theft vectors.

### 3.2 Resumable Generative AI Turn State Machine (P1)
- [ ] **Implement Asynchronous Turn State Machine**:
  * *Target*: `AIAstra_Server/server.ts:223–348` and database schema
  * *Action*:
    1. Create `chat_turns` table tracking `turn_id`, `status` (`queued`, `generating`, `completed`, `failed`), and partial token buffers.
    2. Emit `turn_id` within the first 150ms of stream connection.
    3. If the client socket disconnects, decouple generation from the socket and continue generation in background.
    4. Implement `GET /api/chat/turns/:turn_id` allowing clients to resume or poll incomplete readings.
- [ ] **Deploy Speculative Early-Exit Reader Synthesis**:
  * *Target*: `AIAstra_Server/src/reading/oracle/readers.ts:160–163`
  * *Action*: Replace the 8,000ms join barrier with progressive quorum synthesis. Start Oracle generation as soon as core readers (`R01`, `R02`, `R03`) return, streaming introductory insights in $< 3.5\text{s}$.

---

## Phase 4: High-Concurrency Hardening & Client Performance Polish
**Timeline**: Weeks 9 – 12  
**Target Milestone**: 10,000+ Concurrent Sessions, Sub-50ms INP, and Sub-1.5s LCP  
**Prerequisites**: Phase 3 Complete  

### 4.1 Distributed Caching & Token-Bucket Rate Limiting (P2)
- [ ] **Deploy AWS ElastiCache Redis Cluster**:
  * *Target*: `aiastra-aws-terraform/modules/elasticache/`
  * *Action*:
    1. Provision a multi-AZ ElastiCache Redis cluster.
    2. Migrate multi-instance session revocation from local in-memory Maps to Redis key expiration.
    3. Implement a centralized token-bucket rate limiter for Google Gemini API calls, preventing 429 quota depletion.

### 4.2 Frontend Core Web Vitals Optimization (P2)
- [ ] **Dynamic Route Code-Splitting in `AIAstra_WEB`**:
  * *Target*: `AIAstra_WEB/src/routes.tsx:1–35`
  * *Action*: Convert heavy static page imports (`ChatInterface`, `CareerBoard`, `WelcomeWizard`) to `React.lazy()` with `<Suspense fallback={<LoadingVeil />}>`, reducing initial bundle size by $\ge 45\%$.
- [ ] **Client Token Streaming Throttling**:
  * *Target*: `AIAstra_WEB/src/pages/chat-interface/ChatSection.tsx:333`
  * *Action*: Buffer incoming SSE token deltas and flush to React state on `requestAnimationFrame` boundaries (every 50ms), reducing main-thread render frequency from 50 FPS to 20 FPS and lowering INP to $< 50\text{ms}$.
- [ ] **Optimistic UI State Queues**:
  * *Target*: `AIAstra_WEB/src/pages/chat-interface/ChatMainArea.tsx`
  * *Action*: Display user chat questions and card toggles immediately in optimistic local state before awaiting network confirmations.

---

## Remediation Governance & Verification Checkpoints

```
+---------------------------------------------------------------------------------------------------+
|                                    GATE VERIFICATION AUDIT CRITERIA                               |
+---------------------+-----------------------------------+-----------------------------------------+
| Milestone Gate      | Verification Command / Tool       | Pass Threshold Criteria                 |
+---------------------+-----------------------------------+-----------------------------------------+
| Gate 1 (Security)   | `npx vitest run tests/unit/`      | 100% tests pass; Zero high findings     |
|                     | OWASP ZAP / Armor depth tests     | Max depth enforced; Masked errors = true|
| Gate 2 (Scale)      | Artillery / k6 load test runner   | 1,000 concurrent Lambdas; 0 pool errors |
|                     | AWS CloudWatch metrics            | RDS Proxy connection sharing >= 10:1    |
| Gate 3 (Privacy)    | `tests/unit/privacyWire.test.ts`  | PII_WRITE_MODE=sealed; AES-GCM verified |
| Gate 4 (Latency)    | Google Lighthouse / Chrome Trace  | LCP < 1.8s; INP < 100ms; CLS < 0.05     |
+---------------------+-----------------------------------+-----------------------------------------+
```
