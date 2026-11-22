# Rahu/Ketu transits and eclipses on natal points (rāhu-ketu-gocara, grahaṇa)

> The nodes move backward through each sign in about 18 months. Eclipses are the nodes' events. The texts treat an
> eclipse falling on the janma star group as a severe trigger (Phaladeepika 26:29). Node transits over natal
> planets, the Lagna and the Moon are read heavily in modern practice.

## 1. Sources
- **Phaladeepika 26:2** includes the nodes (bhoginau) in the good-house list; see `01-gochara-from-moon.md` for the dispute. https://www.siva.sh/phaladeepika/26/1-5
- **Phaladeepika 26:29:** an eclipse, sankranti, sign change, planetary war or meteor that afflicts the janma triad (stars 1, 10 and 19 from the janma star) brings danger. https://www.siva.sh/phaladeepika/26/26-30
- **Phaladeepika 26:43, 26:45:** Rahu's latta is the 9th star backward; Rahu's and Ketu's latta bring misery. https://www.siva.sh/phaladeepika/26/41-45
- **Brihat Samhita ch. 5** (Rahucharita, on eclipses) covers mundane eclipse effects. Not opened in this pass.

## 2. When it applies
- Node sign stays, about 18 months each.
- Eclipses: about 4-7 a year.
- Life readings and Self/Today alerts.

## 3. Inputs required
- The nodes' signs and nakshatras.
- The eclipse instants and eclipsed longitudes.
- The natal Moon, its star, the Lagna and the natal planets.

## 4. Calculation / rule
1. **House from the Moon.** [COMM] The nodes are good in 3, 6 and 11 (most practice), using the vedha pairs of Saturn.
2. **[TEXT] Eclipse on the janma triad** (PD 26:29). The eclipse is a danger trigger when either of these falls in the janma star or its trines (the 10th or 19th star):
   - the eclipsed luminary's star;
   - the eclipse point.
3. **[MODERN] Eclipse on natal points.** The eclipse longitude falls within a few degrees of the natal Sun, Moon, Lagna or a dasha lord.
4. **[MODERN] Nodal axis over the natal axis.** The transiting nodes cross the natal Moon–Lagna axis or the natal nodal axis. The nodal return comes at about 18.6 years and the reversed return at about 9.3 years.

## 5. Interpretation rules
- **[TEXT] PD 26:29:** danger to life when the janma triad is afflicted during an eclipse.
- **[COMM]** Rahu over the natal Moon brings anxiety and confusion. Ketu over the natal Moon brings detachment and loss. Rahu in the 3rd, 6th or 11th from the Moon brings gains.
- **[MODERN] K.N. Rao and SJC:** nodes transiting over dasha lords trigger the results of that dasha.

## 6. Variants and disputes
- **Good houses for the nodes:** 3, 6 and 11 (most practice) against "like the Sun" (one reading of PD 26:2).
- **Mean or true node:** the engine uses the mean node.
- **Eclipse orbs:** none are given in the classical texts.

## 7. Worked micro-example
1. The janma star is Ardra (6).
2. A lunar eclipse falls with the Moon in Svati (15), which is the 10th star from Ardra: the karma star of the janma triad.
3. PD 26:29 flags it, so read it as a caution for work, gated by the dasha.

## 8. Design notes for AI Astra
- **Engine:** eclipses with longitudes already exist (`transit_range_export.py`).
- **Engine additions:**
  - eclipse star and its tara or janma-triad label for the person;
  - eclipse contacts within an orb to natal points, through `transit_contacts`;
  - node good/bad by house from the Moon, with a variant flag.
- **Board:** Today/Self alerts only when an eclipse hits a natal point or the janma triad.
- **Weight:** low-medium; higher if the dasha is of a node.
- **Pitfall:** no fear language. The text's "death" wording must never reach the user.

## 9. Open questions
- Settle the orb policy for eclipse contacts.
- Settle the nodes' good-house rule.
