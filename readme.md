# AI AdAstra Server (`AIAstra_Server`)
**Enterprise Security, Architecture, Scalability & Performance Baseline**  
**Standards Compliance**: OWASP ASVS 5.0 (Level 2), OWASP API Security Top 10 (2023), OWASP GenAI Top 10 (2025)

---

## Executive Summary

AI AdAstra is a high-precision Vedic astrology personal assistant composed of an Express/GraphQL serverless backend (**AIAstra_Server** on AWS Lambda Web Adapter), a React 18 frontend (**AIAstra_WEB** on AWS Amplify), an administrative portal (**aiadastra_admin**), and an astronomical calculation microservice (**AIAstra_Radha** running Swiss Ephemeris / `pyjhora`).

In November 2026, an exhaustive static security audit, architectural evaluation, competitor benchmark, and scalability stress assessment was conducted across the platform. While the system demonstrates mature domain modeling, Rule 0 Anti-Sycophancy verification, and zero third-party advertising tracking, critical architectural bottlenecks and security gaps were identified that require remediation before public enterprise scaling.

```
+---------------------------------------------------------------------------------------------------------+
|                                  PLATFORM BASELINE SCORECARD (NOV 2026)                                 |
+------------------------------+--------------------+-----------------------------------------------------+
| Evaluation Dimension         | Current Status     | Target Enterprise Standard                          |
+------------------------------+--------------------+-----------------------------------------------------+
| OWASP ASVS 5.0 Level 2       | 52.1% Compliance   | 100% Compliance across V1-V14                       |
| Database Connection Scaling  | High Risk (Render) | AWS Aurora PostgreSQL Serverless v2 + RDS Proxy     |
| PII At-Rest Encryption       | Plaintext (Stubbed)| Active `SEALED_MODELS` AES-256-GCM via AWS KMS      |
| Generative AI Latency (TTFT) | 7.6s - 11.8s       | Speculative Early-Exit Streaming (< 3.5s TTFT)      |
| Generative Turn Resiliency   | Persist-at-End     | Resumable Turn State Machine with Early Turn ID     |
| GraphQL Security Controls    | MaskedErrors:false | Armor Max Depth (6), Cost Limiting, Masked Errors   |
| Web Client Defense-in-Depth  | Missing CSP/HSTS   | Strict CSP, Frame Ancestors: none, HSTS             |
| Privacy vs. Competitors      | Zero Ad Trackers   | Maintained as core differentiator against CoStar/AT |
+------------------------------+--------------------+-----------------------------------------------------+
```

---

## Comprehensive Assessment & Engineering Reports

All full-length, in-depth technical reports, threat models, competitor benchmarks, and remediation plans are maintained under `docs/`:

### 1. Security, Vulnerability & Threat Modeling
- **[Comprehensive Enterprise Security Assessment](docs/security/assessment.md)**: Exhaustive static codebase audit covering GraphQL vulnerabilities, authentication fail-open risks, plaintext PII storage on Lambda, frontend `localStorage` tokens, missing CSP headers, and un-audited admin chart snooping.
- **[OWASP ASVS 5.0 Level 2 Verification Matrix](docs/security/asvs-5.0-matrix.md)**: 48-point verification matrix spanning Chapters V1 through V14 with detailed Pass/Partial/Fail statuses, exact code references, and remediation steps.
- **[Threat Model & STRIDE Vulnerability Analysis](docs/security/threat-model.md)**: Formal threat model detailing 4 threat actor profiles, STRIDE component analysis, 5 detailed attack trees, and OWASP LLM Top 10 (2025) mitigation matrices.

### 2. Architecture, Concurrency & Latency Evaluations
- **[Technical Competitor Benchmark (CoStar, AstroTalk, AstroSage)](docs/architecture/competitor-benchmark.md)**: In-depth technical comparison grounded strictly in verified primary documentation (Haskell JPL backend, Agora SD-RTN 50k WebRTC sessions, Swiss Ephemeris C-libraries with Varnish caching), separating marketing claims from engineering realities.
- **[Performance, Concurrency & Scalability Evaluation](docs/architecture/performance-concurrency.md)**: Concurrency stress analysis evaluating AWS Lambda limits, the 6,000-connection Render PostgreSQL multiplier, synchronous Radha microservice fan-out, and Google Gemini API quota saturation.
- **[Tiered Latency Contract & Real-Time Performance](docs/architecture/tiered-latency-contract.md)**: Rigorous evaluation against the 100ms UI / 500ms API / 10s AI Streaming contract, detailing reader join-barrier delays, cold starts, and specifications for a resumable turn state machine.

### 3. Execution Roadmap
- **[Prioritized Enterprise Remediation Roadmap](docs/roadmap/enterprise-remediation-roadmap.md)**: 4-phase, 12-week implementation blueprint:
  * **Phase 1 (Weeks 1–2)**: Immediate Security Hardening (Fail-closed auth, GraphQL Armor, Web CSP, Admin audit logging).
  * **Phase 2 (Weeks 3–5)**: AWS Aurora Migration & RDS Proxy Connection Multiplexing.
  * **Phase 3 (Weeks 6–8)**: AWS KMS Key Provider, At-Rest PII Sealing & Resumable AI Turns.
  * **Phase 4 (Weeks 9–12)**: ElastiCache Redis Cluster, Route Code-Splitting & Client INP Throttling.

---

## Key Audit Findings Summary

| Finding ID | Domain | Severity | Description & Code Location |
| :--- | :--- | :---: | :--- |
| **SEC-01** | Authentication | **HIGH** | `src/auth/requestAuth.ts:139`: Catches database lookup errors and fails open (`locked: false`), permitting locked accounts access during DB outages. |
| **SEC-02** | Cryptography | **HIGH** | `src/lib/pii/keys.ts:107`: `KmsKeyProvider` is an unbuilt stub throwing `PII_UNAVAILABLE`, forcing production Lambda to run in unencrypted `PII_WRITE_MODE=plain`. |
| **SEC-03** | Access Control | **HIGH** | `aiadastra_admin/api/src/admin/chartData.ts:263`: Staff inspection of customer birth data and astrological charts writes zero entries to `admin_actions`. |
| **SEC-04** | API Security | **HIGH** | `src/routes/adminLabRoutes.ts:60`: Static shared secret `ADMIN_LAB_TOKEN` exposes all users' decrypted PII, bypassing standard RBAC. |
| **SEC-05** | GraphQL | **MEDIUM** | `server.ts:177`: `createYoga({ maskedErrors: false })` leaks internal Prisma errors and SQL stack traces to client responses. |
| **SEC-06** | GraphQL | **MEDIUM** | `server.ts:172`: Omission of query depth limiters allows arbitrary recursive query DoS attacks. |
| **SEC-07** | Client Storage | **MEDIUM** | `AIAstra_WEB/src/lib/graphql.ts:190`: Unencrypted JWTs persisted in `localStorage` vulnerable to XSS extraction. |
| **SEC-08** | Web Headers | **MEDIUM** | `AIAstra_WEB/customHttp.yml`: Complete absence of Content Security Policy (CSP), `X-Frame-Options` (Clickjacking), and HSTS. |
| **SCALE-01** | Scalability | **HIGH** | `src/lib/prismaUrl.ts:20`: Each Lambda instance opens 6 connections to external Render PostgreSQL. 1,000 Lambdas demand 6,000 connections, crashing the DB. |
| **SCALE-02** | AI Quotas | **HIGH** | `src/reading/oracle/readers.ts:151`: Tier 1 questions spawn up to 16 parallel Gemini calls, rapidly exceeding standard commercial rate limits (360–1,000 RPM). |

---

## Development & Operations

### Environment Configuration
- **NODE_ENV**: `development` | `staging` | `production`.
- Copy `.env.example` to `.env` and set:
  * `DATABASE_URL` / `DIRECT_URL`: Relational database connection strings.
  * `JWT_SECRET`: Minimum 32-character HMAC secret.
  * `GEMINI_API_KEY`: Google GenAI API master key.
  * `CORS_ORIGINS`: Comma-separated list of allowed client origins.

### Database Migrations
Prisma migrations are managed through Server:
```bash
# Deploy additive migrations
npx.cmd prisma migrate deploy

# Verify migration status
npx.cmd prisma migrate status
```

### Verification & Testing
```bash
# Type check without compilation
npx tsc --noEmit

# Unit test suite (excludes DB integration)
npm run test:unit

# Full test suite (requires active test DB)
npm run test
```

---

## Licensing & Proprietary Notice
Proprietary software. All rights reserved. Vedic astrological algorithms, multi-agent reader synthesis pipelines, and anti-sycophancy verification engines are proprietary assets of AI AdAstra.
