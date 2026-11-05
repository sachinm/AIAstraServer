# State of encryption and the admin dashboards (2026-11-05)

Sachin asked where the data encryption stands, and where the dashboard is that shows how Happy Hour(s) (lucky times)
works out its good times, categories and sub-categories. Both belong only in the Admin Panel, which is a separate site.
Are they built? This is the answer, checked against the code on 2026-11-05.

## Short answer

| Item | Built? |
|---|---|
| Encryption code (B0 leak fixes, B1 seal/keys/blind index) | Yes, merged to develop (`0f08496` → `37f98c4`) |
| Any field actually encrypted in any database | **No**: `PII_WRITE_MODE=plain` everywhere |
| Encryption B2–B5 (new columns, KMS keys, encrypt rows, drop plain) | **No** |
| Encryption status page in the Admin Panel | **No** |
| Admin Panel site | Yes: users, plans, queries, agent speed and cost |
| Happy Hour(s) techniques dashboard (windows, categories, sub-categories) | **No**, not in either app |
| Research page (house-state engine, doc 46 Part E) | **No** |
| Agent registry and analytics pages in the Admin Panel | **No**: the tables exist, the pages do not |

## 1. Encryption

The plan is `docs/privacy/02-birth-data-charts-and-wire-build-plan.md` §8, in six phases.

- **B0, stop the leaks: built.** No personal data in logs, `/debug/kundli` gone, the model's thinking is not streamed
  to the browser, and responses carry no-store.
- **B1, encryption code with local keys: built.** It lives in `src/lib/pii/`: `fields.ts` (the field list), `keys.ts`,
  `seal.ts`, `blindIndex.ts`, `hash.ts`, `prismaExtension.ts` and `rawSql.ts`.
- **What is encrypted today: nothing.** `PII_WRITE_MODE=plain`, so local, staging and live all store plain text. The
  fields waiting to be encrypted are in `src/lib/pii/fields.ts`: birth columns on `auth`, kundli charts, facts, chats
  and readings.
- **B2, expand migration: not built.** `20261106100000_pii_m26_expand` (`email_bidx`, `key_ref`, `coords`) does not exist.
- **B3, KMS keys on staging: not built.** Waiting on Sachin to create the KMS keys, the DynamoDB key table and the IAM role.
- **B4, encrypt existing rows and the audit script: not built.**
- **B5, drop the plain columns: not built.**

## 2. The Admin Panel

- **Repository:** `C:\Users\Owner\Documents\work\aiadastra_admin` (GitHub `sachinm/aiadastra_admin`). Work goes on
  `develop`; deploys come from `release-candidate-staging`.
- **AWS:** Lambda `aiadastra-admin-api` behind CloudFront `E2G3O5L4YYBUE3`, restricted by IP. Amplify app
  `d1qhwivm0xxltl`, branch `staging`.
- **Domain:** `admin.vedic-astrology.app` still needs two Cloudflare CNAMEs.
- **Pages today:**
  - Sign in, Overview, Users, User detail, Queries, Query detail, Agents (speed and tokens).
  - User detail can lock and unlock, reset quota, change plan or role, and turn the research flag on or off.
- **Planned but missing:**
  - Research (doc 46 Part E).
  - Agent registry (doc 49).
  - Analytics (clicks from `analytics_events`).
  - Encryption status.
  - The admin repo's `docs/TODOS.md` notes that the signed-in pages were never checked in a browser.

## 3. How Happy Hour(s) works out its windows

There is no dashboard. The rules are code, not config:

- **Categories and sub-categories:** `src/reading/luckyTimes/scenarios.ts`. It holds 6 categories (work, love, money,
  travel, study, home) and 13 scenarios. Each scenario lists the tithi groups, star groups, weekdays and hora lords it
  favours or avoids, plus its hours, a minimum score and its classical source.
- **Scoring a window:** `src/reading/luckyTimes/windows.ts` (`scenarioDay`, `personalScore`, `avoidBands`).
- **The written technique:** doc 47 §3 and doc 49 §3.
- **Already filed in TODOS:** the tithi and star groups are meant to move into the engine, since the engine is the
  only source of astrological data.

## 4. Engine details the user app shows today

Each of these needs a decision: keep it for users, or move it behind the Admin Panel.

1. **The "Why" sheet on Happy Hour(s)** shows the traditional window names and the classical source line. This was
   planned for users. The API also sends each window's score and reason codes (`tithi:bhadra`, `hora:Venus`); the page
   does not show them, but anyone can read them in the network tab.
2. **The chat's right sidebar** (`ChatRightSidebar.tsx:207-215`) shows raw biodata, the D1, D7, D9 and D10 charts and
   the dasha to accounts with the research flag. This is an admin view inside the user app.
3. **The Work page** shows "N of 5 families agree" and how each timing family voted. It is meant for users, but it is
   technique detail.

## Recommendation

Build one **Techniques** section in the Admin Panel, read-only and staff-only. It would cover:

- a page per scenario, with its category, rules, source and minimum score;
- a day view for a chosen place and user, showing every window with its score and reason codes.

It reads from the same `scenarios.ts` and `windows.ts` through a new staff-only admin API route, so the user API stops
sending reason codes. The research-flag chart view moves into the same section, and the encryption status page joins it
once B2 lands.

Order of work:

1. Encryption B2, then B3 (once Sachin creates the keys).
2. The Techniques section.
3. The Agent registry and Analytics pages.
4. Research (doc 46).

Each needs its own plan under `docs/admin/` before any code.
