# Learning Proposal (`/learn`) — Multi-School Jyotish Reading & 18-Year Retrospective Engine

## 1. Context & User Corrections Codified
During this session, Sachin established foundational standards for how AI Astra (`AIAstra_Radha`, `AIAstra_Server`, `AIAstra_WEB`) computes and delivers astrological readings:

1. **Immediate Humanity-First Financial Horizons (No 2-Year Deferrals):**
   - Never tell a user in financial strain to wait 2 years for money. Every reading must provide an **Immediate 30-Day Cash & Relief Map** (identifying exact days for liquidity, discretionary relief, and eclipse/trap avoidance), followed by **3-Month, 6-Month, 9-Month, 12-Month, and 1–5 Year** wealth vehicles (salaried, consulting, entrepreneurship, OPM/8th house, speculation/5th house, real estate/4th house).
2. **Conditional Dasha Prominence (`Dwisaptati Sama Dasha`):**
   - When the Lagna Lord sits in the 7th house or the 7th Lord sits in the Lagna (e.g., Pisces Lagna with Jupiter in Virgo 7H), **Dwisaptati Sama Dasha (72-year cycle)** is the primary conditional Nakshatra dasha and must be given co-equal prominence with Vimshottari, Narayana, and Tithi Ashtottari Dashas.
3. **Mahadasha Charter & 9×9 Antardasha Fruition Matrix:**
   - Readings must explain *why* a Mahadasha is scheduled, what its **5-Vector Charter** (Origin, Placement, Dispositor, Nakshatra, Aspect) is trying to build, where it places the native by completion, and *which Antardasha delivers the ripe fruit* based on the 9×9 relative house matrix from the Mahadasha lord.
4. **Non-Sychophantic 3-Method Confirmation & 5-System Avastha Audit:**
   - Every prediction requires **3+ independent confirmations** (Multi-Dasha + Natal/Varga/Arudha/Argala + Tithi Pravesha/Varsha/Transit) and an explicit **Avastha & Proximity Audit** (`Baladi`, `Jagradadi`, `Deeptadi`, `Lajjitadi`, `Shayanadi`, plus Sun combustion/retrograde checks) to determine whether promised fruit is ripe (`Yuva`), unripe (`Bala`), delayed (`Vriddha`), or dormant (`Mrita`).
5. **Four-School Synthesis & Shelter-in-Place Engineering:**
   - Synthesize **Parashara**, **Jaimini**, **Pt. Sanjay Rath**, and **Lunar Astro (Deepanshu Giri)** (including 64th Navamsa, 22nd Drekkana, Bhrigu Bindu, Pending Karma, and Saturnian blind-action remedies), framed as a **Hurricane Evacuation & Shelter-in-Place Protocol**.
6. **Radha (`pyserve`) Ground-Truth Completeness:**
   - All astrological calculations (including `avasthas`, `dasha_charter`, `correspondences` for 12H footwear / 4H+D16 vehicles / 5H+9H+D24 college / 11H friends, Level-3 dashas, and annual `tithi_pravesha` / `varsha` / `sahams`) are computed in `AIAstra_Radha` and registered in `AIAstra_Server`'s chart catalog (`catalog.ts` & `M17`).

## 2. Persisted Customizations Created
- **Workspace Skill:** [`.agents/skills/multi-school-jyotish-reading/SKILL.md`](file:///C:/Users/Owner/Documents/work/AIAstra_Server/.agents/skills/multi-school-jyotish-reading/SKILL.md)
- **Methodology & Requirements Docs:**
  - [`docs/ASK-REQUIREMENTS.md`](file:///C:/Users/Owner/Documents/work/AIAstra_Server/docs/ASK-REQUIREMENTS.md)
  - [`docs/TECHNIQUE.md`](file:///C:/Users/Owner/Documents/work/AIAstra_Server/docs/TECHNIQUE.md) & [`docs/TECHNIQUE.docx`](file:///C:/Users/Owner/Documents/work/AIAstra_Server/docs/TECHNIQUE.docx)
  - [`docs/reading-engine/34-comprehensive-life-reading-from-radha-json.md`](file:///C:/Users/Owner/Documents/work/AIAstra_Server/docs/reading-engine/34-comprehensive-life-reading-from-radha-json.md) (§7)


### 7. Rule 0 — Anti-Sycophancy Claim-Verification & Multi-Entity Disambiguation ("Never Go By What the User Enters")
- **Why:** Users naturally compress or conflate multiple people/partners into shorthand when prompting (e.g., "an older person I work with" or "my brother"). If the engine blindly accepts the user's shorthand without auditing the chart first, the reading looks sycophantic and misses the real astrological differentiation.
- **Mandate:** Always verify, challenge, and disambiguate user claims against the chart's multi-planet and multi-house geometry *before* treating any user statement as fact:
  1. **Multiplicity Check:** Count the distinct planetary actors in the relevant houses (`7th house` `Ju + Sa + Su` + `7th lord Me in 8th` + `11th house Ke in Capricorn ruled by Sa`). State explicitly when the chart shows **multiple 50s–70s senior figures** rather than one.
  2. **Composite Profession Check:** Never reduce `Saturn` to just "an old person." Read the nakshatra exchange and house links:
     - **Figure 1 (`Saturn in 7th + Sun in Chitra [Mars] + Mars in Anuradha [Saturn] + 10th aspect on 4th House`):** A 70-year-old senior principal with strong **Mars + 4th-house** traits who owns/runs **construction, roofing, or real-estate companies** and brings industry contacts (`CarbonLite`).
     - **Figure 2 (`7th/4th Lord Mercury in 8th House Libra + 6th-Lord Sun in 7th + D10 Gemini Lagna`):** A senior owner of a **software development shop / IT contracting agency** (`CF Webtools`) under whom the native works as a **freelance/contract developer** for small/mid-size businesses.
     - **Figure 3 (`11th House Capricorn [Elder Brother] with Ketu in Shravana + 11th Lord Saturn Conjunct Jupiter [Jyotish] + 5th House Rahu [AI]`):** An **elder brother in his 50s** who is not just providing shelter, but actively commissioning/partnering with the native to build and calibrate an **AI + Vedic Astrology (`Jyotish`) application (`AI Astra`)**.
