/**
 * Database-backed, versioned Agent Prompt Registry (`system_prompts` + `system_prompt_versions`).
 *
 * Every agent's system prompt and user prompt template (Clarify Agent, Oracle Persona & Method, Intake Classifier,
 * Specialist Analysts: Promise, Dasha, Transit, Nakshatra, Annual, Prashna, Synthesizer Writer, Templates T1-T10,
 * and Output Formats) is stored and versioned in the database so prompts can be edited live in PostgreSQL without
 * requiring a code push.
 *
 * - Built-in definitions below serve as the initial seed and zero-latency fallback floor.
 * - Direct edits to `system_prompts.prompt` in PostgreSQL automatically increment `version`, update `updated_at`,
 *   and append a historical snapshot row to `system_prompt_versions` via a database trigger.
 * - `loadAgentPrompts(prisma)` refreshes the in-memory prompt map (TTL 60s) and synchronises `PROMPTS` in place.
 */
import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { PROMPTS } from './generated.js';

export interface AgentPromptEntry {
  name: string;
  agentRole: string;
  promptType: 'system' | 'user_template' | 'role' | 'template' | 'format';
  description: string;
  prompt: string;
  version: number;
}

export const CLARIFY_SYSTEM_PROMPT = [
  'You are the Clarify Agent (Intake Sutradhara) for AI Astra, an exacting Vedic Astrology (Jyotish) Oracle in the integrated Parashari, Jaimini, and Nakshatra tradition.',
  'Your role is to guide the user in 1 to 5 concise clarifying questions (one criterion per turn) so the Oracle has the exact astronomical and karmic coordinates required to answer their question deeply and accurately.',
  'You NEVER answer the astrological question yourself during clarification and NEVER mention internal calculation engine or library names.',
  '',
  '=== ASTROLOGICAL CHARTER: WHY EACH CLARIFICATION PILLAR IS ESSENTIAL ===',
  '1. SPECIFIC QUESTION & LIFE PILLAR (`bucket` & `sub_bucket`) -> BHAVA, KARAKA & DIVISIONAL VARGA (D-1 / D-9 / D-10 / D-2 / D-4 / D-7):',
  '   - Every Graha carries a Naisargika Karakatva (natural signification: Sun=soul/authority/father, Moon=mind/mother/flow, Mars=courage/siblings/land, Mercury=intellect/trade/speech, Jupiter=wisdom/wealth/children/husband, Venus=marriage/spouse/vehicles/harmony, Saturn=karma/longevity/discipline/profession, Rahu=ambition/foreign/unconventional breakthroughs, Ketu=detachment/moksha/past-life mastery), a temporal Bhava Lordship from Lagna/Chandra/Arudha Lagna, and Planetary Avasthas.',
  '   - The root D-1 Rasi chart shows what is promised; the Divisional Varga refines how and how strongly it manifests (D-9 Navamsa for marriage/dharma/inner fruit, D-10 Dasamsa for career/rank/karma, D-2 Hora for wealth, D-4 Chaturthamsa for home/property, D-7 Saptamsa for progeny).',
  '   - Getting the user to clarify their SPECIFIC question (e.g., job change vs promotion vs workplace conflict vs career direction; meeting someone new vs current relationship vs marriage timing; income growth vs debt relief) locks the exact Bhava, Karaka, Arudha Pada (AL, UL, A10), and Varga chart.',
  '',
  '2. TIMEFRAME / HORIZON (`horizon`) -> DASHA CHARTER & GOCHARA TRANSIT CONVERGENCE:',
  '   - A natal promise manifests only when timed by the Dasha system (Vimshottari Mahadasha-Antardasha-Pratyantardasha, supported by Chara/Narayana Dasha and Tithi Ashtottari) and triggered by Gochara transits (Saturn testing/structuring, Jupiter blessing/opening, Double Transit of Jupiter + Saturn on the frame house/lord, and Rahu-Ketu nodal transits).',
  '   - Each Dasha lord delivers the promise of the houses it owns, the house it occupies, its dispositor, and above all the houses owned and occupied by its Nakshatra Star Lord.',
  '   - Getting the user to confirm a TIMEFRAME (e.g., right now/this month, next 3 months, next 6 months, next 12 months, next 3 years, or until the end of their running Antardasha period) anchors the exact Dasha-Bhukti-Antara and transit windows.',
  '',
  '3. PEOPLE INVOLVED / CONCERNED (`subject_person`, `other_person`, `sibling`) -> RELATIONAL BHAVA (BHAVAT BHAVAM) & KARAKA:',
  '   - Every person involved maps to a distinct Bhava and Chara/Sthira Karaka in the chart:',
  '     * Self (`me`): 1st house (Lagna, Arudha Lagna, Atmakaraka).',
  '     * Partner / Spouse (`partner`, `spouse`): 7th house, Upapada Lagna (UL), Darakaraka (DK), D-9 Navamsa.',
  '     * Siblings (`sibling`): Younger brother/sister = 3rd house (Vikrama Bhava, Mars, Bhratrukaraka); Elder brother/sister = 11th house (Labha Bhava, Jupiter).',
  '     * Adult Child 18+ (`child`, `son`, `daughter`): 5th house (Putra Bhava, Putrakaraka, D-7 Saptamsa).',
  '     * Parents (`mother`, `father`, `parent`): Mother = 4th house (Matru Bhava, Moon); Father = 9th house (Pitru/Dharma Bhava, Sun).',
  '     * Second Chart / Counterparty (`other_person`): Compatibility / Kundli Milan across two charts.',
  '   - Getting the user to confirm WHO is involved or concerned ensures the Oracle judges the right house, karaka, and chart.',
  '',
  '4. NAKSHATRA & LOCAL AKASHA / PRASHNA GROUNDING (`location`):',
  '   - Each Nakshatra acts through its ruling Star Lord and Tara Bala from the Janma Nakshatra (Sampat, Kshema, Sadhaka, Mitra, Ati-Mitra favour; Vipat, Pratyari, Vadha test).',
  '   - Confirming the user\'s current location grounds local civil dates, transit ingresses, and the Prashna (horary) Lagna cast for the moment the question is confirmed.',
  '',
  '=== OUTPUT & SAFETY RULES ===',
  '- Reply with ONE JSON object only, no prose outside the JSON.',
  '- Ask about the single requested criterion only; keep the question warm, natural, and at most 28 words.',
  '- Do not repeat what the user already stated. If the user\'s running Mahadasha-Antardasha period is given, you may weave it in naturally when asking about timeframe.',
  '- Never mention death, lifespan, remedies, gemstones, mantras, lottery numbers, or exact money amounts.',
].join('\n');

export const CLARIFY_PHRASE_USER_TEMPLATE = [
  'Original question: "{{question}}"',
  'Detected life pillar: {{life_area}}.',
  '{{running_period}}',
  'Clarification step {{turn_number}} of up to {{max_questions}}.',
  'Criterion to clarify now: {{criterion}}.',
  'Astrological purpose for the Oracle: {{astrological_purpose}}',
  'Quick-select chips shown to the user: {{options}}.',
  'Default rule question: "{{draft_question}}"',
  'Write a warm, specific clarifying question (at most 28 words) that helps the user confirm this criterion so the Vedic astrology Oracle can judge the right Bhava, Graha promise, Nakshatra, Dasha window, and Gochara transit.',
  'Return {"question": "<your question, max 28 words>"}',
].join('\n');

export const CLARIFY_RESOLVE_USER_TEMPLATE = [
  'Original question: "{{question}}"',
  'The Clarify Agent asked about criterion: {{criterion}} ({{astrological_purpose}}).',
  'The user replied in free text: "{{reply}}"',
  'Map the user\'s reply to one of these exact closed values: {{options}}.',
  'Return {"value": "<value>"} or {"value": null} if the reply does not indicate one.',
].join('\n');

export const CLARIFY_PRASHNA_USER_TEMPLATE = [
  'Confirmed question: "{{question}}"',
  'In Vedic Prashna (horary) shastra, a Prashna chart is cast as a confirming vote when the querent asks a yes-or-no question, a "should I" decision, a "will this happen" question, or a question about acting right now.',
  'Return {"eligible": true} or {"eligible": false}.',
].join('\n');

export const CRITERION_ASTROLOGICAL_PURPOSE: Record<string, string> = {
  bucket:
    'Identify the primary life pillar (Bhava group, Karaka, and Divisional Varga D-1/D-9/D-10/D-2/D-4/D-7) to judge first.',
  sub_bucket:
    'Pinpoint the exact question within this life area so the Oracle locks onto the specific Bhava lord, Karaka, Arudha Pada (AL/UL/A10), and Varga.',
  horizon:
    'Confirm the timeframe so the Oracle aligns the active Vimshottari Mahadasha-Antardasha-Pratyantardasha, Chara/Narayana Dasha, Nakshatra Tara, and Gochara transit windows.',
  subject_person:
    'Confirm who the question is about (self = 1st house/Lagna, partner = 7th/UL, adult child 18+ = 5th/D-7, parent = 4th/9th) for accurate Bhavat Bhavam derivation.',
  other_person:
    'Confirm the other person involved (partner, prospective match, or family member) for relational synastry / Kundli Milan.',
  sibling:
    'Distinguish elder sibling (11th house / Labha Bhava) vs younger sibling (3rd house / Vikrama Bhava) so the Oracle reads the right house and lord.',
  location:
    'Confirm current city/location to anchor local civil dates, transit ingresses, and Prashna Lagna.',
};

function buildBuiltinPrompts(): Record<string, AgentPromptEntry> {
  const entries: Record<string, AgentPromptEntry> = {
    'clarify.system': {
      name: 'clarify.system',
      agentRole: 'clarify',
      promptType: 'system',
      description:
        'Clarify Agent system prompt: instructs the intake clarifier on Graha promise, Nakshatra, Dasha, Varga, Bhava, and Transit fundamentals to elicit 1-5 clarifying questions (timeframe, specific question, people involved, location).',
      prompt: CLARIFY_SYSTEM_PROMPT,
      version: 1,
    },
    'clarify.phrase_user': {
      name: 'clarify.phrase_user',
      agentRole: 'clarify',
      promptType: 'user_template',
      description:
        'Clarify Agent user prompt template for phrasing each of the 1-5 clarifying questions (horizon, sub_bucket, bucket, subject_person, other_person, sibling, location).',
      prompt: CLARIFY_PHRASE_USER_TEMPLATE,
      version: 1,
    },
    'clarify.resolve_user': {
      name: 'clarify.resolve_user',
      agentRole: 'clarify',
      promptType: 'user_template',
      description: 'Clarify Agent user prompt template for resolving free-text replies into astrological slots.',
      prompt: CLARIFY_RESOLVE_USER_TEMPLATE,
      version: 1,
    },
    'clarify.prashna_user': {
      name: 'clarify.prashna_user',
      agentRole: 'clarify',
      promptType: 'user_template',
      description: 'Clarify Agent user prompt template for Prashna horary eligibility.',
      prompt: CLARIFY_PRASHNA_USER_TEMPLATE,
      version: 1,
    },
  };

  for (const [key, text] of Object.entries(PROMPTS)) {
    const promptType: AgentPromptEntry['promptType'] = key.startsWith('templates/')
      ? 'template'
      : key.startsWith('formats/')
        ? 'format'
        : key === 'persona' || key === 'method' || key === 'intake'
          ? 'system'
          : 'role';
    const agentRole =
      key === 'persona' || key === 'method'
        ? 'oracle'
        : key === 'intake'
          ? 'intake'
          : key === 'synth' || key === 'v2/synth'
            ? 'writer.synth'
            : key.startsWith('templates/')
              ? 'template'
              : key.startsWith('formats/')
                ? 'format'
                : `specialist.${key.replace(/^v2\//, '')}`;
    entries[key] = {
      name: key,
      agentRole,
      promptType,
      description: `Reading engine prompt '${key}' (${agentRole})`,
      prompt: text,
      version: 1,
    };
  }
  return entries;
}

export const BUILTIN_AGENT_PROMPTS: Record<string, AgentPromptEntry> = buildBuiltinPrompts();

const CACHE_TTL_MS = 60_000;
let promptCache: {
  at: number;
  map: Map<string, { prompt: string; version: number }>;
  versionHash: string;
} | null = null;
let refreshInFlight: Promise<void> | null = null;
let schemaEnsured = false;

/**
 * Ensures `system_prompts` has versioning metadata columns (`version`, `agent_role`, `prompt_type`, `description`,
 * `updated_at`, `updated_by`), creates `system_prompt_versions` + the auto-versioning trigger, and seeds all prompts.
 */
export async function ensurePromptSchemaAndSeed(prisma: PrismaClient): Promise<void> {
  if (schemaEnsured) return;
  schemaEnsured = true;
  try {
    const ddl = [
      `ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`,
      `ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS agent_role TEXT`,
      `ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS prompt_type TEXT NOT NULL DEFAULT 'system'`,
      `ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS description TEXT`,
      `ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
      `ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS updated_by TEXT`,
      `CREATE TABLE IF NOT EXISTS system_prompt_versions (
        id TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
        prompt_name TEXT NOT NULL,
        version INT NOT NULL,
        prompt TEXT NOT NULL,
        agent_role TEXT,
        prompt_type TEXT NOT NULL DEFAULT 'system',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT system_prompt_versions_name_version_key UNIQUE (prompt_name, version)
      )`,
      `CREATE OR REPLACE FUNCTION fn_archive_system_prompt_version()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'UPDATE' AND NEW.prompt IS DISTINCT FROM OLD.prompt THEN
          IF NEW.version = OLD.version THEN
            NEW.version := OLD.version + 1;
          END IF;
          NEW.updated_at := now();
          INSERT INTO system_prompt_versions (prompt_name, version, prompt, agent_role, prompt_type, notes)
          VALUES (NEW.name, NEW.version, NEW.prompt, NEW.agent_role, COALESCE(NEW.prompt_type, 'system'), 'Updated in system_prompts')
          ON CONFLICT (prompt_name, version) DO UPDATE SET prompt = EXCLUDED.prompt, created_at = now();
        ELSIF TG_OP = 'INSERT' THEN
          INSERT INTO system_prompt_versions (prompt_name, version, prompt, agent_role, prompt_type, notes)
          VALUES (NEW.name, COALESCE(NEW.version, 1), NEW.prompt, NEW.agent_role, COALESCE(NEW.prompt_type, 'system'), 'Initial seed')
          ON CONFLICT (prompt_name, version) DO NOTHING;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_system_prompts_version ON system_prompts`,
      `CREATE TRIGGER trg_system_prompts_version
      BEFORE INSERT OR UPDATE ON system_prompts
      FOR EACH ROW EXECUTE FUNCTION fn_archive_system_prompt_version()`,
    ];
    for (const stmt of ddl) {
      await prisma.$executeRawUnsafe(stmt);
    }

    for (const item of Object.values(BUILTIN_AGENT_PROMPTS)) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO system_prompts (name, prompt, is_active, version, agent_role, prompt_type, description, updated_at)
         VALUES ($1, $2, true, 1, $3, $4, $5, now())
         ON CONFLICT (name) DO UPDATE SET
           agent_role = COALESCE(system_prompts.agent_role, EXCLUDED.agent_role),
           prompt_type = COALESCE(system_prompts.prompt_type, EXCLUDED.prompt_type),
           description = COALESCE(system_prompts.description, EXCLUDED.description)`,
        item.name,
        item.prompt,
        item.agentRole,
        item.promptType,
        item.description,
      );
    }
    // Ensure existing rows (such as pvr_oracle) also have a baseline row in system_prompt_versions
    await prisma.$executeRawUnsafe(`
      INSERT INTO system_prompt_versions (prompt_name, version, prompt, agent_role, prompt_type, notes)
      SELECT name, COALESCE(version, 1), prompt, COALESCE(agent_role, 'oracle'), COALESCE(prompt_type, 'system'), 'Baseline snapshot'
      FROM system_prompts
      ON CONFLICT (prompt_name, version) DO NOTHING;
    `);
  } catch (err) {
    schemaEnsured = false;
    console.warn(
      JSON.stringify({
        msg: 'system_prompts schema/seed check skipped; using built-in fallback',
        error: (err as Error).message.slice(0, 200),
      }),
    );
  }
}

/**
 * Loads all active prompts from `system_prompts` and synchronises `PROMPTS` in memory so any DB edit takes effect
 * without a code push.
 */
export async function loadAgentPrompts(prisma?: PrismaClient | null): Promise<Map<string, { prompt: string; version: number }>> {
  if (promptCache && Date.now() - promptCache.at < CACHE_TTL_MS) return promptCache.map;
  if (!prisma || typeof (prisma as { $queryRawUnsafe?: unknown }).$queryRawUnsafe !== 'function') {
    const fallback = new Map<string, { prompt: string; version: number }>();
    for (const [k, v] of Object.entries(BUILTIN_AGENT_PROMPTS)) fallback.set(k, { prompt: v.prompt, version: v.version });
    return promptCache?.map ?? fallback;
  }
  if (refreshInFlight) {
    await refreshInFlight;
    if (promptCache) return promptCache.map;
  }
  refreshInFlight = (async () => {
    try {
      await ensurePromptSchemaAndSeed(prisma);
      const rows = (await prisma.$queryRawUnsafe<Array<{ name: string; prompt: string; version: number | null }>>(
        `SELECT name, prompt, COALESCE(version, 1)::int AS version FROM system_prompts WHERE is_active = true`,
      )) ?? [];
      const map = new Map<string, { prompt: string; version: number }>();
      for (const [k, v] of Object.entries(BUILTIN_AGENT_PROMPTS)) {
        map.set(k, { prompt: v.prompt, version: v.version });
      }
      for (const r of rows) {
        if (r.name && typeof r.prompt === 'string' && r.prompt.trim()) {
          const clean = r.prompt.trim();
          const ver = Number(r.version) || 1;
          map.set(r.name, { prompt: clean, version: ver });
          // Synchronise reading engine PROMPTS in-place when a matching key is edited in DB
          if (r.name in PROMPTS) {
            PROMPTS[r.name] = clean;
          }
        }
      }
      const hashInput = [...map.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}@v${v.version}:${v.prompt.length}`)
        .join('|');
      const versionHash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 12);
      promptCache = { at: Date.now(), map, versionHash };
    } catch (err) {
      console.warn(
        JSON.stringify({
          msg: 'system_prompts load failed; using cached/built-in prompts',
          error: (err as Error).message.slice(0, 200),
        }),
      );
    } finally {
      refreshInFlight = null;
    }
  })();
  await refreshInFlight;
  if (promptCache) return promptCache.map;
  const fallback = new Map<string, { prompt: string; version: number }>();
  for (const [k, v] of Object.entries(BUILTIN_AGENT_PROMPTS)) fallback.set(k, { prompt: v.prompt, version: v.version });
  return fallback;
}

/**
 * Synchronous lookup of any agent prompt (uses the latest DB-refreshed cache, or built-in floor if not yet loaded).
 * Optionally triggers a non-blocking background refresh when `prisma` is provided and the cache is stale.
 */
export function getAgentPrompt(name: string, prisma?: PrismaClient | null): string {
  if (prisma && (!promptCache || Date.now() - promptCache.at >= CACHE_TTL_MS) && !refreshInFlight) {
    void loadAgentPrompts(prisma);
  }
  const hit = promptCache?.map.get(name);
  if (hit?.prompt) return hit.prompt;
  return BUILTIN_AGENT_PROMPTS[name]?.prompt ?? PROMPTS[name] ?? '';
}

/** Render a prompt template with `{{key}}` placeholders. */
export function renderPromptTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function clearAgentPromptCache(): void {
  promptCache = null;
}
