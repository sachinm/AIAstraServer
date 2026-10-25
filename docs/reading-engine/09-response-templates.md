# 09 — Response templates

Added 2026-10-24 after Sachin's product feedback: users want **what is happening, when it stops, when the good phase starts**, with a little "why". The method, the charts read and the placements still matter, but they belong in a collapsible "How I read this" block, not in the headline.

This file fixes **ten templates**. Intake picks exactly one (`intent.template`), reconcile fills the deterministic slots (dates, windows, period names) from the dossier, and the synthesizer writes prose into the template. Because the template is known before the model writes, the UI can render the frame (headline card, timeline table skeleton, stage chips) before the first token arrives, and the eval harness can check structure mechanically.

## 1. Rules common to every template

1. **Answer first.** The first block is always the **Answer card**: 2–4 sentences, plain language, no Sanskrit except a planet or house name, no chart citations. It must contain the verdict and at least one date or window when the question is about time.
2. **70/30.** Roughly 70 % of the body is *what* and *when*; at most 30 % is *why*. The "How I read this" block does not count toward the cap and is collapsed by default in the UI.
3. **Dates everywhere.** Every period or event is written as `Mon YYYY` or `DD Mon YYYY – DD Mon YYYY`. "Soon" and "in the coming period" are banned. Windows come only from `reconcile.windows[]`; the model never invents a date.
4. **Three tenses.** Where it fits: *now* (what is active and until when), *next* (when it changes and to what), *later* (the next notable window in the horizon).
5. **Confidence vocabulary** fixed: `strong indication`, `moderate indication`, `weak / possible`, `not indicated`. No percentages in prose. (The structured output carries a numeric score for logging.)
6. **No remedies, no amounts, no medical/legal advice, no death prediction.** Health is "vigilance windows"; longevity questions get template T10 with the policy answer.
7. **Facts are quoted, not computed.** Any placement sentence in the "How I read this" block must map to a fact id in the brief. The grounding checker runs on the final text.
8. **Sanskrit with a gloss on first use** inside "How I read this" only (e.g. "Vimshottari dasha (planetary period)").
9. **Length caps** per template below; the synthesizer stops at the cap even if more could be said, and offers a follow-up chip instead.
10. **Markdown**: `##` for the body sections, one table max unless the template says otherwise, blank lines around blocks, no images.

## 2. The ten templates

| Id | Name | Use when (intent) | Body sections after the Answer card | Cap |
|---|---|---|---|---|
| **T1** | Quick verdict | `yes_no` with one subject, any horizon | **When** (1–3 dated windows as bullets) · **What helps / what blocks** (2 bullets each) · *How I read this* | 180 words + collapsible |
| **T2** | Timeline | `timing` ("when will…") | **Timeline** table `Window · Period (MD-AD-PD) · Trigger · Indication · Watch for` (3–7 rows) · **Best window** (one paragraph) · **Before then** (what to do with the waiting time, astrological not remedial) · *How I read this* | 350 words + table |
| **T3** | Now → ends → next | "why is this happening / when does it stop" about a current difficulty | **What is active now** (period and transit named, until `date`) · **When it eases** (date + what changes) · **Next good phase** (window + what it favours) · **Signs it is turning** (3 dated checkpoints) · *How I read this* | 300 words |
| **T4** | Meaning of a transit or period | `why_meaning` naming a transit/dasha (e.g. Ketu over natal Jupiter) | **In your chart it means** (3–4 sentences specific to houses Jupiter owns/occupies) · **Exact window** (start, peak = same nakshatra/degree, end) · **Areas touched** (bullets by house) · **Typical arc** (early / middle / late phase) · *How I read this* | 320 words |
| **T5** | Compare / decide | `compare` (A or B, stay or move) | **Verdict** · **Comparison** table `Factor · Option A · Option B` (4–6 rows) · **Timing that favours each** · *How I read this* | 300 words + table |
| **T6** | Area profile | `describe` ("what does my D-10 say", "my career nature") | **In one line** · **Strengths** · **Frictions** · **Themes by life stage** (3 dated bands from Narayana/Vimshottari MD) · *How I read this* | 350 words |
| **T7** | Nakshatra portrait | `describe` nakshatra / "all the ways" | **Your core stars** (janma, lagna, each with one line) · **How they act** (star-lord layer, 3–4 bullets) · **Timing stars** (current dasha-lord nakshatra, tara) · **Transit stars now** (which natal stars are being crossed, with dates) · *How I read this* | 420 words |
| **T8** | Two-chart reading | compatibility / family link (needs second chart) | **Verdict** · **Where you meet** · **Where you clash** · **Shared timing** (windows affecting both) · table `Factor · Chart A · Chart B · Effect` · *How I read this* | 380 words + table |
| **T9** | Month ahead / watch-list | horizon `now` or `3m`, no single event asked | **This month in one line** · numbered **Checkpoints** (date → what to expect → why, max 6) · **Best days / avoid** (from transits, not muhurta) · *How I read this* | 260 words |
| **T10** | Explainer with your example | `explain_term`, policy topics (longevity, lottery) | **What it is** (general, 3–4 sentences) · **In your chart** (one worked example) · **What we do and do not predict** (policy line when applicable) | 220 words |

Mapping from intent to template is deterministic in `intake` (table above). When two fit, prefer the one with dates (T2/T3 over T1/T6).

## 3. Slots filled before the model writes

Reconcile produces a `SynthBrief` with these slots; the synthesizer may rephrase but not alter them:

```ts
SynthBrief = {
  template: 'T1' | … | 'T10',
  subject: SubjectId[], horizon: Horizon, question: string,
  verdict: { level: 'strong'|'moderate'|'weak'|'not_indicated'|'mixed', agreement: 'converge'|'partial'|'diverge' },
  now: { md: 'Sa', ad: 'Me', pd: 'Ke', until: '2026-07-24', class: 'obstructor'|'deliverer'|… , transits: [{planet, sign, overNatal[], until}] },
  next: { from: '2026-07-24', to: '2027-02-01', md_ad_pd: 'Sa-Me-Ve', class, trigger?: string },
  windows: Window[],                 // for T2/T3/T5/T8/T9, ≤ 7, sorted
  checkpoints?: Array<{ date: string, event: string, factIds: string[] }>,   // T3/T9
  keyFacts: Array<{ id: string, text: string }>,  // ≤ 12, for "How I read this"
  caveats: string[],
  policy?: 'no_death_prediction' | 'no_lottery' | 'no_amounts' | 'no_medical',
  persona: 'pvr_oracle' | 'plain'
}
```

The UI receives the same `template` id in the SSE `intent` event and the `windows` event, so it can draw the card frame and the empty table immediately.

## 4. Worked examples (skeletons, not full answers)

**T3 for "I am having problems with work and money, when does this improve?"**

> **Answer.** You are in Saturn–Mercury–Ketu (until 24 Jul 2026): Mercury rules your 1st and 10th and sits combust in the 9th, so work feels effortful and underpaid, and Ketu adds detachment. The pressure eases from **Aug 2026** when Saturn–Mercury–Venus begins and Jupiter moves into your 11th; the clearest improvement window is **Nov 2026 – Mar 2027**.
>
> ## What is active now … (period, transit, until)
> ## When it eases … (date, what changes)
> ## Next good phase … (window, favours)
> ## Signs it is turning
> 1. 24 Jul 2026 — … 2. Oct 2026 — … 3. Jan 2027 — …
>
> <details><summary>How I read this</summary> 10th lord Mercury in 9th, combust (`planet.Me.combust`); D-10 lagna lord …; Saturn transit 6th from Moon (`transit.Sa.2026-10.house_from_moon=6`) …</details>

**T4 for "Ketu is over my Jupiter, what does that mean?"**

> **Answer.** Ketu crossed into Pisces over your natal Jupiter on 5 Dec 2026 and sits within 3° of it from **Feb to May 2027**, the peak. Jupiter rules your 4th and 7th and sits in your 10th, so this touches home, partnership and reputation: a season of detachment and re-evaluation rather than loss, with Rahu opposite in Virgo stirring the 4th. It fades after **Oct 2027**.
>
> ## In your chart it means · ## Exact window · ## Areas touched · ## Typical arc · *How I read this*

## 5. Feeding templates to the multi-agent flow

- Intake sets `template` → the pack selector adds template-specific needs (T3 and T9 pull a denser transit table; T7 pulls the full nakshatra profile; T8 pulls both dossiers).
- Specialists are template-agnostic; they return claims and windows.
- Reconcile fills the slots; for T3 it must compute `now.until` and `next.from` from the dasha list, for T4 it must compute the exact-degree window from the transit snapshot, for T9 it builds checkpoints from ingresses and lunations in the month.
- Synth gets `prompts/formats/T<n>.md` (section skeleton, caps, banned phrases) plus `SynthBrief`.
- Evals check: Answer card present and ≤ 4 sentences, required sections present, dates parse and lie within the horizon, table header matches, word cap, policy line when `policy` is set.

## 6. UI contract

The web renders AI messages with a **Reading card** component when `template` is present: headline Answer card (slightly larger type), body markdown, a "When" strip derived from `windows` (chips with date ranges), and a collapsed "How I read this" section. Older messages without a template render as plain markdown as today. See `docs/product/chat-interface-review.md`.
