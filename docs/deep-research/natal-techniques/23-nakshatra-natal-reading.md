# Nakshatra-based natal reading (janma nakṣatra, pāda, nakṣatra-pati)

> The Moon's nakshatra at birth (janma nakshatra), its quarter (pada) and the nakshatra lord shape:
> - temperament and appearance;
> - the starting dasha (Vimshottari, covered by the dasha researchers);
> - auspicious or inauspicious birth conditions (gandanta, ganda-moola).
>
> Each planet's nakshatra and nakshatra lord also colour how that planet acts (the nakshatra dispositor). It is widely used in South India and in all modern schools, and it is the basis of most "personality" summaries.

## 1. Sources
- **Brihat Jataka ch. 16** (Moon in each nakshatra, character results) and **ch. 17** (Moon in signs) (R; chapter titles not checked this session).
- **Brihat Samhita**: nakshatra character lists (R).
- **Hora Sara**, **Saravali ch. 33-34** (Moon in nakshatras) (R).
- **Jataka Parijata ch. 3**: nakshatra results (R).
- **BPHS ch. 46**: the Vimshottari dasha starts from the janma nakshatra and the balance of its lord's period (R).
- **BPHS ch. 46 vv. 85-86** (BPHS-ET, V as text): a birth at the start, middle or end of a pada gives full, middle or short span. It sits in the dasha chapter, probably in Kalachakra-dasha context. Do not treat it as a general natal rule until the context is checked.
- **BPHS ch. 9-10** "Evils at birth" and antidotes (V for the chapter titles): gandanta and ganda-moola births (R detail).
- [MODERN] K.N. Rao and B.V. Raman (nakshatra character); SJC (nakshatra-based remedies, Tara bala).

## 2. When it applies
- The Moon's nakshatra: personality, the dasha start, and compatibility (koota, handled elsewhere).
- Every planet's nakshatra: a modifier of how that planet acts (nakshatra lord = dispositor).
- Lagna nakshatra: a secondary personality layer [MODERN].

## 3. Inputs required
For the Moon, lagna and all planets:
- nakshatra index (1-27, and Abhijit if used);
- pada (1-4) and the navamsa of that pada;
- nakshatra lord (Vimshottari order);
- degree within the nakshatra.

Also gandanta proximity (the last ~3°20′ of water signs and the first ~3°20′ of fire signs) and the ganda-moola nakshatras (Ashwini, Ashlesha, Magha, Jyeshtha, Mula, Revati).

## 4. Calculation / rule
- Nakshatra = floor(Moon longitude ÷ 13°20′) + 1. Pada = floor((longitude mod 13°20′) ÷ 3°20′) + 1. Each pada equals one navamsa (Aries navamsa onwards from Ashwini pada 1).
- Lords repeat in the order Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury.
- Nakshatra dispositor chain: planet → its nakshatra lord → that lord's sign and house → …
- Gandanta: the junctions Cancer/Leo, Scorpio/Sagittarius and Pisces/Aries, within about 1 pada (or a narrower 48′ in some texts) either side.
- Ganda-moola: birth in one of the six junction nakshatras. The result depends on the pada.
- Tara (from the janma nakshatra), for natal use [MODERN]: count the nakshatra of each planet from the janma nakshatra, mod 9:
  - 1 Janma, 2 Sampat, 3 Vipat, 4 Kshema, 5 Pratyak, 6 Sadhana, 7 Naidhana, 8 Mitra, 9 Parama-mitra.
  - Planets in the 3rd, 5th and 7th tara are weakened [MODERN, SJC/K.N. Rao].

## 5. Interpretation rules
- [TEXT] The Moon in each nakshatra gives specific traits of body and character (BJ 16, Saravali, R). The lists vary by text.
- [TEXT] The dasha sequence begins from the janma nakshatra lord (BPHS 46, R).
- [TEXT] Gandanta and ganda-moola births are listed among the evils at birth, with propitiations (BPHS 9-10, V for the titles).
- [COMM] A planet gives results of its nakshatra lord's house and condition as well as its own (R; a well-known commentarial principle).
- [MODERN] SJC and K.N. Rao use the pada's navamsa sign as a fine-tuner. KP builds its whole system on nakshatra and sub lords, but KP is not classical and is excluded here.

## 6. Variants and disputes
- **Character lists**: Varahamihira, Saravali and Jataka Parijata differ in detail.
- **Gandanta span**: one pada vs 48′ vs 1°.
- **Abhijit** (the 28th) is used in muhurta and some natal schemes, but not in Vimshottari.
- **Weight of the lagna nakshatra**: a modern addition.

## 7. Worked micro-example
Moon at 15°00′ Taurus, i.e. 45° total:
- nakshatra = floor(45 ÷ 13.333) + 1 = 4 (Rohini);
- pada = floor((45 − 40) ÷ 3.333) + 1 = 2;
- lord: Moon.
- Moon in its own nakshatra, in its exaltation sign: a steady and comfort-loving disposition. The dasha starts in the Moon's period.

## 8. Design notes for AI Astra
- **Engine already has**:
  - nakshatra and pada in the facts;
  - `dosha.ganda_moola` (with `_get_ganda_moola_results`);
  - the avasthas export `lunar_astro` (nakshatra dispositor chains).
- **Must output**:
  - for the Moon, lagna and every planet: nakshatra (index and name), pada, pada navamsa sign, lord, degree in the nakshatra, and the tara from the janma nakshatra;
  - gandanta and ganda-moola flags with the span rule used;
  - the full dispositor chain.
- **Board use**:
  - Self board: personality, from the Moon nakshatra and lord.
  - Lucky board: the tara of the day, handled by the transit and muhurta researchers.
- **Weight**: high for temperament; low for events by itself.
- **Pitfalls**:
  - Never surface "evil birth" words. Ganda-moola is shown, if at all, as "a junction birth".
  - The character lists are generic. The product rule "specific to the person or not shown" means traits must be tied to other chart confirmations before display.

## 9. Open questions
- Verify the BJ 16 and Saravali nakshatra chapter numbers.
- Product decision: show nakshatra traits at all, given the no-general-prediction rule?
