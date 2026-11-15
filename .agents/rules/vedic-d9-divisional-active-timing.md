# Vedic D9 (Navamsha) Maturation, Divisional Charts & Active Timing Rule

Applies to all reading techniques, board services (`self`, `love`, `career`), card prompts (`cards/oracle`, `cards/group`), and UI card surfaces. Full architecture spec: [`docs/reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md`](../../docs/reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md).

## 1. Age-36 Navamsha (`D9`) Mutual Confirmation Gate
- Always read the maturation threshold via `getD9MaturityAgeYears()` (`D9_MATURITY_AGE_YEARS`, default `36`, clamped `18..100` in `src/config/env.ts`) — never hardcode `36` inside business logic.
- When `ageYears > getD9MaturityAgeYears()`, **D1 + D9 together** must be evaluated via `evaluateD1D9MutualConfirmation` for every active dasha lord (`MD`/`AD`), annual Tithi Pravesha `yearLord`, and board significator:
  - Explicitly distinguish `confirmed_strong` / `Vargottama`, `confirmed_weak` (`Neecha Vargottama` / *Drudha Karma*), `d9_redeemed` (`Neecha Bhanga via D9`), and `d9_weakened` (*False Promise*), and articulate both `D1` and `D9` together when validated across both charts.

## 2. Domain Higher Divisional Chart Routing (Natal & Tithi Pravesha)
- Read both active dasha planets AND annual Tithi Pravesha (`AnnualRow.yearLord`, `tpRowIn`) across `D1`, `D9`, and the domain's higher divisional chart:
  - **Career / Work** (`work`, `career`, `drive`, `diagnosis`, `chapter`, `chapters`, `year`): **`D10` (Dasamsa)**
  - **Love / Relationships** (`love`, `lagna`, `presence`): **`D9` (Navamsha) + `D7` (Saptamsa)**
  - **Self / Body / Mind / Dharma**: **`D30` (Trimshamsha)** for physical/friction cards (`body`, `fitness`, `sleep`, `blood`, `stuck`, `mood`), **`D24`** (`mind`, `sharpness`, `learning`), **`D20`** (`purpose`, `practice`, `aims`).

## 3. Active 40+ Dasha Systems & Current-Year Tithi Pravesha Focus
- Anchor every dashboard card and board reading in **what the person is facing right now** through the running major Mahadasha across the 40+ engine dasha systems (`resolveActiveMahadasha`: certified applicable conditional -> Vimshottari -> Rasi/Yogini) and the current-year Tithi Pravesha (`runningTithiPravesha`, `AnnualRow.yearLord`, `shortClock`), NOT static natal personality descriptions.
- Keep technical divisional/dasha citations in the Oracle/evidence layers (`D1`, `D9`, `D10`, `D7`, `D30`), keep client-facing Personalizer and deterministic board prose strictly plain English with **zero chart jargon**, and **never** surface internal engine names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`).

## 4. Dashboard Card Toolbar Vetting Skill
- All UI card toolbar and layout changes across Self, Love, and Work must follow [`dashboard-card-toolbar-vetting`](../skills/dashboard-card-toolbar-vetting/SKILL.md): enforce the 5-Gate rubric before showing/opening optional tools, and preserve required controls (`Chart details`) unconditionally.
