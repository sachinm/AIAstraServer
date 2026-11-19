# Transits from the Lagna vs from the Moon (lagna-gocara vs candra-gocara)

> The classical gochara chapters count from the natal Moon sign. Phaladeepika 26:1 says explicitly that of all the
> lagnas the Moon sign is chief for transits. Brihat Samhita 104 also counts from the birth Moon. Counting from the
> Lagna is used for which house a transit activates (its topic), and in modern practice for double transit and
> house-based readings.

## 1. Sources
- **Phaladeepika 26:1** (siva.sh): candra-lagnaṃ pradhānam ... gocareṣu. https://www.siva.sh/phaladeepika/26/1-5
- **Brihat Samhita ch. 104** (Chidambaram Iyer, 1884): all effects counted from the birth-Moon sign. https://www.wisdomlib.org/hinduism/book/brihat-samhita/d/doc229368.html (read from a search snippet only; the page was not opened)
- **Jataka Sara Deepa** (secondary summary): transits are judged from the janma rasi, not the Ascendant. https://theeyeofvedas.blogspot.com/2025/11/chapter-44-gochara-phala-adhyaya.html

## 2. When it applies
Every transit reading.

## 3. Inputs required
- The natal Moon sign and the Lagna sign.
- The transit signs.

## 4. Calculation / rule
1. **[TEXT] Good or bad verdict:** the house from the Moon, per PD 26.
2. **[COMM] Topic:** the house from the Lagna tells which area of life the transit touches.
3. **[TEXT] Ashtakavarga:** BAV and SAV are reference-free. The Lagna is one of the eight contributors, so the Lagna enters AV that way.
4. **[MODERN] Both references:** many modern astrologers read transits from both the Lagna and the Moon, sometimes from the Sun too (Sudarshana-style), and give more weight when they agree.

## 5. Interpretation rules
- **[TEXT]** PD 26:1: the Moon is chief.
- **[COMM]** When the Moon and the Lagna are in the same sign, or the Moon is strong, the Moon-based verdict is decisive. When the Moon is weak (for example a waning Moon, or one afflicted at birth), some give the Lagna more weight. Traditional; verse not located.
- **[MODERN] SJC:** transits are also read from the arudha lagna for perceived and material events.

## 6. Variants and disputes
- **The verdict:** the classical position is the Moon; the modern position is both.
- **Strength:** Sudarshana chakra uses all three references (Lagna, Moon, Sun) with equal standing. That is from BPHS, for dasha-like progression, not gochara.

## 7. Worked micro-example
1. Lagna Leo, Moon Scorpio.
2. Jupiter in Pisces is the 5th from the Moon: good (if no vedha in the 4th from the Moon, Aquarius).
3. It is the 8th from the Lagna: the topic is joint money, research or in-laws.
4. Verdict: a good transit in 8th-house matters.

## 8. Design notes for AI Astra
- **Engine:** `house_from_moon` and `house_from_lagna` (`natal_house`) both already exist.
- **Product rule:** the verdict comes from the Moon (with vedha and AV); the topic comes from the Lagna. Never derive either in Node.
- **Pitfall:** the boards must not show conflicting verdicts from two references. Show one verdict and one topic.

## 9. Open questions
- Is there a classical verse for preferring the Lagna when the Moon is weak? Not located.
