# Visit log and assistant log: controls (SOC 2 evidence)

Written 2026-11-02. SOC 2 does not require collecting IP addresses. It requires that what is collected is listed, has a
purpose, is protected, is limited in time, and that access is controlled. This note records each of those for the two
tables, and what is not yet in place.

| Field | Table | Purpose | Kept |
|---|---|---|---|
| Full IP address | `assistant_visits.ip_full` | Security investigation, abuse limits | 30 days, then cleared |
| IP prefix (/24, /48) | `assistant_visits.ip_prefix` | Abuse patterns over time | 400 days |
| User agent, country, language, referrer, first page | `assistant_visits` | Security, product use | 400 days |
| Random visit id | both tables, and the visitor's browser | Linking one visit's records | 400 days |
| IP at question time | `assistant_questions.ip` | Tying a question to a source during abuse | 90 days |
| Question and answer | `assistant_questions` | What people ask, quality, abuse | 90 days. A `deny` topic's text is never stored |

**Purge:** `PrismaAssistantStore.purge`, run from `POST /events` with the cache sweep. Rows with `legal_hold = true` are
kept.

**Sent to the model:** the question only. No IP, user agent or visit id.

**Notice:** Privacy Policy sections 2, 3, 4, 6 and 8, and the line under the assistant's input.

## Not yet in place

These are gaps an auditor would ask about, filed in `docs/TODOS.md`:

- **Access control:** readable by anyone with `DATABASE_URL`. No read route, and no log of who read what.
- **Erasure:** no route for a person's request; done by hand with SQL for now.
- **Encryption of these columns:** at rest only as Render provides; the field-level encryption in `docs/privacy/01` does not
  cover them yet. The database is outside AWS.
- **Legal review:** the Privacy Policy wording has not had a lawyer's review. IP logging of visitors without an account has
  GDPR and India DPDP consequences to check before marketing there.
- **A second visit log:** Google Analytics also sends visitor data to Google. The privacy plan should decide if it stays.
- **Not a SOC 2 report:** this is one control's evidence. A report needs an auditor and a wider programme.
