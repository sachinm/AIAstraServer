# Third-Party and Open-Source Code Attributions

This repository and the AI AdAstra platform incorporate open-source and third-party software libraries, SDKs, and architectural components. We gratefully acknowledge the creators and maintainers of these projects.

---

## 1. Astrological Calculation Engine

### pyjhora / Swiss Ephemeris (`AIAstra_Radha`)
- **Authors**: P.V.R. Narasimha Rao (`pyjhora`), Astrodienst AG (`Swiss Ephemeris` / `pyswisseph`)
- **License**: Swiss Ephemeris Public License / GNU GPL
- **Usage**: Authoritative source of planetary longitudes, ascendant calculation, divisional charts (D1–D60), dasha systems (Vimshottari, Narayana, Chara), transit contacts, and panchang calculations. Node.js never computes astrological positions directly; all astronomical and astrological calculations are delegated to `AIAstra_Radha`.

---

## 2. Server & API Architecture (`AIAstra_Server`)

### GraphQL Yoga
- **Maintainer**: The Guild (`graphql-yoga`)
- **License**: MIT
- **Usage**: HTTP GraphQL execution engine, SSE subscriptions, context construction, and extensible plugin lifecycle (`onExecute`, `onValidate`, `onResultProcess`).

### GraphQL Armor
- **Maintainer**: Escape Technologies (`@escape.tech/graphql-armor`)
- **License**: MIT
- **Usage**: AST validation and query protection: query depth limiting, alias capping, selection limiting, and cost controls to prevent denial-of-service and resource exhaustion attacks.

### Prisma ORM
- **Maintainer**: Prisma Data, Inc. (`@prisma/client`, `prisma`)
- **License**: Apache 2.0
- **Usage**: Type-safe PostgreSQL object-relational mapping, declarative migrations (`prisma migrate`), connection pooling via Render PgBouncer (`:6432`), and encrypted model extensions.

### Helmet
- **Maintainer**: Helmet Core Team (`helmet`)
- **License**: MIT
- **Usage**: HTTP response security headers (disabling `x-powered-by`, enforcing framing and type protections).

### Express
- **Maintainer**: OpenJS Foundation (`express`)
- **License**: MIT
- **Usage**: Core HTTP server, routing, middleware orchestration, and SSE transport endpoints.

### JSON Web Token (`jsonwebtoken`)
- **Maintainer**: Auth0 / Okta
- **License**: MIT
- **Usage**: Signing and verification of session claims and token-version enforcement.

### bcryptjs
- **Maintainer**: Daniel Schwarz, Max Antipin
- **License**: MIT
- **Usage**: Cryptographic hashing of user credentials, magic link codes, and OTP attempt verification.

---

## 3. Web Client Architecture (`AIAstra_WEB`)

### React & React DOM
- **Maintainer**: Meta Platforms, Inc. (`react`, `react-dom`)
- **License**: MIT
- **Usage**: UI component lifecycle, virtual DOM rendering, state management, and `<GlobalErrorBoundary>` crash isolation.

### Cloudflare Turnstile React
- **Maintainer**: Marsi Bionics / `@marsidev/react-turnstile`
- **License**: MIT
- **Usage**: Privacy-preserving bot detection and CAPTCHA defense on sign-in and sign-up flows.

### MediaPipe Tasks Vision
- **Maintainer**: Google LLC (`@mediapipe/tasks-vision`)
- **License**: Apache 2.0
- **Usage**: Client-side face landmark detection and selfie alignment checks for palm/photo features.

### Lucide React
- **Maintainer**: Lucide Contributors (`lucide-react`)
- **License**: ISC
- **Usage**: Vector iconography for dashboard navigation, status indicators, and modal interfaces.

### Vite & Rollup
- **Maintainer**: Yuxi (Evan) You and Vite Contributors (`vite`, `rollup`)
- **License**: MIT
- **Usage**: Build toolchain, development server, and production bundle chunking.

### Tailwind CSS
- **Maintainer**: Tailwind Labs, Inc. (`tailwindcss`)
- **License**: MIT
- **Usage**: Utility-first CSS styling, theme definitions, and responsive layout classes.

---

## 4. Cloud Services & Provider SDKs

### AWS SDK for JavaScript (v3)
- **Maintainer**: Amazon Web Services (`@aws-sdk/*`)
- **License**: Apache 2.0
- **Usage**: AWS Key Management Service (KMS envelope encryption), Amazon DynamoDB, and Amazon Cognito identity pools.

### Google Generative AI / Gemini API
- **Maintainer**: Google LLC
- **License**: Google Cloud Platform Terms of Service
- **Usage**: Context-cached LLM synthesis, multi-school astrological synthesis, and semantic narrative generation.
