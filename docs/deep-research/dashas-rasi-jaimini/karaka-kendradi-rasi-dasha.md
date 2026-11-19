# Karaka Kendradi rasi dasa (kāraka kendrādi rāśi daśā; Atmakaraka Kendradi)

> The Kendradi sequence (kendras, panapharas, apoklimas) started from the Atmakaraka's sign (or the stronger of it and
> its 7th) instead of the lagna. BPHS lists a "Karaka" dasa and the translator's note mentions Atmakaraka variants;
> Jaimini 2.4.11-13 (as BSR reads it) describe a karaka-centred kendradi order, but as a planetary (graha) dasa. The
> rasi form's rules come from software/modern practice; the text basis is thin. Sometimes loosely called "Chara
> Paryaya"; Rath warns Chara dasa and Chara Paryaya are different things (see chara-paryaya-dasha.md).

## 1. Sources
- [TEXT] BPHS 46.6-11 (name "Karaka"); translator note at 46.175-176 (Lagna and Atmakaraka versions, rasi and graha
  forms).
- [TEXT] JS-BSR 2.4.11 "svakendrasthadyah swamino navamsanam": planets in kendras, panapharas, apoklimas from the karaka
  become lords of the dasas (graha order); 2.4.12: signs in kendras from lagna give the first dasa, 9 years each (BSR);
  2.4.13: the karaka "moves between lagna and 7th" (BSR gloss: years counted from the karaka; obscure).
- [MODERN] PVR-VA 15.5.2 warning: in AK-based dasas the sign with AK is stronger than any other; lords in kendras from
  AK beat those in panapharas.
- [ENGINE] `kendradhi_rasi.py::karaka_kendradhi_rasi_dhasa` (karaka index 1-8).

## 2. When it applies
Not stated in texts read. By analogy with Lagna Kendradi: material progress seen through the soul-significator.

## 3. Inputs required
Chara karakas (7- or 8-karaka scheme), AK sign, strengths, Narayana years.

## 4. Calculation (ENGINE / modern; unverified against text)
Seed = stronger of the chosen karaka's sign and its 7th; direction odd/even with Saturn forward, Ketu reverse; order
kendras-panapharas-apoklimas; years as Narayana. The engine allows any of the 8 karakas as the seed.

## 5. Interpretation rules
None found in texts. Treat as Lagna Kendradi with the AK as reference.

## 6. Variants and disputes
Graha (Jaimini 2.4.11) vs rasi form; AK-only vs any karaka; 7- vs 8-karaka scheme.

## 7. Worked micro-example
Not given.

## 8. Design notes for AI Astra
Not proposed for boards until a textual source is read. Engine output must include the karaka scheme and index.

## 9. Open questions
Classical source of the rasi form; whether "Karaka dasa" in BPHS 46 is graha- or rasi-based.
