# a16z speedrun SR008 application: questions, answers, video

Updated 2026-11-01. Deadline: **Sunday 1 Nov 2026, 11:59 PM Pacific** (1:29 PM IST on Monday 2 Nov). A late application
is still read, but for the next cohort.

The questions below come from the code of the public form at https://speedrun.a16z.com/apply, read on 2026-11-01. That
replaces the third-party guides an earlier version of this doc relied on. I did not open the form itself, because it
starts with your email. Which sections hide behind a toggle is partly inferred, so trust the live form if it differs.

## 1. Where we stand

Submit tonight. speedrun takes idea, prototype and early-product companies, and says traction is not required.

| Live database, 2026-11-01 | Accounts | Threads | Messages | Came back after day 1 |
|---|---|---|---|---|
| Not matching a founder or test email pattern | 25 | 33 | 87 | 8 |
| Founder or test emails | 7 | 62 | 137 | 2 |

The split is by email pattern only, so the 25 can still include friends and family. Do not quote 32 accounts or 95
threads as traction: most of the threads are ours.

Do not claim any of these:

- **Payment.** Plans and question limits are being built on `develop`; there is no payment gateway.
- **Accuracy.** `docs/TODOS.md` has open P0 items on stored chart facts. The business plan also bars accuracy claims
  before the benchmark, and the landing page breaks that rule with "NASA data" and "validated by Vedic scholars".
- **Open sign-up.** On 2026-11-01 the live API refused browser calls from https://vedic-astrology.app (CORS), so sign-up,
  sign-in and chat cannot work on that domain until its origin is allowed. Sign-up also fails once Cognito's daily email
  cap is reached (`docs/TODOS.md`).
- **Support contact.** The terms, privacy and refund pages exist, but they still say the support address "will be
  published". Do not imply a finished public launch.

## 2. Every question on the form

Limits: one-liner 100 characters, description 800. Experience, team and "anything else" appear to be 1,000 each; the
constants exist in the code, but I matched them to fields by inference.

**Team**

1. Are you full-time or part-time on the startup? *
2. Number of Full-Time Founders * ("Founders are individuals with over 10% equity. If you're part-time or not yet
   incorporated, enter 0 and add all co-founders in the section below.")
3. Total FTE Employees *, including founders
4. Founder Details *, starting with the CEO, then each co-founder: first and last name, email, phone number
5. Relevant experience * ("highlight your most relevant professional, startup, or industry experience. Focus on track
   record, domain expertise, and past wins.")
6. Country, state, city, citizenship, college or university, highest education
7. How many years of professional experience do you have? *
8. Are you technical enough to build the product end-to-end? *
9. LinkedIn, GitHub, X and portfolio URLs
10. Tell us more about the team * ("How does the team know each other? Is there anyone else on the team? Why is this
    the best team to win? Do you have any key advisors? Etc")

**Startup Details**

11. Startup Name *
12. Pitch your startup in one sentence. * ("What do you do and for whom? E.g. AI-powered therapist for Gen Z")
13. Startup Description * ("What problem are you solving? What are you building?")
14. Primary Category *, and Secondary Category (optional)
15. Where do you intend to build your startup? * (country, state, city)
16. When was your startup founded? * (year, month)
17. Company Website (optional)
18. Anything else we should know? (optional)

**Additional Information** ("Any additional information you share ... significantly improves the strength of your
application.")

19. Team Video (MP4), optional: script in section 5
20. Pitch Deck (PDF), optional
21. Traction: Product Launch Date *, general commentary on traction
22. Share Revenue (toggle): ARR, average annual contract value, net dollar retention, monthly growth
23. Share Usage Metrics (toggle): daily, weekly and monthly active users, monthly growth, D1, D7, D30 and M1 retention
24. Funding Summary (if funded): total raised, post-money valuation, date of last round *, monthly burn, runway
25. List your current investors * (if funded): name or firm, email, amount
26. Active Fundraising Round (if raising): How much are you raising? *, When did you start your fundraise? *, any
    deadlines (optional)
27. Referral: name, email, LinkedIn URL of whoever referred you
28. Where did you learn about speedrun?

## 3. Answers to paste

**Q12. One sentence (100 max)**

> Your personal Vedic astrologer of the ancient texts, reading the celestial sky for every curiosity.

99 characters. Sachin's required words (2026-11-02): "Your personal", "the celestial sky", "every curiosity";
"interpreting" or "reading"; "Vedic astrologer, mastered in the ancient texts" may be recombined. His full line is 109 with
"reading" and 114 with "interpreting", and any form of "mastered in (the) ancient texts" pushes it past 100, so only that
phrase was shortened. Other fits:

> Your personal Vedic astrologer, master of the texts, reading the celestial sky for every curiosity. (99)

> Your personal Vedic astrologer, steeped in the texts, reading the celestial sky for every curiosity. (100)

> Your personal Vedic astrologer, ancient-text master, reading the celestial sky for every curiosity. (99)

> Your personal Vedic astrologer, mastered in old texts, reads the celestial sky for every curiosity. (99)

> Your personal Vedic astrologer, versed in the texts, reading the celestial sky for every curiosity. (99)

**Q13. Startup description (800 max)**

> AI Astra is a Vedic astrology guru assistant. From your birth date, time and place it computes your chart and reads the sky: planets, nakshatras, house lordships and dashas. Every chart holds about 9,500 records of data, read by the rules of the ancient texts.
>
> A thorough private astrologer is a luxury of the wealthy. Everyone else pays a steep price for an hour and 1-3 questions, with no guarantee of quality and no money back, and much of that hour goes on flipping through charts. No human can master 9,500 records for every person and question, so things get skipped or misread. AI Astra ends that.
>
> Free users get 20 questions a month and upgrade to paid plans for more. The founder grew up in a house where everyone read astrology and built this to understand it.

772 characters, condensed from Sachin's edit of 2026-11-02. His price, session length, question count and no-refund points are his own market knowledge, not sourced here. The code sets Free at 20 questions a month, so the text says 20 rather than 10-20. "Every chart holds about 9,500 records" matches the approved landing page; one reading measured about 1,000, and 9,500 is an estimate of what can be computed per chart, not a measured count. "Advised by enthusiasts" was cut for length and can go in Q10.

**Q5. Relevant experience (1,000 max)**

> 22 years building multi-tenant SaaS across background checks, ATS, retail marketing, enterprise e-commerce, universities and life sciences, with up to 5,000 DAU. Forward-deployed engineer since 2019; on LLMs since GPT-3.5, first assistants for executives and researchers, then agentic AI that automates whole departments for small and mid-size firms. Automated retail assessments with a multi-agent voice, SMS and email workflow, replacing 2-5 hours of work by 5-15 people. Built a brand consistency study of 18,000 US auto dealerships using computer vision on 1.5M street-view images. UT Austin B.S. CS; St. Edward's M.S. CIS, GPA 4.0, Presidential Scholar.
>
> Why this: I have sought astrological readings since 1990 through hard family times. They were hit or miss, and the known greats are costly and booked by VVIPs. Testing GPT-4o, I saw LLMs know the ancient texts but cannot compute the sky reliably. So an engine computes each chart; agents read it.

956 characters, Sachin's edit of 2026-11-02, tightened. Figures are his (5-15 people, 2-5 hours, 18,000 dealerships) and differ from the earlier resume-based draft; confirm against the resume.

**Q10. Team (1,000 max)**

> Solo technical founder, full-time: Sachin Mohan, San Jose, CA. No cofounder. I own the product and the multi-agent DAG that reads the chart, with 460+ commits since March 2026 and earlier prototypes.
>
> Why I can win: this is a multi-agent system, and I have spent years shipping those as a forward-deployed and full-stack engineer. I have run SaaS with up to 60 clients on one codebase and 5,000 DAU under SLAs. My family has saved up for Vedic readings for my dad, my siblings and me, so I know the gaps: astrologers disagree, the good ones are overbooked and pricey for a handful of questions, and few are strong on every topic. People pay for this at scale: Astrotalk reported FY25 revenue up over 85% to Rs 1,214 crore.
>
> Advisor: my brother, a senior executive at Intel in San Jose, is well versed in Vedic astrology and advises on reading technique, the business plan and scaling.
>
> Next hire: full-time business development and a CPO, so the product serves mass consumers across age groups.

994 characters, Sachin's edit of 2026-11-02, tightened. 460+ is measured (461 on all branches since the repos' first commit on 2026-03-16, including agent-written commits under his name); his draft said 500+ since 2025. Astrotalk figure: CXO Digital Pulse, https://www.cxodigitalpulse.com/?p=43618. 60 clients, 5,000 DAU and the advisor role are his statements.

**Q18. Anything else (1,000 max)**

> Vision: open the map of a person's life to everyone. In Vedic astrology, the sequence of planets, houses, nakshatras and dashas is fixed by the moment of birth, which is why even twins and siblings live life differently. For centuries, priests and scholars read this for kings and the rich: when to act, when to plant and harvest, when to pause and avoid loss. AI lets us offer that unabridged reading to anyone, drawn from the ancient texts rather than passed through one person's interpretation, giving people perspective, hope and a plan for when to take risks, prepare for hard times or enjoy life.
>
> Where we go next: relationship compatibility for dating and marriage, business timing, and muhurta for lucky times to start. Then daily personal signals, such as mood and shopping patterns, making the "Mercury retrograde" cliche specific to each person, and personal luck timing for prediction markets and sports betting.

925 characters, condensed from Sachin's notes of 2026-11-02. It replaces the earlier 90-day plan. Dropped: "scientific", because nothing supports it. Open decision: the prediction-markets and sports-betting clause conflicts with the terms, which say not to rely on the service for any decision.

**Q21. Traction commentary**

> Early beta with no revenue. 25 non-team accounts, 33 threads, 87 messages; 8 people returned after their first day.
> Shipping: 327 commits across three repos since 1 September.

**Facts only you can give:** full-time or part-time (the resume lists two current jobs, and part-time means entering 0
full-time founders), citizenship, founding date, launch date, incorporation, funding, whether you are raising, any
referral, and whether "solo" is accurate. The LinkedIn headline also says "CoFounder; Cryptocurrency". If that is live,
disclose it, because reviewers will see it.

## 4. Things I removed from earlier drafts

- "60 divisional charts": D1 to D60 is about 20 charts.
- "Golden-chart evals on every change": the eval is a manual command, and its G1 fixture is a stand-in (`docs/TODOS.md`).
- "Consumer SaaS at Alliant, Movista, IBM Kenexa": the resume describes Movista as B2B, and Kenexa as talent software.
- "CU Anschutz": the resume says University of Colorado Medical Center.
- "Zero tolerance for hallucination" and "the model never invents placements": unproven claims that invite a test.
- "Users come back (95 threads from 32 accounts)": most of those threads are ours.
- "Full time on acceptance", "funded by consulting", "outside funding: none", and being in San Francisco: I wrote these
  without evidence.

## 5. Demo: make the video; add the URL only after the landing page is fixed

**The video** is an MP4 upload on the form: optional, at most 3 minutes, at most 1 GB. The form's own brief says "Spend
at least half on you and your team". The FAQ asks for your own voice, and says production quality is not judged.

**The URL goes in Company Website (Q17), which is optional.** Use https://vedic-astrology.app, but only after two checks.
Its API calls must work, because they were blocked on 2026-11-01, and you must complete one real sign-up on it. The old
https://production.d20sdo476h9w6c.amplifyapp.com site still showed "Cosmo Vedic" and the unsupported claims when last
checked, so never use that one. If the two checks are not done by the deadline, leave Q17 blank.

**The name** is AI Astra in the site and in Q13. Use the same name in Q11 and the video.

### What to show, and what to leave out

| Show | Why it is safe |
|---|---|
| The chat, with one real question on your own chart | This is the core of the product |
| The reading stages panel: Understanding, Chart facts, Promise, Dasha, Transits, Nakshatras, Cross-check, Writing | It shows the multi-agent work on screen |
| Your D1 chart, for two seconds at most | `docs/TODOS.md` lists signs, houses and dasha dates as right |

| Leave out | Why |
|---|---|
| Landing page | The video should spend its time on the product |
| Sign-up and birth-date entry | The email cap can refuse sign-up, and typed dates are read as DD/MM |
| Pricing and upgrade screens | There is no payment gateway |
| Yogas, shadbala, dignities | Open P0 errors in `docs/TODOS.md` |
| The words "accurate" or "validated" | There is no benchmark yet |

I did not log in, so the signed-in screens are not verified on the live site. The stages panel is in the web code merged
to staging. Do the dry run below first. If the panel does not appear, cut that line of the script.

### Script, about 2:30

**0:00-1:20, on camera. You and why you.**

> I'm Sachin Mohan. I'm building AI Astra, a Vedic astrology companion for people who would otherwise pay a human
> astrologer by the session. [Your Jyotish line: how many years, which tradition, why you care.]
>
> I've spent 22 years building multi-tenant SaaS, the last five leading AI work directly with customers. My best result:
> at Pied Piper, a retail assessment took 25 to 50 people and 2 to 5 days. I replaced it with a multi-agent voice, SMS
> and email workflow that returns audited results in under 15 minutes. I also built an answer assistant for 8,000
> dealership groups, and a medical-school assistant that cleared FERPA and HIPAA review.
>
> That is what this product needs: many agents, one answer, and checks you can audit. In astrology, one wrong placement
> spoils everything after it. So a calculation engine computes the chart, and the agents read from it. I've been building
> this since March. [Solo or not, full-time or part-time.]

**1:20-2:05, screen recording, your voice over it. The product.**

> This is my own chart, and a real question. [Type the question.] A general chatbot would start writing right away. This
> one works through the chart first. You can see the stages: chart facts, then dasha, transits and nakshatras, a
> cross-check, and then the writing. It takes over a minute, so I've cut the wait. [Cut to the finished answer, and
> scroll to the dated part.] Here's the answer, with timing from my own dasha periods.

**2:05-2:30, on camera. Progress and why it gets big.**

> It's an early beta with no revenue. 25 accounts outside my own and test emails, and 8 of them came back after day one.
> In the next 90 days: payment, three life-domain dashboards, and a blind accuracy test with two practising astrologers.
> People already pay for this by the session. And everyone here gives us birth date, time and place, which opens up
> compatibility and matching later. Thanks for watching.

The script is about 300 words, which runs close to 2:30 with the pauses on screen. Read it once in your own words instead of reciting it.

### Recording, in order

1. **Sign in first, on the release-candidate-staging site or on vedic-astrology.app once it works, and stay signed in.** Sign-in codes go through the same capped email sender as
   sign-up, so avoid asking for extra codes.
2. **Dry run the question.** Try: "When does my career open up over the next 12 months, and what should I do about it?"
3. **Read the answer before you use it.** Reject any answer that leans on yogas, shadbala or Rahu's dignity, and ask
   again with a different question. Pick one that gives dated dasha periods.
4. **Check the screen.** Hide anything you do not want reviewers to see, such as your exact birth time and other threads.
5. **Record the two camera parts in one take, on a phone or laptop.** Record the screen part separately.
6. **Join them in any editor, cut the wait, and export MP4.** Check it is under 3:00 and under 1 GB.

## 6. Business plan and deck

The form accepts an optional PDF deck, and a16z says a deck is not needed and "can sometimes get in the way". Skip it
tonight. Do not send the current plan: it has June 2026 dates with a roadmap already past, a placeholder team, TAM of
both 300M and 600M, two sets of Pro and India pricing, and section 8.3, which sells divorce, fertility and health
signals to advertisers.

## 7. Tonight, in order

1. Fill the brackets and the facts in section 3.
2. Record the video.
3. Open the form, check the questions match, paste, upload. Leave Company Website blank unless sign-up works on vedic-astrology.app.
4. Submit before 11:59 PM PT.

The form code includes an "update your submission" dashboard, while a16z's FAQ says applications cannot be edited and
that updates go by email to sr-team@a16z.com. Treat the submission as final.

Sources: public form code (https://speedrun.a16z.com/apply), FAQ (https://speedrun.a16z.com/faq), speedrun Q&A
(https://speedrun.substack.com/p/top-71-questions-about-a16z-speedrun).
