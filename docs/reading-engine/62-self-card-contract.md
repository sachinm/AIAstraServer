# 62 — The You reading card contract (server ↔ web), as built

Status: **contract, 2026-11-07,** for the build of docs 60 and 61 on `feat/self-dashboard-guru-reading`. It extends the
response of `GET /api/self/reading` (doc 58 §4.2). Old fields stay; new fields are additive.

```ts
type LineRange = { from: string; to: string } | 'always';           // YYYY-MM-DD
type LineCertainty = 'fact' | 'strong' | 'moderate' | 'possible';   // doc 61 §1; only timing lines show the word

interface SelfLine {
  id: string;                 // '<panel>.<n>'
  text: string;               // plain words, at most 22 words
  range: LineRange;
  claimIds: string[];         // the SelfClaim ids it rests on
  certainty: LineCertainty;
  detail: string;             // chart terms, shown under "Chart details"
}

interface SelfPanel {          // existing fields kept: id, technique, title, lead, status, claims, chapters, cached, ms
  headerRange: LineRange;     // the range the whole card is true for (doc 61 §0.2)
  lines: SelfLine[];          // 1 to 3; the card. Empty when status is 'withheld'
  note?: string;              // standing line under the title (the body panel's "not medical advice" line)
  vetoed?: Array<{ claimId: string; rule: string; text: string }>;   // claims the purview removed, for Chart details only
}

interface SelfReading {        // existing fields kept
  purview: Array<{ rule: string; source: string; action: 'override' | 'veto' | 'annotate'; affects: string[]; text: string }>;
  audit: { verdict: 'pass' | 'fail'; checked: number; failures: Array<{ lineId: string; check: string; text: string }> };
  dossierId: string | null;   // the reading_dossiers row of this build (staff tools only)
  builtLine: string;          // "Built 7 Nov 2026, next check 1 Jan 2027"
}
```

Panel ids and display order (doc 61 §4): `diagnosis` (title "In short"), `chapters`, `lagna`, `mind`, `body`, `atma`,
`yogas`, `struggle`, `year`. The question stays `reading.question` (about the In-short tension).

Header ranges: `diagnosis`, `struggle`, `body` → the reading clock's running sub-period; `chapters` → the running main
period (its previous and next lines carry their own ranges); `year` → the running Varsha year (Mudda span); `lagna`,
`mind`, `atma`, `yogas` → `'always'`.

Web rendering: the card shows the title, the header range in words ("True until 1 Jan 2027", "This year: 9 Sep 2026 –
9 Sep 2027", "Always"), the `note` if any, the lines (each with its own range when it differs from the header, and the
certainty word on timing lines only), and "Chart details" revealing each line's `detail`, its `claimIds`, the panel's
`technique`, the vetoed claims and their rules. No tone badge, no vote counts. A panel with no lines shows nothing but
its title and "Not enough in your chart to say this with confidence." The bottom of the page shows `builtLine` once.

## Worked example: kundli c584c0a3 (Sachin), built 8 Nov 2026 on the Dwisaptati clock

Output of `npx tsx scripts/self-reading.ts --kundli c584c0a3-… --json`, summarised (title, status, header range, how it
was made; then each line with its range and certainty). The code audit passed on all 27 lines; the second open read all
nine panels from `technique_outputs` and reused the same dossier.

```text
dossier <id> | Built 8 Nov 2026, next check 1 Jan 2027 | audit pass 27 []

## In short ok | 2025-11-16→2027-01-01 | made 5.09ms
  - Your sense of self is lived through partnership. | always | fact
  - What carries your hunger for the new makes your ideas restless until 16 Feb 2028. | 2019-02-16→2028-02-16 | fact
  - Until 1 Jan 2027 the pressure is on effort, service, change and letting go, inside a chapter of ideas and gains. | 2025-11-16→2027-01-01 | strong

## Your chapters ok | 2019-02-16→2028-02-16 | made 5.3ms
  - From Feb 2010 to Feb 2019 your discipline shaped you, through self, home, partnership and belief. | 2010-02-15→2019-02-16 | moderate
  - From Feb 2019 to Feb 2028 your hunger for the new leads, through ideas and gains. | 2019-02-16→2028-02-16 | strong
  - From Feb 2028 your authority leads, through self, service and partnership. | 2028-02-16→2037-02-15 | strong

## Who you are ok | always | made 1.63ms
  - The part of you that steers your life is lived through partners, clients and the people you deal with. | always | fact
  - Where it sits it is comfortable, and by its state it spends itself mostly on the people around you. | always | fact
  - Others see you through your work, your standing and what you are known for. | always | fact

## Your mind ok | always | made 1.36ms
  - Your feelings are tied to belief and fortune; fragile by birth, lifted over time. | always | fact
  - Your thinking is drawn to sudden change, shared money and what is hidden, and it is comfortable there. | always | fact
  - Your peace of mind depends on change and the hidden; the chart supports it well. | always | fact

## Your body partial | 2025-11-16→2027-01-01 | made 1.28ms
  - Your body's footing rests on a ruler that is comfortable where it sits; your vitality is neither helped nor hindered. | always | fact
  - Until 1 Jan 2027 the ruler of this sub-chapter sits where the body wears: a steady pace matters. | 2025-11-16→2027-01-01 | fact
  - Under pressure, the body tends toward heaviness. | always | fact

## Your soul's aim ok | always | made 9.12ms
  - Your soul's lesson runs through your authority, lived in partnership. | always | fact
  - Inside, what you most want lies in family and money, beside your drive and your pleasures. | always | fact
  - Your judgement and faith work through partners, clients and the people you deal with. | always | fact

## Gifts and knots ok | always | made 11.34ms
  - A gift: a combination for wealth, touching your feelings and your mind. | always | fact
  - A gift: a cancellation that lifts a weakness over time, touching your feelings and your mind. | always | fact
  - A knot: a knot that asks for patience, touching ideas and learning. | always | fact

## What you struggle with ok | 2025-11-16→2027-01-01 | made 17.3ms
  - What carries your hunger for the new makes your ideas restless until 16 Feb 2028. | 2019-02-16→2028-02-16 | fact
  - What carries your judgement gives mostly to others. | always | fact
  - What carries your feelings gives early and raw. | always | fact
  VETOED struggle.weak_Mo purview.cancellation

## This year ok | 2026-09-09→2027-09-09 | made 0.95ms
  - This year's chart puts the part of you that steers in yourself, at its strongest. | 2026-09-09→2027-09-09 | fact
  - Until 24 Dec 2026 the year's short clock runs through your discipline, duty and endurance. | 2026-10-28→2026-12-24 | fact
  - This year your self is steered from your ideas, learning, creativity and children. | 2026-09-09→2027-09-09 | fact

PURVIEW
  annotate purview.lagna_lord_standing -> lagna.lord_house,body.footing
  veto purview.cancellation -> struggle.weak_Mo
  annotate purview.vargottama -> lagna.lord_company,atma.ak,atma.ak_state,struggle.ripeness_Su,struggle.on_self_Su,chapters.next,body.footing,body.pressed
  annotate purview.dasha_applicability -> chapters.previous,chapters.running,chapters.next
  annotate purview.md_ad_relation -> chapters.sub
  annotate purview.sky -> 
Q: Does this ring true for you right now? What carries your hunger for the new makes your ideas restless until 16 Feb 2028.
GAPS: body: sky overlay not stored: Saturn, Mars and the nodes over the lagna and the Moon not checked
run2: cached 9 of 9 same dossier true
```
