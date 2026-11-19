# Tajika sahams (sahama, the Arabic "lots")

> A saham is a sensitive point made from three longitudes: (A − B) + C, where C is usually the lagna. Many formulas
> reverse A and B for a night revolution. Each saham stands for one matter (marriage, children, career, illness and
> so on). Its sign, lord and the aspects on it, in the annual chart, show how that matter fares this year. They are
> the Indian form of the Arabic lots (*sahm*). Nīlakaṇṭha lists 50, and later authors add more (Hāyanaratna reaches
> about 75). They are used widely as secondary evidence. The formulas differ between sources, so source and version
> must be stored.

## 1. Sources

| Text | Numbering | Content |
|---|---|---|
| Nīlakaṇṭha, *Tājika-Nīlakaṇṭhī*, Saṃjñātantra ch. 3 | as quoted in *Hāyanaratna* (Gansten 2020) ch. 4 | 3.5 Puṇya (Fortune). 3.6–3.24 the 50 sahams |
| Yādava, *Tājikayogasudhānidhi* 11.18, 11.26–31 | HR | Add-the-lagna default; sahams 51–64 |
| *Tājikamuktāvalī* 22, 30–32; *Hillājatājika* | HR | Sahams 65–75; the "second house" reading |
| Samarasiṃha (*Manuṣyajātaka* 4.7); Haribhaṭṭa *Tājikasāra* 233; Tejaḥsiṃha *Daivajñālaṃkṛti* 256–259 | HR ch. 4 §2 | The dispute over adding one sign |

URLs: `.../doc1500921.html` (names), `.../doc1500922.html` (Puṇya and dispute), `.../doc1500923.html` (formulas),
`.../doc1500926.html`, `.../doc1500927.html` (results and timing, not fetched).

## 2. When it applies

Annual chart (and monthly). Use the saham of the matter being asked about: Vivāha for marriage, Putra for
children, Karma and Rājya for career, Artha for wealth, Roga for illness, and so on.

## 3. Inputs required

Annual chart longitudes of the planets, the lagna and the house cusps (for 2nd/8th/9th-house-based sahams), house
lords, day or night at the revolution, and the Puṇya saham (several sahams build on it).

## 4. Calculation

**General [TEXT]:** saham = A − B + C (mod 360). C is the lagna unless stated.
**Add-one-sign correction [TEXT]:** if C does **not** fall between B and A (counting forward from B to A), add 30°
(Saṃj. 3.5 as applied by Balabhadra; explicit for Mitra and Gaurava). Keśava, Haribhaṭṭa and Gaṇeśa omit it.
Balabhadra (HR ch. 4 §2) defends it, citing Samarasiṃha. Engine must expose this as a switch.

**Day/night [TEXT]:** "reversed at night" means use B − A + C when the revolution is at night.

Key sahams (Saṃj. ch. 3 numbering via HR. A − B means subtract B from A):

| Saham | Day formula (A − B + C) | Night | Saṃj. |
|---|---|---|---|
| Puṇya (fortune) | Moon − Sun + Lagna | Sun − Moon + Lagna | 3.5 |
| Vidyā / Guru (learning, teacher) | Sun − Moon + Lagna (reverse of Puṇya) — **verify**, HR summary unclear | reversed | 3.6 |
| Yaśas (renown) | Jupiter − Puṇya + Lagna | reversed | 3.6 |
| Mitra (friends) | Guru-saham − Puṇya + Venus | reversed | 3.7 |
| Māhātmya (greatness) | Puṇya − Mars + Lagna | reversed | 3.8 |
| Āśā (hope) | Saturn − Venus + Lagna | reversed | 3.8 |
| Sāmarthya (ability) | Mars − Lagna lord + Lagna (if Mars rules lagna: Jupiter − Mars) | reversed | 3.9 |
| Bhrātṛ (siblings) | Jupiter − Saturn + Lagna | (not stated) | 3.9 |
| Rājya, Pitṛ (career, father) | Saturn − Sun + Lagna | reversed | 3.10 |
| Mātṛ (mother) | Moon − Venus + Lagna | reversed | 3.11 |
| Putra / Suta (children) | Jupiter − Moon + Lagna | same at night | 3.11 |
| Jīvita (life) | Saturn − Jupiter + Lagna | reversed | 3.11 |
| Karma (work) | Mars − Mercury + Lagna | reversed | 3.12 |
| Roga (illness) | Lagna − Moon + Lagna | same | 3.12 |
| Manmatha (desire) | Moon − Lagna lord + Lagna | reversed | 3.12 |
| Kali (strife) | Jupiter − Mars + Lagna | reversed | 3.13 |
| Mṛtyu (death) | 8th cusp − Moon + Saturn | same | 3.14 |
| Paradeśa (foreign) | 9th cusp − 9th lord + Lagna | same | 3.15 |
| Artha (wealth) | 2nd cusp − 2nd lord + Lagna | same | 3.15 |
| Paradāra (others' spouses) | Venus − Sun + Lagna | same | 3.16 |
| Vaṇij (trade) | Moon − Mercury + Lagna | same (the verse wording conflicts with the commentary) | 3.16 |
| Kāryasiddhi (success) | Saturn − Sun + lord of Sun's sign | Saturn − Moon + lord of Moon's sign | 3.17 |
| Vivāha (marriage) | Venus − Saturn + Lagna | same | 3.17 |
| Prasūti (childbirth) | Jupiter − Mercury + Lagna | reversed | 3.18 |
| Santāpa (affliction) | Saturn − Moon + 6th cusp | same | 3.18 |
| Śraddhā, Prīti, Jāḍya, Vyāpāra, Śatru, Śaurya … | see HR table | | 3.19–22 |
| Jalapatana, Bandhana, Kanyā, Aśva | see HR table | | 3.23–24 |

Nīlakaṇṭha's 50: Puṇya, Guru, Vidyā, Yaśas, Mitra, Māhātmya, Āśā, Sāmarthya, Bhrātṛ, Gaurava, Rājya, Pitṛ, Mātṛ,
Putra, Jīvita, Ambu, Karma, Roga, Manmatha, Kali, Kṣamā, Śāstra, Bandhu, Bandaka, Mṛtyu, Deśāntara, Artha, Paradāra,
Anyakarma, Vaṇij, Kāryasiddhi, Vivāha, Prasūti, Santāpa, Śraddhā, Prīti, Bala, Deha, Jāḍya, Vyāpāra, Pānīyapāta, Ripu,
Śaurya, Upāya, Daridra, Gurutā, Jalādhvan, Bandhana, Kanyā, Aśva (HR ch. 4 §3: "these are the fifty sahamas").

## 5. Interpretation rules

- [TEXT] A saham whose lord is strong, joined to or aspecting it, with benefic aspects and in a good house of the
  year, makes the matter prosper. Malefic, hostile or 6/8/12 conditions spoil it (HR ch. 4 §6. Details not fetched.
  This follows the general Tajika house rule in HR ch. 6 §1).
- [TEXT] Timing (HR ch. 4 §7, not fetched): results come when the saham's lord is active in the year's periods. The other researcher's Mudda and Patyayini files cover those periods.
- [MODERN] Practice: an Itthaśāla between the saham lord and the varṣa-lagna lord confirms the matter this year.

## 6. Variants and disputes

- The add-one-sign rule (above). This is the largest source of software differences.
- Formula variants by author (Samarasiṃha's Sāmarthya transposed in some manuscripts; Keśava always adds the lagna).
- Day/night: the texts speak of the time of the **revolution**. See §8 on the engine's choice.
- Count: 50 (Nīlakaṇṭha), 64 (with Yādava), about 75 (HR). pyjhora's list (`const._saham_list`) is about 50 and follows Nīlakaṇṭha's order.

## 7. Worked micro-example

Day revolution. Lagna 10° Cp (280°), Venus 15° Le (135°), Saturn 20° Ar (20°). Vivāha = Venus − Saturn + Lagna =
135 − 20 + 280 = 395, which is 35° (5° Taurus). Is the lagna (280°) between Saturn (20°) and Venus (135°)? No, so with
Balabhadra's rule add 30°, giving 65° (5° Gemini). Without the rule it is 5° Taurus. The two readings give different
saham lords: Venus vs. Mercury.

## 8. Design notes for AI Astra

- Engine (served): `annual.sahams` computes every saham in `const._saham_list` on the varṣa chart. **Check:**
  `annual_export.py` line 740 passes `night_time_birth=_is_night_birth(birth_jd, …)`, which is natal day/night. The
  Tajika texts reckon day or night by the **revolution** moment. These differ for anyone born at night whose return
  falls by day, or the reverse, which is about half of all years. Engine addition: compute with the revolution's
  day/night flag and return `day_night_basis`. Also return per saham: `formula_id`, whether 30° was added,
  `add_one_sign_rule` used, sign, lord, house in the year, and aspects to it.
- Verify pyjhora's formulas one by one against the table above (engine-rule-verifier, doc 46 §D.2).
- Serves: annual life-area reads (Vivāha for love, Karma and Rājya for work, Artha for money, Putra for family).
  Weight: low to middling confirmation. Never the lead evidence.

## 9. Open questions

- The exact Guru and Vidyā formulas (Saṃj. 3.6). The HR summary was ambiguous.
- The add-one-sign default. Recommend Balabhadra's rule ON (it follows Samarasiṃha), stored as a parameter.
- Results and timing chapters (HR ch. 4 §6–7) were not read.
