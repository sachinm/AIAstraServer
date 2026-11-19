# Muhurta doshas: Panchaka, Bhadra (Vishti), Gandanta and others (muhūrta-doṣa)

> Doṣas ("faults") are named conditions of the panchang, the Moon or the planets. They spoil a moment for
> auspicious starts. The best known are Pañcaka (the Moon in the last five stars), Bhadrā (the Viṣṭi karaṇa) and
> Gaṇḍānta (the water–fire junctions of stars, tithis and signs). Every muhurta text lists them, and almanacs print
> them. Most are exact and computable. Their scope (which acts they forbid) varies by text and region.

## 1. Sources

| Text | Status |
|---|---|
| *Muhūrta-cintāmaṇi* Śubhāśubha-prakaraṇa (Bhadrā, Pañcaka, combinations); Vivāha-prakaraṇa (ten marriage doṣas) | Chapter level. **Verses not verified** |
| *Muhūrta-mārtaṇḍa* Tyājya-prakaraṇa (ch. 1) | Chapter title confirmed (hindu-blog.com). Content not read |
| *Jyotirnibandha*; *Bṛhat Saṃhitā* | Not read |
| pyjhora `drik.panchaka_rahitha` | Inspected |

## 2. When it applies

All elections, and the Lucky Times day table as day or window flags.

## 3. Inputs required

Moon longitude (star, pāda, sign), tithi, karaṇa, lagna (for lagna gaṇḍānta), weekday, and Venus and Jupiter combustion status.

## 4. Rules

### 4.1 Pañcaka (dhaniṣṭhā-pañcaka) [TEXT, MC ch. 1]

The Moon in the second half of Dhaniṣṭhā through Śatabhiṣā, P.Bhādrapadā, U.Bhādrapadā and Revatī (the Moon in
Aquarius–Pisces), about 4½ days a month. Forbidden: southward journeys, collecting firewood or grass, making a cot
or bed, roofing a house, and cremation (with prescribed remedies). Not a general ban on everything.

**Do not confuse** with Kerala/Tamil *pañcaka-rahita* muhūrta: (tithi + nakṣatra + weekday + lagna) mod 9. The
remainders 1, 2, 4, 6, 8 are mṛtyu, agni, rāja, cora and roga pañcaka, and the others are clean [REGIONAL].
pyjhora's `panchaka_rahitha` implements **this** (sum mod 9, bad = {1,2,4,6,8}), not the Dhaniṣṭhā Pañcaka.

### 4.2 Bhadrā / Viṣṭi karaṇa [TEXT, MC ch. 1]

Viṣṭi is the 7th movable karaṇa (8 times a month, about 12 hours each). Avoided for all auspicious acts. Bhadrā's
"residence" follows the Moon sign: Moon in Cancer, Leo, Aquarius or Pisces means Bhadrā on earth (harmful). Aries,
Taurus, Gemini or Scorpio means in heaven. Virgo, Libra, Sagittarius or Capricorn means in pātāla (the last two not
harmful on earth) [COMM]. Bhadrā's "tail" (puccha) portion is allowed, and its "mouth" (mukha) is worst [COMM]. Good
for harsh acts (attack, poison, litigation).

### 4.3 Gaṇḍānta [TEXT/COMM]

The junctions of water and fire:
- **Nakṣatra gaṇḍānta**: the end of Revatī / start of Aśvinī, the end of Āśleṣā / start of Maghā, and the end of Jyeṣṭhā / start of Mūla. Commonly the last and first pāda (or 2 ghaṭīs each side, by author).
- **Tithi gaṇḍānta**: the Pūrṇā→Nandā junctions (5/6, 10/11, 15/1), about 1 ghaṭī each side.
- **Lagna gaṇḍānta**: the end of Cancer/Scorpio/Pisces into Leo/Sagittarius/Aries (half a ghaṭī).
Avoided for all starts. Births in Mūla, Jyeṣṭhā or Āśleṣā gaṇḍānta need śānti (a remedy rite) [TEXT].

### 4.4 Other common doṣas [TEXT, MC ch. 1 and ch. 6; list, verses unverified]

- Avoided yogas (Viṣkambha … Vaidhṛti) and the bad fixed karaṇas (see `panchang-five-limbs.md`).
- Riktā tithis; Amāvāsyā; *dagdha* tithi–weekday pairs; *krakaca*, *saṃvartaka*, *hutāśana*, *visa* combinations of weekday, tithi and star.
- *Tyājya / varjyam*: the star-specific bad ghaṭīs (served by the engine as varjyam).
- *Guru-āsta*, *śukra-āsta*: Jupiter or Venus combust (marriage, upanayana, griha-praveśa forbidden. Dekhopanchang,
  citing MC ch. 6: Venus within 10° (8° when retrograde) or Jupiter within 11° of the Sun).
- *Adhika / kṣaya māsa* (mala-māsa): no new saṃskāras.
- *Cāturmāsya* (Āṣāḍha Ś11 to Kārtika Ś11): no marriages in many regions [REGIONAL].
- Marriage-specific "ten doṣas" (MC ch. 6): Lattā, Pāta, Yuti, Vedha, Yāmitra (Jāmitra), Bāṇa, Ekārgala, Upagraha,
  Krānti-sāmya, Dagdha-tithi. **List from general knowledge. Verify against the MC Vivāha-prakaraṇa.**

## 5. Interpretation rules

- [TEXT] Doṣas are gates. A moment with a major doṣa is rejected unless a cancellation applies (a strong lagna;
  Abhijit for some; Godhūli for marriage).
- [COMM] The scope matters. Pañcaka forbids specific acts, not all acts. Copy must not say "bad day" for Pañcaka in general.

## 6. Variants and disputes

Gaṇḍānta widths. Bhadrā residence scheme. Whether Pañcaka applies to all of Dhaniṣṭhā or only its second half. Regional bans (Holāṣṭaka, Kharmās) [REGIONAL].

## 8. Design notes for AI Astra

- Engine additions (per place-day, with start and end times): `panchaka{start,end, scope:[south_travel, wood, bed, roof, cremation]}`;
  `bhadra{start,end, residence: earth|heaven|patala, mukha/puccha spans}`; `gandanta{kind: nakshatra|tithi|lagna, start, end}`;
  `combust{venus, jupiter}`; `mala_masa`; `tyajya` (already as varjyam); combination flags. Rename or tag pyjhora's
  `panchaka_rahitha` output as `panchaka_rahita_kerala` so nobody mistakes it for Dhaniṣṭhā Pañcaka.
- Node only reads the flags and applies scenario scopes from config (`lucky.scenarios`).
- Serves: Lucky Times gates (per scenario: travel south, home repairs, ceremonies) and event muhurtas. Weight: a hard gate within scope.

## 9. Open questions

- Verify every list here against the MC Sanskrit (ch. 1, 6). The marriage ten-doṣa list is the least certain.
