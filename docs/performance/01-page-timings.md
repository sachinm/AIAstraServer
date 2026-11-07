# Page timings: how long each page takes for real users

Plan, written 2026-11-01. No code yet. Covers the homepage, sign-in, sign-up, the Turnstile security check and the charts page.

## 1. Start

Nothing tracks page speed today. The web has no `performance.*` calls and no timing library. Google Analytics is loaded (`AIAstra_WEB/index.html:34`) but sends no timings.

**The pages**

| Page | Route | Component | "Loaded" means |
|---|---|---|---|
| Homepage | `/` | `src/LandingPage.tsx` | Landing page rendered |
| Sign-in | `/signin` | `src/Auth/SignIn.tsx` | Form rendered |
| Sign-up | `/signup` | `src/Auth/SignUp.tsx` | Form rendered |
| Turnstile | inside sign-in and sign-up | `src/Auth/TurnstileField.tsx` | Token received, because submit is blocked until then (`SignIn.tsx:90-91`) |
| Charts | `/dashboard/charts` | `src/pages/charts/ChartsSection.tsx` | Data shown, or the error or empty state |

The request named `/dashboards/chart/`. That route does not exist; `/dashboard/charts` (`routes.tsx:130`) is the page meant. Today it fetches and shows birth details only (`fetchUserBiodata`), not charts. The chart tables are in the chat sidebar for research accounts.

**Facts checked**

- The web is one Vite single-page app with no code splitting: `routes.tsx:2-20` imports every page up front. Every page's first visit downloads the same bundle, 178 KB transferred (637 KB raw in a local build).
- Every route serves the same 2,528-byte HTML shell from Amplify's CloudFront, so server response time says almost nothing about the page. The time goes to the bundle, Turnstile and API calls.
- Hashed assets are served with `Cache-Control: public, max-age=0, s-maxage=31536000`, so browsers revalidate them on every visit.
- The Turnstile script loads twice on sign-in and sign-up: once from `index.html:32`, once injected by `@marsidev/react-turnstile`. Both URLs were seen in the browser. `index.html:32` also loads it on pages that have no widget.
- The charts page waits for `ProfileGate` (`fetchMe`, `fetchPlanState`) and then for the GraphQL biodata call on the API Lambda, so a Lambda cold start lands here.
- A GET with a query string reaches the API through CloudFront: `/api/billing/plans?region=IN` and `?region=US` returned different answers, with `no-store` and `X-Cache: Miss`.
- POST to the API needs an `x-amz-content-sha256` header (`src/lib/apiHeaders.ts:48`), so `navigator.sendBeacon` cannot be used. Custom headers also trigger a CORS preflight, which `https://vedic-astrology.app` still fails (`docs/TODOS.md:19`).
- `aiastra-ops-deployer` cannot read CloudWatch Logs or the CloudFront config (`docs/TODOS.md:172`, denied again today).

**First rough numbers** (one machine near San Francisco, a handful of requests, not a baseline)

| Page | HTML first byte, curl | Browser first byte | Browser load event |
|---|---|---|---|
| Homepage | 63–134 ms | 265 ms | 732 ms, first visit |
| Sign-in | 85–167 ms | 231 ms | 365 ms, bundle cached |
| Sign-up | 244–833 ms | 137 ms | 219 ms, bundle cached |
| Charts | 86–183 ms (shell only) | not measured | needs a signed-in session |

On sign-in, the Turnstile widget's frame request finished at 677 ms. Paint and LCP were not available because the test pane ran as a background page. Real user numbers will differ, above all on phones and from India, which is why this plan measures real users.

## 2. End goal

For each page, Sachin can see the typical (p50) and slow (p75, p95) load time, split by phone or desktop, first visit or in-app navigation, and country once the country header works. Each load shows where the time went: server, bundle, first paint, Turnstile, API. A slow page can be traced to a cause, and a release that slows a page shows up within a day of traffic.

Users see no change. Pages get no slower, and a failed measurement is never visible. No name, email, user id, IP, birth data or URL is recorded.

## 3. Deliverable

**Server**
- `src/routes/pageTimingRoutes.ts`: `GET /api/page-timing`, registered next to the others at `server.ts:313`.
- `tests/unit/pageTiming.test.ts`.

**Web**
- `src/lib/pageTiming.ts` (about 120 lines, no new dependency) and its test.
- Small changes to `routes.tsx`, `LandingPage.tsx`, `SignIn.tsx`, `SignUp.tsx`, `TurnstileField.tsx`, `ChartsSection.tsx`, `ProfileGate.tsx`.
- One line in the privacy page (`src/pages/legal/LegalPages.tsx`).
- `e2e/page-timings.spec.ts` and `npm run perf:check`.

**Infra**
- Retention of 90 days on the API Lambda's log group, if not already set. No new AWS resources, migrations or env vars.

**Docs**
- The saved query in section 4 and, after a week, a baseline table and budgets in this file.

## 4. Exactly how it works when done

### Backend

1. `GET /api/page-timing?...` arrives with no auth or cookies.
2. The route checks the query against the contract below. Unknown routes or values, or a query over 512 bytes, are dropped. Numbers outside 0–120,000 become null.
3. It adds `country` from `viewerCountry(req)` (`src/billing/geo.ts:5`) and writes one JSON line with `process.stdout.write`, so CloudWatch sees pure JSON with no runtime prefix.
4. It returns 204 with `Cache-Control: no-store`. It does no database, Radha or model work and takes about a millisecond plus Lambda overhead. It logs no IP, user agent or other header.

Rough cost is about 1 cent per 10,000 page views (20 ms at 2 GB, the request charge, and 400-byte log lines), from list prices as remembered, plus any cold starts. WAF already sits in front. The worst abuse is extra log lines, because nothing touches the database.

A Function URL instance serves one request at a time, so a beacon that overlaps a real API call can force a cold start for one of them. That is why the beacon goes out after the page is ready, not during load.

### API

`GET /api/page-timing`, always 204 with an empty body, including for rejected input. The client never reads the response.

| Param | Log field | Values |
|---|---|---|
| `v` | `v` | `1` |
| `r` | `route` | `home`, `signin`, `signup`, `charts` |
| `n` | `nav` | `hard` (full page load), `spa` (in-app navigation) |
| `s` | `status` | `ok`, `error`, `empty`, `abandoned` (left before ready) |
| `ready` | `ready` | Page usable |
| `ttfb`, `fcp`, `lcp`, `dom`, `load` | same | Browser timings, `hard` only |
| `js` | `js` | Main bundle finished downloading, `hard` only |
| `tss` | `ts_script` | First Turnstile script finished, `hard` only |
| `tsw` | `ts_widget` | Widget loaded |
| `tst` | `ts_token` | Token received |
| `tsr` | `ts_result` | `ok`, `error`, `expired`, `timeout` |
| `tsi` | `ts_interactive` | `1` if the person had to act, so `ts_token` includes human time |
| `gate` | `gate` | `ProfileGate` opened, charts only |
| `api` | `api` | Biodata call duration, charts only |
| `d` | `device` | `m` (under 768 px wide), `d` |
| `c` | `conn` | `slow-2g`, `2g`, `3g`, `4g`, or absent (Chrome only) |
| `b` | `build` | Hash of the main bundle file name, 8–12 of `[A-Za-z0-9_-]` |
| `h` | `hidden` | `1` if the tab was hidden at any point before ready |

All times are whole milliseconds from the start of that page view, on one clock, except `api`, which is a duration.

### Frontend experience

`pageTiming.ts` exports `markReady(route, status)`, `markTurnstile(event)`, `markGate()` and `markApi(ms)`.

- **Start of a view.** A hard load starts at the browser's time origin. A watcher next to `<SeoHead />` (`routes.tsx:51`) restarts the clock on every location change, so a redirect (signed-out `/dashboard/charts` to `/signin`) reports only the page that rendered.
- **Ready.** A two-frame `requestAnimationFrame` after the page's own effect, so it reflects paint, not just React commit.
- **Sending.** One beacon per view, sent 2 s after ready, or on the first `visibilitychange` to hidden. Sign-in and sign-up wait for the Turnstile token or error, up to 15 s, and then report `ts_result=timeout`. A view that never became ready sends `status=abandoned` when the tab is hidden.
- **Transport.** `fetch(url, { method: 'GET', mode: 'no-cors', keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer' })`. This needs no preflight and no body hash, so it works on the public domain despite the CORS finding. Errors are swallowed.
- **Skipped when.** `navigator.webdriver` is true (tests, prerender at build) or the API base URL is empty.
- **Browser gaps.** Safari may not report LCP, so `lcp` is null there and `ready` still works. A prerendered homepage (`feat/prerender-public-pages`, merged on web `develop`, not live yet) paints before hydration, so compare `fcp` and `ready` there.

Screens do not poll or stream anything new.

### UI/UX

Nothing on screen changes. The only visible words are one sentence on the privacy page, after the list at `LegalPages.tsx:205-214`:

> We record how long pages take to load, with no account details or personal information attached, to keep the Service fast.

### Reading the numbers

CloudWatch Logs Insights on the API Lambda's log group. Save this as `page-timings`:

```
filter type = "page_timing" and hidden = 0 and status = "ok"
| stats count(*) as views, pct(ready, 50) as ready_p50, pct(ready, 75) as ready_p75, pct(ready, 95) as ready_p95,
        pct(ttfb, 75) as ttfb_p75, pct(fcp, 75) as fcp_p75, pct(lcp, 75) as lcp_p75,
        pct(ts_token, 75) as turnstile_p75, pct(gate, 75) as gate_p75, pct(api, 75) as api_p75
  by route, nav, device
| sort route, nav, device
```

Failed and abandoned loads, which a speed query would hide:

```
filter type = "page_timing" | stats count(*) as views by route, status, ts_result | sort route
```

## 5. Architecture

```
Browser (Amplify site)
  pageTiming.ts: reads browser timings, marks ready, Turnstile, gate, API
    | one GET after the page is ready, no cookies, no custom headers
    v
CloudFront E3UPJNUU8APCT (WAF, OAC) -> Lambda aiastra-server-api -> /api/page-timing
    | one JSON line on stdout, then 204
    v
CloudWatch Logs -> Logs Insights query
```

Boundary guarantees:
- The browser never waits for or depends on the beacon.
- The server stores only allowlisted values.
- The data stays in AWS, which fits the direction of the privacy work.

| Option | Verdict |
|---|---|
| **Log line, Logs Insights (chosen)** | No database, migration, new service or dependency. Percentiles built in. Ships with the normal Lambda and web deploys |
| Postgres table, like `reading_traces` | An open, unauthenticated route would write to the main database, on a `connection_limit=1` pool. Needs a migration and retention job |
| Google Analytics events | Already loaded, but weak on percentiles, blocked by ad blockers, and sends more to Google when the aim is to keep data in AWS |
| CloudWatch RUM | Stays in AWS, but adds a client script and an identity pool, and Turnstile and API timings would be custom events anyway |
| `web-vitals` library | About 2 KB and handles edge cases, but the fields needed take a few lines of native API. INP and CLS can bring it in later |

## 6. Ingredients

| Need | Who |
|---|---|
| Server route, web module, tests, spec | Agent |
| Worktrees for both repos | Haiku sub-agent, per `AGENTS.md`. No dependency is added |
| Lambda and Amplify deploys, log retention | Deploy session, with Sachin's OK |
| Reading the logs | Sachin in the console until the CloudWatch grant lands (`docs/TODOS.md:172`). Then agents too |
| Signed-in test account for the charts check | Sachin signs in during the staging check |

No test account login is automated, because sign-in needs an emailed code.

## 7. Action steps in sequence

1. **Contract frozen.** This file's API table is the contract. Done: reviewed.
2. **Server route** (parallel with 3). Files: `src/routes/pageTimingRoutes.ts`, `server.ts`, `tests/unit/pageTiming.test.ts`. Done: tests cover a valid line, a rejected route, out-of-range numbers, an oversized query and no IP in the output; `tsc` is green.
3. **Web module** (parallel with 2). Files: `src/lib/pageTiming.ts` and test. Done: tests cover one beacon per view, sending on hidden, abandoned, the 15 s Turnstile cap and skipping under webdriver.
4. **Wire the pages** (after 3). Files: as in section 3. Done: `tsc`, `npm run test:run` and `npm run test:walkthrough` are green.
5. **Privacy line** (parallel with 4). File: `LegalPages.tsx`.
6. **Merge** both branches `--no-ff` into each repo's `develop`. Web is cut from `develop` in its own worktree, because the web checkout is on `fix/landing-trim-nav-cards` with uncommitted edits in `routes.tsx`, `SignIn.tsx`, `SignUp.tsx`, `LandingPage.tsx`, `ChartsSection.tsx` and `LegalPages.tsx`. Whichever lands second resolves small conflicts.
7. **Deploy** through the deploy session: API Lambda first, because a beacon to a missing route is harmless, then the web to staging. Set log retention.
8. **Staging check.** Open the five surfaces on the staging URL, signed out and then signed in. Done: a line for each route in Logs Insights, with a screenshot of the query result, and no personal data in any line.
9. **Synthetic check** (parallel with 8). File: `e2e/page-timings.spec.ts`. Runs the public pages against a given URL, 5 cold loads each, desktop and throttled phone, and prints a table. Done: `npm run perf:check` prints numbers for staging.
10. **Production**, once the public domain's branch is decided (`docs/TODOS.md:375`).
11. **Baseline.** After a week of traffic, or 100 views a page if sooner, write the table and budgets here.

## 8. Development phases

**Phase 1: measuring (steps 1–8).** Closes when staging shows lines for all four routes with Turnstile and charts fields filled. Leaves the site unchanged for users.

**Phase 2: baseline and budgets (steps 9–11).** Closes when this file has real numbers and budgets. Starting budgets at p75, phone, first visit, to be revised against the data:

| Page | Budget |
|---|---|
| Homepage | LCP 2.5 s |
| Sign-in, sign-up | Ready 2.0 s |
| Turnstile | Token 3.0 s, non-interactive |
| Charts | Ready 3.0 s |

**Deferred.**
- Fixes for what the numbers show. The likely first ones are filed in `docs/TODOS.md`: the double Turnstile script, asset cache headers and route code splitting.
- A dashboard screen and alarms. Logs Insights is enough until a budget is being defended.
- INP, CLS and timing the other pages (chat, pricing, profile).

## 9. Recommendation

Build the log-line beacon: a no-cors GET to a small validating route, with CloudWatch Logs Insights for reading. It is the lightest thing that gives real-user percentiles per page, stays in AWS, has no database risk, and does not depend on the CORS fix.

Real users can only produce charts numbers where sign-in works. On the public domain that waits on `docs/TODOS.md:19`, so until that is fixed the charts numbers come from the staging URL.
