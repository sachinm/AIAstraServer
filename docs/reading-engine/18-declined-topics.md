# 18 — Topics the app does not discuss, and user roles

Added 2026-10-25 from Sachin's instructions. Code: `src/reading/policy/declined.ts`, `src/auth/roles.ts`. Table: `declined_topics` (migration M5, `prisma/migrations/20261025100000_reading_m5_declined_topics`). Tests: `tests/unit/reading/declined.test.ts`.

## 1. The rule

Some topics are not discussed at all. The check runs **at every entry point, before any agent or model sees the text**:
- the chat answer, on every provider (reading engine, legacy Gemini, Groq, GraphQL `ask`);
- the clarifier's first question;
- every typed answer during clarification.

A match returns one fixed reply and nothing else is computed: no reading, no clarifying question, no model call, no data load.

## 2. Categories

| Category | Meaning | Stored message text |
|---|---|---|
| **deny** | Never facilitated, never accepted by any agent, never sent to any model. The reply is short and never repeats or engages with the content. Cannot be disabled from the database. | Withheld: stored as `[withheld: <topic id>]`, so it never comes back to the user in chat history or anywhere else |
| **decline** | Not answered. A short fixed reply, sometimes pointing to an answerable question. | Kept |
| **role_gated** | Declined unless the user's role has the capability. | Kept |

## 3. The list

| # | Topic id | Category | What it covers | Reply |
|---|---|---|---|---|
| 1 | `self_harm` | deny | self-harm or suicide | Crisis message with help lines (988 in the US, Tele-MANAS 14416 in India); no reading |
| 2 | `violence_harm` | deny | killing, hurting, attacking or harming people or animals; poisoning; "getting away with" harm | "AI Astra cannot help with that." |
| 3 | `curses_black_magic` | deny | curses, black magic, vashikaran, spells to control or harm someone | "AI Astra cannot help with that." |
| 4 | `crime` | deny | theft, robbery, fraud, drugs, smuggling, hacking, evading police, blackmail | "AI Astra cannot help with that." |
| 5 | `abuse_stalking` | deny | stalking, tracking someone secretly, harassment, controlling or forcing someone | "AI Astra cannot help with that." |
| 6 | `extremism` | deny | terrorism, extremism, bombs, explosives, weapons to attack | "AI Astra cannot help with that." |
| 7 | `sexual_minors` | deny | any sexual content involving minors | "AI Astra cannot help with that." |
| 8 | `death_lifespan` | decline | death, lifespan, longevity, maraka, "when will … die", for anyone | "AI Astra does not answer questions about death, lifespan or longevity, for you or anyone else." |
| 9 | `baby_sex` | decline | predicting or choosing a baby's sex | "AI Astra does not predict or help choose a baby's sex." |
| 10 | `third_party_surveillance` | decline | someone else's private actions: cheating, affairs, lying | "AI Astra does not answer questions about someone else's private actions …" |
| 11 | `gambling_markets` | decline | lottery or betting numbers, stock, coin or team picks, satta and matka | "AI Astra does not give lottery or betting numbers …" |
| 12 | `public_events` | decline | elections, disasters, wars, market crashes | "AI Astra reads your own chart. It does not forecast elections, disasters, wars or market moves." |
| 13 | `exact_amount` | decline | exact amounts of money, salary or inheritance | "AI Astra does not predict amounts of money. You can ask when income or savings are likely to grow instead." |
| 14 | `remedies` | decline | gemstones, mantras, pujas, rituals, upay, yantra | "AI Astra does not recommend remedies …" |
| 15 | `legal_advice` | decline | whether to sign, sue, plead or settle | "AI Astra does not give legal advice. Please talk to a lawyer. You can still ask about timing in your chart for a legal matter." |
| 16 | `health` | role_gated | illness, disease, diagnosis, symptoms, medication, accidents, injuries, surgery, hospital, recovery, mental-health conditions | "AI Astra does not answer questions about illness, disease, diagnosis, accidents or injuries." |

Checks run in this order: deny topics first, then decline, then role-gated. So "I want to die" is handled as self-harm, not as a death question.

### What is not caught (tested)

Detection is narrow on purpose, so a passing mention does not block a normal question. These are answered normally:
- "My father passed away last year; when will my career settle?"
- "Will Saturn harm my career?"
- "Will Rahu attack my family life this year?"
- "Will I become a doctor?"
- "Should I study medicine?"
- "When will I recover my money?"
- "I face unfair treatment at work"
- "the financial health of my business"
- "anxiety about my job interview"
- "How do I kill time while waiting for my visa?"
- "Will I win the case in court?"

## 4. Roles

| Role | Who | Health topics (`discuss_health`) |
|---|---|---|
| `novice` | every new registration (general public) | no |
| `public` | a member of the public with a settled account | no |
| `student` | astrology student | no |
| `astrologer` | practising astrologer | **yes** |
| `researcher` | research access | **yes** |
| `client_account_admin` | administers one client organisation's account | no |
| `aiastra_admin` | AI Astra staff | **yes** |

- **Registration:** new users are created with role `novice`. This is a code change in `authService`.
- **Legacy values:** these keep working. `user` reads as `novice`, `astrology_student` as `student`, and `admin`, `superadmin` and `support` as `aiastra_admin`. Admin GraphQL checks accept `aiastra_admin`.
- **Health override:** `READING_HEALTH_ROLES` (comma-separated) replaces the default list of roles that may discuss health.
- **Per-topic roles:** a topic row's `allowed_roles` column overrides the list for that topic.
- **No exceptions:** death, lifespan and every deny topic are closed for every role.
- **Not done yet:**
  - Rewriting the 25 existing `user` rows to `novice` and changing the column default from `user` to `novice` is a data migration on the live database. It has not been run.
  - Assigning roles in the admin screens is part of the auth and admin work.

## 5. The table

```
declined_topics
  id             text primary key        topic id (above)
  category       text                    deny | decline | role_gated
  label          text                    what the topic covers
  reply          text                    the fixed reply
  phrases        jsonb  default []       extra trigger phrases (matched on word boundaries)
  words          jsonb  default []       extra single trigger words
  allowed_roles  text[] default {}       role_gated: roles that may discuss it
  enabled        boolean default true    decline / role_gated can be switched off; deny cannot
  sort_order     int                     check order (deny 10–70, decline 100–170, role-gated 200)
  notes          text                    examples
  updated_at, updated_by
```

What the table can and cannot change:
- **Code floor:** the detection logic for every built-in topic stays in code. The table adds to it with extra phrases and words, changes replies and roles, adds new topics, and disables decline or role-gated topics.
- **Deny is fixed:** a row cannot disable a deny topic or downgrade it to decline.
- **Fallback:** if the table is missing or the database is unreachable, the built-in list applies.
- **Caching:** the table is cached for 5 minutes. On a cold start the first question uses the built-in list while the table loads in the background, so the gate never adds a wait.

**Status:** migration M5 was applied to the live database on 2026-10-25 with Sachin's approval and verified: 16 rows (7 deny, 8 decline, 1 role-gated). Evidence: `docs/screenshots/p2-01-declined-topics/`.

## 6. Where it sits in the flow

```
question ─► declined gate ─► (deny / decline / role_gated without the role) ─► fixed reply, stop
               │
               └─► answerable ─► clarifier ─► typed answers ─► declined gate again ─► … ─► reading
```
