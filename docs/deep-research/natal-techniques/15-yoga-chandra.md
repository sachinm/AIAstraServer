# Chandra yogas — lunar yogas (Sunaphā, Anaphā, Durudharā, Kemadruma, Adhi)

> These yogas are formed by planets on either side of the Moon:
> - Sunapha: a planet in the 2nd from the Moon.
> - Anapha: a planet in the 12th from the Moon.
> - Durudhara: planets in both.
> - Kemadruma: neither, so the Moon is "alone"; this is a poverty and isolation yoga with well-known cancellations.
> - Adhi: benefics in the 6th, 7th and 8th from the Moon.
> - Chandra-Mangala: the Moon with Mars.
>
> The Sun is excluded in all of them. They describe resources and emotional support around the mind (Moon). They are universal in all schools, and Kemadruma is the most discussed.

## 1. Sources
- **BPHS ch. 37 "Lunar yogas"** (BPHS-ET), all (V):
  - Sunapha, Anapha and Durudhara exclude the Sun;
  - Kemadruma: no planet (other than the Sun) with the Moon, in the 2nd or 12th from it, or in a kendra from the lagna;
  - Adhi: benefics in the 6th, 7th and 8th from the Moon.
  - E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **Brihat Jataka ch. 13** (BJ-Neely Sanskrit: https://www.wisdomlib.org/hinduism/book/brihat-jataka-by-varahamihira-sanskrit-english/d/doc1501548.html). Marked **V-Sa**: the page has only Sanskrit, and these points come from a fetch model's reading of it, not from a translation:
  - 13.2: Adhi;
  - 13.3: "hitvārkaṃ", excluding the Sun; Kemadruma when neither side is occupied; cancelled if the Moon is in a kendra or with a planet;
  - 13.4: the counts of varieties;
  - 13.5-7: the results;
  - 13.9: the Moon is strong with benefics in upachayas.
- **Phaladeepika ch. 6** (Kemadruma and its cancellations, R).
- **Saravali ch. 13** (R).

## 2. When it applies
D1, counting from the Moon. Wealth, mind, support and the social network.

## 3. Inputs required
- The Moon's sign.
- The planets (Mars-Saturn; Rahu and Ketu disputed) in the Moon's 2nd, 12th and kendras, and with the Moon.
- The planets in kendras from the lagna.
- Benefics in the 6th, 7th and 8th from the Moon.
- Paksha (waxing or waning) and the Moon's strength.

## 4. Calculation / rule
| Yoga | Condition | Source |
|---|---|---|
| Sunapha | Any of Ma, Me, Ju, Ve, Sa in the 2nd from the Moon | BPHS 37 (V), BJ 13.3 (V) |
| Anapha | Any of them in the 12th from the Moon | same |
| Durudhara | Planets in both the 2nd and 12th from the Moon | same |
| Kemadruma (BPHS) | No planet (excluding the Sun) with the Moon, in the 2nd or 12th from it, and none in a kendra from the lagna | BPHS 37 (V) |
| Kemadruma (BJ) | No planet in the 2nd or 12th from the Moon (Sun excluded) | BJ 13.3 (V-Sa) |
| Kemadruma cancellation (BJ) | Read as: the Moon in a kendra, or the Moon conjoined with a planet. Unconfirmed whether the verse means the *Moon* in a kendra or *a planet* in a kendra | BJ 13.3 (V-Sa) |
| Kemadruma cancellation (PD, Raman) | A planet in a kendra from the Moon; the Moon aspected by Jupiter; the Moon in a kendra; the Moon in own or exaltation sign; and others | R |
| Adhi | Benefics (Me, Ju, Ve) in the 6th, 7th and 8th from the Moon (all three, or some, with grades) | BPHS 37 (V), BJ 13.2 (V) |
| Chandra-Mangala | The Moon conjoined with Mars | BPHS 36-37 (R) |

Rahu and Ketu are excluded by most [COMM]. BJ and BPHS name only the five tara grahas.

## 5. Interpretation rules
- [TEXT] Sunapha gives self-earned wealth, intelligence and fame. Anapha gives a healthy body, virtue and contentment. Durudhara gives wealth, vehicles and generosity (BJ 13.5-6, V).
- [TEXT] Kemadruma gives poverty and unhappiness, even in a royal birth (BJ 13.6, V).
- [TEXT] Adhi yoga makes the person a minister or leader: healthy, long-lived and prosperous (BJ 13.2, V; BPHS 37, V).
- [TEXT] Specific results follow from the planet in the 2nd or 12th: Mars courage, Mercury arts, Jupiter righteousness, Venus wealth and pleasures (BJ 13.7, V).
- [MODERN] Most modern authors find uncancelled Kemadruma rare. They read it as emotional isolation or uneven support, not literal poverty.

## 6. Variants and disputes
- **Definition**: BPHS adds "no planet in a kendra from the lagna" into the Kemadruma definition itself (V). BJ appears to use a kendra condition as a cancellation (V-Sa). If BJ means "a planet in a kendra", the two texts agree in substance and the difference is only one of framing. This needs a translation check.
- **Cancellation lists**: these grow in later texts (Phaladeepika, Raman's compilations). BJ 13.3 notes that some authorities reject the navamsa-based condition (V).
- **Rahu and Ketu**: whether they count for Sunapha and Anapha.
- **Adhi yoga**: counted from the Moon (BJ, BPHS) or from the lagna (Lagnadhi, a separate yoga).

## 7. Worked micro-example
Moon in Libra, Jupiter in Scorpio (2nd from the Moon), Saturn in Virgo (12th from the Moon):
- Durudhara.
- Kemadruma is not formed.

## 8. Design notes for AI Astra
- **Engine already has**:
  - `yoga.sunaphaa/anaphaa/duradhara/kemadruma/chandra_mangala/adhi_yoga_from_planet_positions`;
  - `lagnaadhi_yoga`.
- **Must output**:
  - each yoga's presence and the planets involved;
  - for Kemadruma: the definition variant (BPHS or BJ), each cancellation tested with its result and source, and the final status (formed, cancelled or absent);
  - the Moon's paksha and strength.
- **Board use**: Self (emotional support, resources), Love (support network).
- **Weight**: low-medium. Flavour, not destiny.
- **Pitfall**: never surface "Kemadruma = poverty". If formed and uncancelled, phrase it as "you tend to carry things alone", and only when other factors agree.

## 9. Open questions
- Check the Phaladeepika ch. 6 cancellation verse list.
