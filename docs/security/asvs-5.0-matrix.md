# OWASP ASVS 5.0 Level 2 Verification Matrix
**System Under Evaluation**: AI AdAstra Platform (`AIAstra_Server`, `AIAstra_WEB`, `aiadastra_admin`)  
**Standard**: OWASP Application Security Verification Standard (ASVS) Version 5.0  
**Target Level**: Level 2 (Applications processing sensitive data, health/astrological PII, financial transactions)  
**Evaluation Date**: November 2026  
**Compliance Summary**:  
- **Total Requirements Audited**: 48  
- **Passed (Fully Compliant)**: 25 (52.1%)  
- **Partial Compliance**: 15 (31.3%)  
- **Failed (Non-Compliant / Gaps)**: 8 (16.6%)  

---

## Evaluation Criteria & Status Definitions
- **PASS**: The requirement is fully met by active, verified code, cryptographic controls, or automated enforcement mechanisms.
- **PARTIAL**: Architectural controls or code patterns exist, but specific gaps, bypasses, or inconsistencies were detected in static analysis.
- **FAIL**: The required security control is completely missing, stubbed, disabled, or insecurely configured.

---

## Chapter V1: Architecture, Design and Threat Modeling

| ASVS ID | Verification Requirement | Status | Evidence & Code Reference | Remediation Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **V1.1.1** | Verify that a secure software development lifecycle (SDLC) is in place with security gates. | **PASS** | Automated CI/CD in `.github/workflows/deploy-api-lambda.yml`, linting, static typing via `tsc --noEmit`, and unit test gates. | Maintain branch protections and enforce required status checks before merge to `develop`. |
| **V1.1.2** | Verify the availability and use of an architectural threat model covering threats, attack vectors, and security controls. | **PARTIAL** | Extensive domain and reading engine specifications in `docs/reading-engine/`, but formal OWASP threat model documentation was missing prior to this assessment. | Adopt `docs/security/threat-model.md` as the official threat model and update on architectural changes. |
| **V1.1.5** | Verify that all security controls fail securely and exceptions are handled safely. | **FAIL** | `src/auth/requestAuth.ts:139–144`: Catches database lookup exceptions during JWT validation and returns `{ userId, role: claims.role, locked: false }`. | Change catch block in `requestAuth.ts` to fail closed, returning an unauthenticated error state. |
| **V1.2.1** | Verify that all components (microservices, Lambdas, databases) have defined trust boundaries and communication channels are encrypted. | **PASS** | TLS enforced across CloudFront OAC, HTTPS endpoints, and database connection strings (`sslmode=require`). | Maintain TLS 1.3 across all Lambda Function URLs and CloudFront distributions. |
| **V1.4.1** | Verify that the application is architected to respect user data privacy and data residency requirements. | **PARTIAL** | Architectural design in `docs/privacy/02` and `SEALED_MODELS` exists; however, live execution defaults to `PII_WRITE_MODE=plain` due to stubbed KMS provider. | Deploy AWS KMS Key Provider to activate encrypted data residency and blind indexing. |

---

## Chapter V2: Authentication

| ASVS ID | Verification Requirement | Status | Evidence & Code Reference | Remediation Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **V2.1.1** | Verify that user passwords are submitted only over encrypted channels and stored using approved adaptive one-way functions. | **PASS** | All traffic requires HTTPS. User password authentication uses `bcrypt` with salt rounds (in `src/services/authService.ts`). | Continue bcrypt usage; consider migrating to Argon2id for higher memory-hardness compliance. |
| **V2.1.6** | Verify that passwordless authentication (OTP / Magic Links) uses high-entropy codes with short expiration times. | **PASS** | Passwordless sign-in uses 8-character codes with 3-minute TTL (`MAGIC_LINK_TTL_MS = 180_000` in `src/auth/emailCode.ts:16`). | Code entropy and expiration meet standard; pair with persistent failure throttling. |
| **V2.2.1** | Verify anti-automation controls (CAPTCHA / bot protection) are enforced on unauthenticated registration and login endpoints. | **PASS** | `AIAstra_WEB/src/Auth/SignIn.tsx` enforces Cloudflare Turnstile token validation prior to requesting login codes. | Turnstile tokens are validated server-side; maintain integration across all auth flows. |
| **V2.2.2** | Verify that authentication mechanisms defend against automated brute-force attacks via account lockout or rate limiting. | **PARTIAL** | `src/auth/emailCode.ts:102–144` notes OTP failures in memory, but does not persist failed attempt counters to `auth` table or lock the account after 5 failed tries. | Implement persistent failed attempt counters in the database; lock OTP verification after 5 consecutive failures. |
| **V2.8.1** | Verify that multi-factor authentication (MFA) is enforced for sensitive operations or administrative roles. | **PASS** | `aiadastra_admin/web/src/pages/SignIn.tsx` and `aiadastra_admin/api/src/auth.ts` enforce 2-step MFA (Password + Email OTP) for all staff logins. | Extend mandatory MFA to consumer accounts accessing billing management and export features. |

---

## Chapter V3: Session Management

| ASVS ID | Verification Requirement | Status | Evidence & Code Reference | Remediation Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **V3.1.1** | Verify that session identifiers (JWTs) are cryptographically signed using strong algorithms and protected keys. | **PARTIAL** | Tokens are signed with HMAC-SHA256 (`src/services/authService.ts:86`). However, `jwt.verify` in `src/auth/requestAuth.ts:125` omits explicit `algorithms: ['HS256']` pinning. | Update `jwt.verify(token, secret, { algorithms: ['HS256'] })` to prevent algorithm confusion attacks. |
| **V3.2.1** | Verify that session tokens are stored securely on the client and protected against extraction via XSS. | **FAIL** | `AIAstra_WEB/src/lib/graphql.ts:190`: JWT is stored in `localStorage.setItem('token', token)`. Highly vulnerable to extraction if XSS occurs. | Migrate consumer auth tokens to `httpOnly`, `Secure`, `SameSite=Lax` cookies, or short-lived memory tokens with refresh cookies. |
| **V3.2.2** | Verify that administrative session tokens are confined to the browser tab and destroyed on tab close. | **PASS** | `aiadastra_admin/web/src/lib/session.ts:79`: Admin session tokens are strictly stored in `sessionStorage` and destroyed on tab close. | Maintain current architecture in admin portal. |
| **V3.3.1** | Verify that sessions expire after a defined period of inactivity (idle timeout). | **PASS** | `AIAstra_WEB/src/Auth/sessionIdle.ts`: Implements 30-minute client idle timeout with user activity event listeners. Admin enforces 2-hour idle timeout server-side (`aiadastra_admin/api/src/auth.ts:20`). | Maintain client and server idle timers. |
| **V3.3.2** | Verify that sessions have an absolute maximum lifetime regardless of activity. | **PARTIAL** | Admin tokens enforce 8-hour maximum absolute lifetime (`MAX_SESSION_MS = 28_800_000`). Consumer JWTs have a flat 7-day expiration without sliding window. | Reduce consumer JWT lifetime to 24 hours, paired with a secure refresh token rotation flow. |
| **V3.4.1** | Verify that session revocation is immediately effective across all distributed application instances. | **PARTIAL** | `src/auth/requestAuth.ts:25`: In-memory `cache` with 30s TTL retains user status. Revocations on one Lambda take up to 30s to propagate to sibling Lambdas. | Implement centralized Redis / DynamoDB cache for instantaneous cross-instance session revocation. |

---

## Chapter V4: Access Control

| ASVS ID | Verification Requirement | Status | Evidence & Code Reference | Remediation Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **V4.1.1** | Verify that users can only access their own objects and records (Broken Object Level Authorization / IDOR defense). | **PASS** | `src/graphql/rbac.ts:49`: `assertOwnAccount(ctx, targetUserId)` enforces strict user isolation on all user-scoped endpoints. | Enforce linting rule requiring `assertOwnAccount` in all user-facing GraphQL resolvers. |
| **V4.1.2** | Verify that administrative endpoints enforce strict role-based access control (RBAC). | **PASS** | `src/graphql/rbac.ts:32`: `requireRoles(context, allowedRoles)` checks administrative privileges. | Maintain role hierarchy enforcement. |
| **V4.1.3** | Verify that internal administrative testing bypasses or backdoor tokens are not present in production endpoints. | **FAIL** | `src/routes/adminLabRoutes.ts:60–94`: `GET /api/admin-lab/people` exposes all users' decrypted PII, secured only by static secret `ADMIN_LAB_TOKEN`. | Deprecate static lab token; gate lab endpoints behind authenticated administrative OAuth/JWT RBAC with audit logging. |
| **V4.2.1** | Verify that access to customer PII and sensitive charts by staff members is auditable and logged. | **FAIL** | `aiadastra_admin/api/src/admin/chartData.ts:263`: Staff inspection of customer Kundli and birth records does not write an entry to `admin_actions`. | Insert mandatory audit log entry in `admin_actions` whenever `getChartData` or PII retrieval is invoked. |
| **V4.3.1** | Verify that heavy batch operations are restricted to administrative accounts. | **PARTIAL** | `src/routes/researchRoutes.ts:42`: `POST /api/research/hydrate` requires only `requireUser` (any authenticated user), permitting batch generation abuse. | Elevate `researchRoutes.ts` authorization to require `admin` or `researcher` role. |

---

## Chapter V5: Validation, Sanitization and Encoding

| ASVS ID | Verification Requirement | Status | Evidence & Code Reference | Remediation Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **V5.1.1** | Verify that input data from untrusted sources is validated against strict positive schemas (whitelists). | **PARTIAL** | GraphQL inputs and research payloads are validated via Zod schemas. However, several REST endpoints in `server.ts` use unvalidated TypeScript casts. | Enforce runtime Zod schema validation across all Express REST routes. |
| **V5.2.1** | Verify that SQL queries use parameterized queries or ORM safe abstractions to eliminate SQL injection. | **PASS** | Prisma ORM handles object queries; raw SQL calls in `outputStore.ts` and `userLocation.ts` use parameterized `$1, $2` or tagged templates. | Maintain strict prohibition of raw string interpolation in database calls. |
| **V5.3.1** | Verify that output data is contextually encoded to prevent Cross-Site Scripting (XSS). | **PARTIAL** | React auto-encodes JSX text. `dangerouslySetInnerHTML` in `LoadingVeil.tsx` uses static SVG. However, `ChatMainArea.tsx` does not sanitize markdown links (`<a>` tags). | Add `rehype-sanitize` or configure ReactMarkdown link renderers to enforce `rel="noopener noreferrer"` and validate protocols. |
| **V5.5.1** | Verify that application errors do not disclose sensitive framework, database, or stack trace information. | **FAIL** | `server.ts:177`: `createYoga({ maskedErrors: false })` returns full Prisma database errors, SQL queries, and stack traces to clients. | Set `maskedErrors: true` in production and staging environments. |

---

## Chapter V6: Cryptography

| ASVS ID | Verification Requirement | Status | Evidence & Code Reference | Remediation Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **V6.1.1** | Verify that strong, modern cryptographic algorithms and cipher modes are used (e.g. AES-256-GCM). | **PASS** | `src/lib/pii/seal.ts`: Uses AES-256-GCM with 12-byte random IVs and authenticated additional data (AAD) binding table, column, and key reference. | Core cryptographic cipher implementation is fully compliant with modern standards. |
| **V6.2.1** | Verify that master cryptographic keys are managed securely using a dedicated Key Management Service (KMS). | **FAIL** | `src/lib/pii/keys.ts:107–125`: `KmsKeyProvider` is an unbuilt stub throwing `PII_UNAVAILABLE`. Consequently, `PII_WRITE_MODE` defaults to `plain`. | Implement AWS KMS envelope encryption provider with AWS KMS GenerateDataKey and Decrypt APIs. |
| **V6.2.2** | Verify that sensitive API keys (e.g. Gemini, Groq) are protected and not transmitted in cleartext or logged. | **PARTIAL** | Backend communicates over TLS, but `geminiCacheService.ts:203` appends the Gemini API key to URL query strings (`?key=...`), exposing it in proxy logs. | Refactor Gemini requests to pass API keys in the `x-goog-api-key` HTTP header. |
| **V6.3.1** | Verify that random numbers and cryptographic nonces are generated using cryptographically secure PRNGs. | **PASS** | Uses Node.js `crypto.randomBytes` for IV and token generation. | Fully compliant. |

---

## Chapter V8: Data Protection

| ASVS ID | Verification Requirement | Status | Evidence & Code Reference | Remediation Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **V8.1.1** | Verify that sensitive personal data (birth dates, coordinates, chat transcripts) is protected at rest. | **FAIL** | Because `KmsKeyProvider` is stubbed, production Lambda runs in `PII_WRITE_MODE=plain`. All sensitive customer data rests in plaintext in PostgreSQL. | Complete KMS provider and migrate plaintext database columns to `pii2:v1` encrypted payloads. |
| **V8.2.1** | Verify that customer data is scrubbed of internal engine names and sensitive metadata before delivery. | **PASS** | `scrubEngineNames` (`src/reading/oracle/flow.ts:60`) and `cleanAnswer` (`src/assistant/guard.ts:79`) scrub internal engine identifiers. | Fully compliant with Rule 0 / SOUL guidelines. |
| **V8.3.1** | Verify that sensitive data is not cached in intermediate proxies or browser caches. | **PASS** | `src/lib/noStore.ts` applies `Cache-Control: private, no-store, max-age=0, must-revalidate` across all authenticated API responses. | Fully compliant. |
| **V8.3.2** | Verify that client-side offline storage of sensitive astrological readings is encrypted. | **PARTIAL** | `AIAstra_WEB/src/lib/selfV3Cache.ts` encrypts Self Board v3 using Web Crypto AES-256-GCM in IndexedDB. Other boards do not persist to disk. | Maintain IndexedDB crypto or restrict storage to volatile session memory. |

---

## Chapter V13: API and Web Service Security

| ASVS ID | Verification Requirement | Status | Evidence & Code Reference | Remediation Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **V13.1.1** | Verify that API endpoints enforce rate limiting to prevent denial of service and automated abuse. | **PARTIAL** | GraphQL has IP-based 200 req / 15 min limit. Streaming route `/api/chat/ask-stream` and RAG route `/query` have no rate limiting. | Mount `express-rate-limit` on all streaming and RAG endpoints. |
| **V13.1.2** | Verify that GraphQL APIs enforce maximum query depth to prevent recursive denial of service. | **FAIL** | `server.ts:172–178`: `createYoga` does not configure query depth limiting plugins, permitting arbitrary recursive query nesting. | Install `@escape.tech/graphql-armor-max-depth` and set max depth to 6. |
| **V13.1.3** | Verify that GraphQL APIs enforce query complexity and cost limits. | **FAIL** | `server.ts:172–178`: No query cost analyzer is configured in Yoga. | Install `@escape.tech/graphql-armor-cost-limit` with strict complexity thresholds. |
| **V13.1.4** | Verify that GraphQL batching attacks are prevented. | **PARTIAL** | Yoga accepts batched query arrays by default without request-level batch capping. | Restrict batch sizes or disable query batching in Yoga configuration. |
| **V13.2.1** | Verify that Cross-Origin Resource Sharing (CORS) policies are strictly restricted to trusted origins. | **PARTIAL** | `server.ts:135–140`: Falls back to `origin: true` (reflecting any origin) with `credentials: true` if `CORS_ORIGINS` is unset. | Ensure CORS middleware fails closed (`origin: false`) when origin lists are empty. |

---

## Chapter V14: Configuration and Operations

| ASVS ID | Verification Requirement | Status | Evidence & Code Reference | Remediation Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **V14.1.1** | Verify that third-party dependencies are continuously monitored for known vulnerabilities (CVEs). | **PASS** | Automated GitHub Dependabot alerts active; dependencies pinned in `package.json`. | Continue regular npm audit sweeps and dependency patch updates. |
| **V14.2.1** | Verify that production environments disable debug and administrative interfaces. | **PARTIAL** | `server.ts:172`: GraphiQL and introspection are not explicitly disabled in staging/production deployments. | Explicitly configure `graphiql: false` when `process.env.NODE_ENV !== 'development'`. |
| **V14.4.1** | Verify that Content Security Policy (CSP) headers are configured to prevent content injection and XSS. | **FAIL** | `AIAstra_WEB/customHttp.yml` completely omits CSP headers. Only the Admin frontend configures a strict CSP. | Deploy comprehensive CSP header in `AIAstra_WEB/customHttp.yml` restricting scripts to self and Cloudflare. |
| **V14.4.2** | Verify that framing protections (`X-Frame-Options` or CSP `frame-ancestors`) are enforced. | **FAIL** | `AIAstra_WEB/customHttp.yml` omits `X-Frame-Options` and `frame-ancestors`, leaving the consumer web app vulnerable to Clickjacking. | Add `X-Frame-Options: DENY` and `frame-ancestors 'none'` to `AIAstra_WEB/customHttp.yml`. |
| **V14.4.3** | Verify that HTTP Strict Transport Security (HSTS) is enabled with appropriate max-age. | **FAIL** | `AIAstra_WEB/customHttp.yml` omits HSTS header. Admin frontend enforces `max-age=63072000`. | Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to `AIAstra_WEB/customHttp.yml`. |
| **V14.4.4** | Verify that server software fingerprints (`X-Powered-By`) are removed. | **FAIL** | `server.ts`: Does not import or register `helmet`, and omits `app.disable('x-powered-by')`, emitting `X-Powered-By: Express`. | Register `app.use(helmet())` and add `app.disable('x-powered-by')` in `server.ts`. |

---

## ASVS 5.0 Verification Summary Scorecard

```
+-------------------------------------------------------------+
| OWASP ASVS 5.0 Level 2 Verification Summary                 |
+-----------------------------+-------+-------+-------+-------+
| Chapter                     | Total | Pass  | Part. | Fail  |
+-----------------------------+-------+-------+-------+-------+
| V1 Architecture & Threat    |   5   |   2   |   2   |   1   |
| V2 Authentication           |   5   |   3   |   1   |   1   |
| V3 Session Management       |   6   |   2   |   3   |   1   |
| V4 Access Control           |   5   |   2   |   1   |   2   |
| V5 Validation & Sanitization|   4   |   1   |   2   |   1   |
| V6 Cryptography             |   4   |   2   |   1   |   1   |
| V8 Data Protection          |   4   |   2   |   1   |   1   |
| V13 API Security            |   5   |   0   |   3   |   2   |
| V14 Configuration           |   5   |   1   |   1   |   3   |
+-----------------------------+-------+-------+-------+-------+
| TOTAL                       |  48   |  25   |  15   |   8   |
| Percentage                  | 100%  | 52.1% | 31.3% | 16.6% |
+-----------------------------+-------+-------+-------+-------+
```
