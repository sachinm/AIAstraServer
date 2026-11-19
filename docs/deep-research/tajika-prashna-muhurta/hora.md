# Hora: planetary hours (kāla-horā)

> Each day is divided into 24 horās. The first horā after sunrise belongs to the weekday's lord, and the rest follow
> the descending "Chaldean" order of planetary speed (Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon). The weekday
> sequence itself comes from this order. A planet's horā suits that planet's matters (Venus: love and arts; Mercury:
> trade and study; and so on). Used across India for quick daily choices. It is ancient (Hellenistic planetary hours,
> adopted in Indian texts) and simple. The equal vs. unequal hour length is disputed.

## 1. Sources

| Text | Status |
|---|---|
| *Sūrya-siddhānta* 1 (weekday from horā lords) | Basis of the weekday order [TEXT]. Verse not read |
| *Muhūrta-cintāmaṇi* / *Muhūrta-mārtaṇḍa* (kāla-horā use) | Chapter level, not verified |
| *Hāyanaratna* ch. 7 §4: Tajika horā-based periods; ch. 7 §11: use when the revolution's horā lord is strong | Gansten 2020 [TEXT] |
| Doc 47 §3.4 hora → activity table (Drik Panchang) | [MODERN] |

## 2. When it applies

Daily and hourly selection. In Tajika, the horā lord at the revolution also selects a dasha system (HR ch. 7 §11).

## 3. Inputs required

Sunrise and sunset (and next sunrise), weekday.

## 4. Calculation

- Lord order (descending speed): Saturn → Jupiter → Mars → Sun → Venus → Mercury → Moon → Saturn …
- Horā 1 = the weekday lord. Each next horā takes the next planet in the order. Horā 25 = the next weekday's lord (which is how the weekdays arise).
- Length: **unequal** (day/12 for horās 1–12, night/12 for 13–24) vs. **equal** (60 minutes from sunrise, the
  Siddhāntic 2½ ghaṭīs). Indian almanacs differ. Drik Panchang uses unequal [MODERN].

## 5. Interpretation rules [COMM/MODERN, verse not verified]

| Lord | Good for |
|---|---|
| Sun | Government, authority, meeting superiors, medicine |
| Moon | Travel, public, liquids, starting new things that should grow |
| Mars | Property and land deals, surgery, sport, confrontation |
| Mercury | Trade, writing, study, communication, contracts |
| Jupiter | Education, ritual, finance, advice, marriage talks |
| Venus | Romance, arts, clothes, jewellery, pleasure, vehicles |
| Saturn | Labour, repairs, old matters. Avoided for new starts |

## 6. Variants and disputes

Equal vs. unequal horās (above). Whether horā overrides a bad panchang limb (generally no: horā is a fine-tuning layer).

## 8. Design notes for AI Astra

- Engine (served): 24 horās with lords per day (doc 47 §1). Engine addition: `hora.length_rule` (equal|unequal) as a
  returned field and parameter. Confirm which rule `daily_export` uses and document it in `docs/daily-types.md`.
- Serves: Lucky Times life-area labels (doc 47 §3.4 maps the Sun and Jupiter to work, Venus to love, and so on). The
  mapping table belongs in config with its source, as doc 47 says. Weight: a fine layer inside clean windows.

## 9. Open questions

- Which length rule is the product default? Recommend unequal (matches Drik, which users compare against).
