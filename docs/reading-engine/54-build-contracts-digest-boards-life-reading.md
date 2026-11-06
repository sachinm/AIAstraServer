# 54 — Build contracts: digest, techniques in use, Self and Love boards, life reading card, Lucky five limbs

Status: **build contract, 2026-11-06.** The shared interfaces the parallel builds of doc 53 (phases D1–D4) and doc 34
(Part 1, the Executive Dashboard) code against. Every slice reads only these types and endpoints from the others. All
rules of AGENTS.md hold: Node computes nothing astrological (select, count, join, date, sum weights over engine
fields); no paid model call; English only; no engine names in any user-facing string.

## 1. Slices and order

| Slice | Branch (server / web) | Depends on | Owns |
|---|---|---|---|
| S1 Digest core | `feat/digest-core` / — (admin repo for the column) | — | M32, M33, `src/reading/digest/*`, `/events` `kundli-digest`, sweep, admin `digestStatus` + rebuild |
| S2 Lucky five limbs | `feat/lucky-five-limbs` / `feat/lucky-five-limbs` | — | `src/reading/luckyTimes/*`, web `src/pages/lucky/*` |
| S3 Self and Love boards | `feat/self-love-boards` / `feat/self-love-boards` | S1 | `src/reading/area/{self,love,houseLayers}.ts`, `/api/area/self`, `/api/area/love`, web `src/pages/you/*`, `src/pages/love/*` |
| S4 Life reading dashboard | `feat/life-reading-dashboard` / `feat/life-reading-card` | S1 | `src/reading/life/*`, `/api/life-reading`, web card on Profile → Timeline |
| S5 Techniques in use | `feat/techniques-in-use` / — | S1 | `src/techniques/use.ts`, `packs/selector.ts` digest source, `run.ts` / `graph.ts` / `oracle/readers.ts` selection, deterministic readers |

S3, S4 and S5 start from `develop` and `git merge feat/digest-core` once S1 is committed (the parent session tells them).
Shared files and who appends where: `prisma/schema.prisma` (S1 only), `server.ts` (S1 adds the event branch; S3 and S4
each add one `register…Routes` line after `registerAreaRoutes`), `src/techniques/catalog.ts` (each slice edits only its
own rows; S1 adds nothing there except flipping `digest.*` rows to built), `docs/TODOS.md` (append a section per slice).

## 2. S1: the digest (`src/reading/digest/`)

```ts
// types.ts
export const DIGEST_VERSION = 'd1.2026-11-06';
export type DigestSection = 'house' | 'planet' | 'yoga' | 'point' | 'annual' | 'star';
export type DigestStatus = 'pending' | 'building' | 'ready' | 'stale' | 'failed';
export interface DigestSource { type: string; variant: string; calcVersion: string | null; path: string }
export interface HouseCard {
  varga: string;            // 'D1', 'D9' …
  house: number;            // 1..12
  sign: string | null;
  lord: string | null;      // planet code as the engine writes it (Su Mo Ma Me Ju Ve Sa Ra Ke)
  lordHouse: number | null;
  lordSign: string | null;
  lordDignity: string | null;
  coLord: string | null;
  occupants: Array<{ planet: string; dignity: string | null; nature: string | null }>;
  aspectedGraha: string[];
  aspectedRasi: string[];
  argala: { primary: string[]; secondary: string[]; obstructed: string[] } | null;
  sav: number | null;
  class: string[];          // kendra, trikona, dusthana, upachaya, maraka … as the engine labels them
  cuspStar: { name: string; lord: string; pada: number | null } | null;
  arudha: string | null;    // the arudha pada of this house, as a sign
}
export interface PlanetCard {
  varga: string; planet: string; sign: string | null; house: number | null; degree: number | null;
  star: string | null; pada: number | null; starLord: string | null; dignity: string | null;
  retro: boolean | null; combust: boolean | null; war: boolean | null;
  dispositor: string | null; dispositorHouse: number | null; chain: string[];
  avasthas: Record<string, string>; shadbalaRatio: number | null; shadbalaRank: number | null;
  natural: string | null; functional: string | null; owns: number[];
  aspectsTo: number[]; aspectedBy: string[]; conjunctions: string[];
}
export interface YogaRow { id: string; name: string; planets: string[]; houses: number[]; class: string; source: string }
export interface PointRow { id: string; varga: string; sign: string | null; house: number | null; lord: string | null; lordHouse: number | null }
export interface AnnualRow { kind: 'TP' | 'VP'; year: number; varga: string; lagna: string | null; houses: HouseCard[];
  dashas: Array<{ system: string; periods: Array<{ lord: string; from: string; to: string }> }>; sahams: Array<{ name: string; sign: string | null; house: number | null }> }
export interface StarProfile { moonStar: string | null; moonStarLord: string | null; lagnaStar: string | null; taras: Array<{ star: string; tara: string }>; gandanta: string[] }
export interface DigestView {
  kundliId: string; status: DigestStatus; version: string; builtAt: string | null;
  house(varga: string, h: number): HouseCard | null;
  houses(varga: string): HouseCard[];
  planet(varga: string, p: string): PlanetCard | null;
  planets(varga: string): PlanetCard[];
  vargas(): string[];
  yogas(): YogaRow[];
  points(varga?: string): PointRow[];
  annual(year?: number): AnnualRow[];
  star(): StarProfile | null;
  sourceOf(section: DigestSection, key: string): DigestSource[];
}
// load.ts
export function loadDigest(prisma: PrismaClient, kundliId: string): Promise<DigestView | null>; // null unless ready
export function digestStatusOf(prisma: PrismaClient, kundliId: string): Promise<{ status: DigestStatus; version: string | null }>;
// build.ts
export function buildDigestRows(items: Record<string, unknown>, opts: { kundliId: string }): DigestRowInput[]; // pure
export function buildDigest(prisma: PrismaClient, kundliId: string, opts?: { fetch?: boolean }): Promise<{ status: DigestStatus; rows: number; ms: number }>;
// activation.ts
export type ActivationFamily = 'vimshottari' | 'conditional' | 'yogini' | 'tithi_ashtottari' | 'rasi' | 'karaka' | 'other';
export interface ActivationRow { system: string; family: ActivationFamily; level: 1 | 2 | 3; lord: string | null; sign: string | null;
  from: string; to: string; houses: number[]; parentLord: string | null }
export function activationFor(prisma: PrismaClient, kundliId: string, q: { from: string; to: string; houses?: number[]; systems?: string[]; maxLevel?: 1 | 2 | 3 }): Promise<ActivationRow[]>;
```

Houses a period activates (selection only, from stored engine fields): a graha period → the lord's D1 house, the houses
it owns and the houses its graha drishti falls on (all from the lord's D1 `PlanetCard`); a rasi period → the house of
that sign in D1 (`house_counts` sign-to-house) and the house of the sign's lord. Thirty years ahead of today; level 3
where stored, else 2. Families follow doc 46 §B.4.

Tables: `kundli_digest (kundli_id, section, key, row jsonb, source jsonb, digest_version, built_at)` unique
(kundli_id, section, key); `kundli_activation (id, kundli_id, system, family, level, lord, sign, from_date, to_date,
houses int[], parent_lord, digest_version)` indexed (kundli_id, from_date, to_date) and GIN on houses;
`kundlis.digest_status` (default 'pending'), `digest_version`, `digest_built_at`, `digest_error`.

## 3. S3: Self and Love boards

`GET /api/area/self` and `GET /api/area/love` (behind `AREA_ENABLED=1`, as career), each:

```ts
type AreaBoard =
  | { status: 'no_kundli' }
  | { status: 'preparing' }                         // digest not ready; the digest is queued
  | { status: 'ok'; built_at: string; cached: boolean; focus: string | null; board: {
      asOf: string;
      tone: { tone: 'demanding' | 'easing' | 'steady' | 'closing' | 'open'; confidence: 'confirmed' | 'likely' | 'split'; families: Array<{ family: string; vote: 'support' | 'test' | 'neutral' }> };
      supports: Array<{ text: string; evidence: string[] }>;      // promise + protection, plain words
      pressures: Array<{ text: string; until: string | null; evidence: string[] }>; // afflictions with release date
      ahead: Array<{ subarea: string; label: string; from: string; to: string; side: 'support' | 'test'; grade: 'strong' | 'moderate' | 'weak'; systems: string[] }>;
      year: { year: number; note: string } | null;               // the annual layer in one line
      back: Array<{ month: string; side: 'support' | 'test'; label: string }>;
      notes: string[] } };
```
`POST /api/area/:area/checks` already exists for career; S3 extends it to `self` and `love` (same body).

## 4. S4: the life reading dashboard (doc 34 Part 1)

`GET /api/life-reading` (behind `LIFE_READING_ENABLED=1`; 404 when off):

```ts
type LifeReading =
  | { status: 'no_kundli' } | { status: 'preparing' }
  | { status: 'ok'; built_at: string; cached: boolean; rule_now: string | null; areas: Array<{
      id: 'self' | 'money' | 'work' | 'home' | 'marriage' | 'children' | 'parents' | 'siblings' | 'legal' | 'health' | 'travel' | 'learning' | 'dharma';
      label: string;
      verdict: 'promised' | 'partial' | 'not_written';
      score: number;                       // 0..100, doc 34 §2 weights
      issue: string;                       // "What is wrong right now", plain words
      cause: { planets: string[]; dashas: string[]; text: string };
      improves: Array<{ from: string; to: string; md: string | null; ad: string | null; systems: string[]; grade: 'strong' | 'moderate' | 'weak'; basis: string }>;
      solution: string[];
      grade: 'strong' | 'moderate' | 'weak'; basis: string }> };
```
Stored per kundli per day in `area_builds` with `area = 'life'`. Composed by code from the digest and activation (template
sentences with evidence ids), no model.

## 5. S5: techniques in use

`src/techniques/use.ts`:
```ts
export function techniquesForQuestion(intent: Intent, facts: Record<string, string>, opts: { flow: 'single' | 'graph' | 'oracle'; tier?: number; digestReady: boolean }): { ids: string[]; analysts: Analyst[]; readers: string[] };
```
The graph flow runs the analysts the selected techniques name (never fewer than promise + dasha); the oracle flow's
readers come from the selected `general.reader*` contracts intersected with `BY_TIER`. The ids are the trace's
`techniques`. When the digest is ready, `buildEvidencePack` reads its sections from the digest (same section names and
shapes as today, so prompts do not change) and adds a `digest` block for the new deterministic readers
(`general.varga_dynamics`, `general.strength_yoga`, `general.jaimini`, `general.person`), which return `findings.v2`
claims built by code from digest rows with evidence ids. `person_facts` are passed as `FACTS` in the tail.

## 6. S2: Lucky five limbs

`DayRow` gains `yoga: { name: string; endHour: number | null } | null` and `karana: { name: string; endHour: number | null } | null`
from the stored day table. `scenarioDay` gates a day out when the yoga or karana is in the scenario's avoid list
(default lists in doc 53 §4.6), and adds +1 inside a favoured yoga's span. Each window's `reasons[]` gains keys
`yoga:<name>` and `karana:<name>`; each reason is tagged `general` or `personal`. The personal overlay adds the hora
lord's functional nature for the chart (from the digest when ready) as `personal` ±1. API shape unchanged except
`reasons: Array<{ key: string; scope: 'general' | 'personal' }>` alongside the existing string array (`reasonKeys`).
Web Why sheet: two groups, "For everyone" and "For you".

## 7. Local test (the parent session runs it after merging)

Server on `PORT=3000` with the shared database, `AREA_ENABLED=1 LUCKY_ENABLED=1 LIFE_READING_ENABLED=1`; build the digest for
one research kundli through `POST /events {"source":"kundli-digest","kundliId":...}` with the event token; call
`/api/area/self`, `/api/area/love`, `/api/life-reading`, `/api/lucky/range` with a locally signed test token for that
kundli's user (a token signed with the local `.env` JWT secret is a test credential for the local server only); then the
web dev server with `VITE_BOARDS_ENABLED=1` against it, screenshots of You, Love, Work, Lucky times and Profile →
Timeline. Every local server is stopped after.
