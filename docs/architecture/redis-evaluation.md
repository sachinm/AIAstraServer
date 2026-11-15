# Pre-Phase-4 Redis Architecture Gate & Cost Analysis

## 1. Executive Summary & Context

As part of the enterprise remediation roadmap (Phase 2 & Phase 3), AIAstra core backend services operate across AWS Lambda (`aiastra-server-api`) and Render PostgreSQL (`:6432` PgBouncer transaction pooling mode). As traffic scales toward Phase 4, cross-Lambda state synchronization, distributed session revocation, and fine-grained rate limiting require an ultra-low latency distributed in-memory data store.

This evaluation assesses three candidate Redis architectures prior to the Phase 4 gate:
1. **Upstash Serverless Redis** (HTTP/REST + TCP dual protocol)
2. **AWS ElastiCache (VPC)** (Cluster mode / Serverless in AWS VPC)
3. **Render Redis** (Managed persistent Redis instance on Render)

---

## 2. Architectural Use Cases

The target Redis deployment will support three mission-critical workflows:

1. **Distributed Session Caching (`session_caching`)**:
   - Validation and rapid revocation of `aastra_jwt` session cookies and refresh tokens without hammering Render PostgreSQL.
   - PII-safe token blacklisting for 15-minute OTP lockouts (`ACCOUNT_LOCKED`).
2. **Distributed Rate Limiting (`rate_limiting`)**:
   - Sliding-window rate limit counters across distributed Lambda invocations for OTP dispatch, GraphQL queries, and astronomical calculation requests.
   - Eliminates distributed race conditions during concurrent brute-force attacks.
3. **SSE Pub/Sub & Stream Continuation (`sse_pub_sub`)**:
   - State synchronization for resumable generative AI chat turns (`POST /api/chat/ask-stream` and `GET /api/chat/resume-stream`).
   - Buffering emitted SSE sequence tokens (`seq`) for instant reconnects within the 10-second SLA.

---

## 3. Comparative Provider Evaluation

| Feature / Metric | Upstash Serverless | AWS ElastiCache (VPC) | Render Redis |
|---|---|---|---|
| **Protocol Support** | HTTP / REST & Standard Redis TCP | Standard Redis TCP | Standard Redis TCP |
| **AWS Lambda Compatibility** | **Optimal** (HTTP REST avoids connection exhaustion) | Requires VPC & ENI cold-start overhead | Requires public ingress or VPN |
| **Connection Pooling** | Stateless HTTP requests or pooled TCP | Requires persistent TCP pool (problematic on ephemeral Lambda) | Ephemeral connection pooling |
| **VPC Peering Required** | No (HTTPS API with token auth) | Yes (Private VPC subnets required) | No (via public TLS endpoint) |
| **P99 Read Latency** | 8–15 ms (REST) / <2 ms (Global Edge) | <1.5 ms (inside same VPC) | 25–45 ms (cross-cloud Render to AWS) |
| **Automatic Scaling** | True Serverless (pay-per-request) | Serverless data units or provisioned nodes | Tier upgrades require manual restart |
| **High Availability** | Multi-zone active replication | Multi-AZ replication with auto-failover | High-tier only |

---

## 4. Monthly Cost Breakdown Across Environments

Estimated monthly infrastructure costs across lifecycle environments based on projected request volumes:

| Environment | Estimated Workload | Upstash Serverless | AWS ElastiCache | Render Redis |
|---|---|---|---|---|
| **Development (`dev`)** | <10,000 commands/day, local developer tests | **$0.00** (Free tier: 10k cmds/day) | $15.00 (cache.t4g.micro) | $0.00 (Render Free trial) |
| **Staging (`staging`)** | 500,000 commands/month, synthetic QA cohorts | **$15.00** ($0.20 per 100k cmds + storage) | $18.50 (t4g.micro + NAT Gateway) | $10.00 (Render Starter) |
| **Production (`prod`)** | 25,000,000 commands/month (~100k MAU) | **$60.00** (Capped pro tier / pay-as-you-go) | $95.00 (cache.t4g.small + Multi-AZ) | $75.00 (Render Standard 1GB) |

---

## 5. Lambda Concurrency, Connection Pooling & Network Topologies

### 5.1 The Ephemeral Lambda Concurrency Challenge
AWS Lambda functions scale by launching independent container instances. Under high traffic bursts (e.g., 500 concurrent invocations):
- **Traditional Redis TCP (ElastiCache / Render)**: Each container initiates 1–5 persistent TCP connections. 500 containers create 500–2,500 active sockets. When containers are frozen or abruptly terminated during scale-down, half-closed TCP connections remain on the Redis server until timeout (`tcp-keepalive`), exhausting the Redis max-client limit (often 10,000 on smaller nodes) and driving file descriptor exhaustion.
- **Upstash REST/HTTP Protocol**: Requests are executed via standard stateless HTTPS `fetch()` calls. Node.js `undici` / `keep-alive` HTTP agent pools can reuse HTTPS sockets across warm invocations without stateful server-side socket pinning. If a Lambda freezes, no half-open socket is held against a server connection table.

### 5.2 VPC Peering vs Direct HTTPS Ingress
- **AWS ElastiCache**: Lambda must run inside an AWS VPC with subnets and Security Groups. To access external APIs (e.g., Gemini LLM API, Google Maps, Render DB), Lambda requires an AWS NAT Gateway ($32.40/month baseline per AZ + $0.045/GB data processing). Cold starts for Lambda in VPC historically suffered from ENI provisioning delays (mitigated in modern AWS Hyperplane ENIs to ~300ms, but still non-zero).
- **Upstash Serverless**: Communicates over public HTTPS with TLS 1.3 and bearer token authentication. Lambda stays outside VPC, avoiding NAT Gateway infrastructure costs and eliminating VPC peering routing tables.

---

## 6. Failure Modes, Circuit Breaker & Fail-Open / Fail-Closed Design

A resilient distributed caching architecture requires strict failure domain isolation. The system must never allow a Redis disruption to crash user-facing APIs.

### 6.1 Policy Matrix: Fail-Open vs Fail-Closed

| Use Case | Policy | Rationale | Fallback Mechanism |
|---|---|---|---|
| **API Rate Limiting** | **Fail-Open** | A Redis outage must not block legitimate paying users from querying their charts or dashboards. | Allow request through; log warning to CloudWatch and record `rate_limit_redis_unavailable` in `app_error_events`. |
| **Astronomical Calculation Caching** | **Fail-Open** | Cache miss fallback. | Compute via Radha / database and continue without failing. |
| **Resumable Chat SSE Buffer** | **Fail-Open** | Stream buffer unavailable. | Client falls back to full turn re-query; stream continues without reconnection history. |
| **Account Lockout / Brute-Force (`ACCOUNT_LOCKED`)** | **Fail-Closed** | Security-critical; must prevent brute-force attacks during Redis degradation. | Fall back to synchronous Render PostgreSQL query (`failed_otp_attempts` / `otp_locked_until`). If DB also fails, return `503 auth_unavailable`. |
| **Session Revocation (`aastra_jwt`)** | **Fail-Closed** | Explicitly logged out or compromised tokens must not be accepted. | Fall back to database session verification (`AccountAuthFailure` / token blacklist in DB). |

### 6.2 Circuit Breaker & Timeout Budgets
- **Strict Client Timeout**: All Redis operations from AWS Lambda enforce an aggressive timeout (`REDIS_TIMEOUT_MS = 150ms`). If Redis does not reply within 150ms, the operation aborts and triggers the fallback path.
- **In-Memory Circuit Breaker**: If 5 consecutive Redis operations fail or time out within a 30-second window, the circuit opens for 60 seconds (`CIRCUIT_OPEN`), routing all operations directly to local fallback paths without paying the 150ms latency penalty.

---

## 7. Phase 4 Implementation Roadmap & Milestones

The deployment of Upstash Redis into AIAstra is structured across five verifiable milestones in Phase 4:

1. **Milestone 4.1: Client SDK & Config Scaffolding**:
   - Install `@upstash/redis` and define typed client wrapper in `src/lib/redis/client.ts`.
   - Wire environment variables into `src/config/env.ts`: `REDIS_REST_URL`, `REDIS_REST_TOKEN`, `REDIS_ENABLED` (boolean toggle), `REDIS_TIMEOUT_MS` (default `150`).
   - Implement unit tests with mock HTTP responses and timeout simulators.
2. **Milestone 4.2: Distributed Rate Limiting**:
   - Implement sliding-window rate limiter via Upstash `@upstash/ratelimit` (token bucket or sliding window algorithm).
   - Integrate into `/api/auth/send-code`, GraphQL armor, and expensive chart calculation endpoints.
   - Verify fail-open behavior when `REDIS_REST_URL` is unreachable.
3. **Milestone 4.3: Session Invalidation & Token Blacklist**:
   - Cache active JWT session validity flags with 15-minute TTL.
   - On password reset, logout, or account lockout, push token ID / user ID to Redis blacklist with TTL matching token lifetime.
   - Verify fallback to PostgreSQL on cache miss or Redis error.
4. **Milestone 4.4: Resumable SSE Chat Streaming**:
   - Buffer outgoing SSE tokens (`seq`, `chunk`) in Redis list/hash with 10-minute sliding TTL.
   - Support `GET /api/chat/resume-stream?sessionId=...&afterSeq=...` allowing immediate reconnects without losing model output.
5. **Milestone 4.5: Telemetry, Observability & Chaos Testing**:
   - Track Redis P50, P95, P99 latency and cache hit/miss rates in `page_execution_logs` (`cache_hits`, `cache_ms`).
   - Run chaos tests simulating 100% packet drop to verify fail-open/fail-closed policies under simulated load.

---

## 8. Architectural Recommendation

**Recommendation**: **Upstash Serverless Redis** is the recommended provider for Phase 4 Lambda deployment.

**Rationale**:
1. **Serverless Lambda Synergy**: AWS Lambda cold starts and ephemeral lifecycles cause TCP connection exhaustion against traditional Redis servers. Upstash provides native REST/HTTP commands (`POST /get`, `POST /set`) that execute stateless queries in 8–12ms without maintaining TCP sockets.
2. **No VPC Cold-Start Overhead**: ElastiCache requires placing Lambda functions inside a VPC, which introduces ENI attachment latency and NAT Gateway costs ($32+/mo base just for NAT egress).
3. **Cost Efficiency**: At dev and staging tiers, Upstash costs $0 to $15/month, scaling smoothly to $60/month at 100k MAU without pre-provisioning idle cluster hardware.
