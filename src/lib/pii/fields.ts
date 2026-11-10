/**
 * The sealed-field map (docs/privacy/01 §4.1.3, docs/privacy/02 §4.1.3): which columns hold a person's values and are
 * sealed at rest, by Prisma model. Everything not listed stays plain: ids, status, lock and queue columns, timestamps,
 * hash indexes, so every `WHERE status = ...` and row-as-lock query keeps working.
 *
 * `pending` marks a column that does not exist yet (M26 adds it, docs/privacy/02 §4.1.6). The extension and the raw-SQL
 * helpers skip a pending column until the schema has it; the plain columns it replaces (`lat`, `lon`, `tz`,
 * `life_events.place`, ...) stay plain until M28 drops them.
 *
 * `owner` says how the person who owns a row is found, which decides whose key seals it (`system`: shared sky data with
 * no person link, sealed under the system key).
 */

export type SealedKind = 'text' | 'json';

export interface SealedColumn {
  kind: SealedKind;
  /** the migration that adds the column; skipped until then */
  pending?: 'M26';
}

export type OwnerPath = { via: 'self' } | { via: 'user_id' } | { via: 'kundli_id' } | { via: 'chat_id' } | { via: 'run_id' } | { via: 'build_id' } | { via: 'system' };

export interface SealedModel {
  table: string;
  owner: OwnerPath;
  fields: Record<string, SealedColumn>;
  /** fields a `where` may name: rewritten to the blind index once it exists (docs/privacy/02 §4.1.4) */
  blindIndexed?: Record<string, string>;
  /** a row may belong to no person (left plain then) */
  ownerOptional?: boolean;
}

const text: SealedColumn = { kind: 'text' };
const json: SealedColumn = { kind: 'json' };
const pendingText: SealedColumn = { kind: 'text', pending: 'M26' };

export const SEALED_MODELS: Record<string, SealedModel> = {
  Auth: {
    table: 'auth',
    owner: { via: 'self' },
    fields: {
      email: text,
      username: text,
      name: text,
      date_of_birth: text,
      time_of_birth: text,
      place_of_birth: text,
      city: text,
      country_code: text,
      gender: text,
      signup_ip: text,
      cognito_session: text,
    },
    blindIndexed: { email: 'email_bidx', username: 'username_bidx' },
  },
  Kundli: {
    table: 'kundlis',
    owner: { via: 'user_id' },
    fields: {
      biodata: json,
      d1: json,
      d2: json,
      d4: json,
      d7: json,
      d9: json,
      d10: json,
      charakaraka: json,
      vimsottari_dasa: json,
      narayana_dasa: json,
      other_readings: json,
      place_resolved: text,
      last_sync_error: text,
      // sealed JSON {lat, lon, tz}; replaces the plain Float columns lat, lon, tz (dropped in M28)
      coords: pendingText,
    },
  },
  KundliFacts: { table: 'kundli_facts', owner: { via: 'kundli_id' }, fields: { dossier: json, natal_points: json } },
  KundliData: { table: 'kundli_data', owner: { via: 'kundli_id' }, fields: { payload: json, error: text, params: json } },
  // the digest is built from sealed payloads, so it is sealed like them; read by kundli_id only (M32)
  KundliDigest: { table: 'kundli_digest', owner: { via: 'kundli_id' }, fields: { row: json, source: json } },
  // activation rows hold only system ids, period lords or signs, dates and house numbers, queried by range and house (GIN):
  // plain, like timeline_calibration (docs/TODOS.md, digest-core)
  KundliActivation: { table: 'kundli_activation', owner: { via: 'kundli_id' }, fields: {} },
  KundliTransitOverlay: { table: 'kundli_transit_overlays', owner: { via: 'kundli_id' }, fields: { payload: json } },
  // only rows with a kundli_id belong to a person; global rows (kundli_id null) stay plain
  TransitSnapshot: { table: 'transit_snapshots', owner: { via: 'kundli_id' }, ownerOptional: true, fields: { snapshot: json } },
  UserGeneratedContent: { table: 'user_generated_content', owner: { via: 'user_id' }, fields: { remedies: json, mantras: json, routines: json } },
  Chat: { table: 'chats', owner: { via: 'user_id' }, fields: { name: text } },
  Message: { table: 'messages', owner: { via: 'chat_id' }, fields: { question: text, ai_answer: text } },
  ChatLog: { table: 'chat_logs', owner: { via: 'chat_id' }, fields: { request_payload: json, response_payload: json } },
  ReadingRun: {
    table: 'reading_runs',
    owner: { via: 'user_id' },
    fields: {
      question: text,
      intent: json,
      intent_confirmed: json,
      findings: json,
      windows: json,
      agreement: json,
      answer: text,
      thinking: text,
      grounding: json,
      errors: json,
    },
  },
  ReadingAgentResponse: {
    table: 'reading_agent_responses',
    owner: { via: 'user_id' },
    fields: { question: text, subject: text, prompt_sent: text, digest: json, highlights: json, failure_reason: text },
  },
  ReadingFindingsCache: {
    table: 'reading_findings_cache',
    owner: { via: 'kundli_id' },
    fields: { payload: json },
  },
  AreaBuild: {
    table: 'area_builds',
    owner: { via: 'user_id' },
    fields: { result: json, error: text },
  },
  PersonFact: {
    table: 'person_facts',
    owner: { via: 'user_id' },
    fields: { value: text },
  },
  ReadingDossier: {
    table: 'reading_dossiers',
    owner: { via: 'kundli_id' },
    fields: { techniques: json, rules: json, data: json, yogas: json, clocks: json, panels: json, gaps: json, audit: json, oracle: json },
  },
  TechniqueOutput: {
    table: 'technique_outputs',
    owner: { via: 'kundli_id' },
    fields: { output: json },
  },
  // M48 (docs/reading-engine/70 §4.1 Layer 1): rendered chart text and its evidence keys; slice_id and hash stay plain
  KundliSlice: { table: 'kundli_slices', owner: { via: 'kundli_id' }, fields: { text, keys: json } },
  ReadingTrace: { table: 'reading_traces', owner: { via: 'user_id' }, fields: { question: text, error: text } },
  PrashnaCast: { table: 'prashna_casts', owner: { via: 'user_id' }, fields: { payload: json, place_resolved: text, coords: pendingText } },
  // sealed JSON {category, date, date_precision, place, attributes}; the plain columns are dropped in M28
  LifeEvent: { table: 'life_events', owner: { via: 'user_id' }, fields: { event: pendingText } },
  // sealed JSON {marker, from, to, band, testing, scores, systems, how, form}; read by build_id, sorted in memory
  TimelineWindow: { table: 'timeline_windows', owner: { via: 'build_id' }, fields: { window: pendingText } },
  TimelineMatch: { table: 'timeline_matches', owner: { via: 'build_id' }, fields: { specifics_sealed: pendingText } },
  // doc 01 lists `marker` and the scores; marker is part of the (kundli_id, system, marker) unique key, so a random-IV seal
  // would break the upsert. Plain until a keyed form is chosen (docs/TODOS.md).
  TimelineCalibration: { table: 'timeline_calibration', owner: { via: 'kundli_id' }, fields: {} },
  UserCurrentLocation: { table: 'user_current_location', owner: { via: 'user_id' }, fields: { place: text, tz: text, coords: pendingText } },
  BillingAccount: { table: 'billing_accounts', owner: { via: 'user_id' }, fields: { payment_ref: text, billing_country: text } },
  // shared sky rows: lat/lon/tz move under the system key and place_key becomes an HMAC (place_bidx) in M26/M28
  TransitInstant: { table: 'transit_instants', owner: { via: 'system' }, fields: {} },
  TransitRangeSky: { table: 'transit_range_skies', owner: { via: 'system' }, fields: {} },
};

/** table name -> model entry, for the raw-SQL helpers */
export const SEALED_TABLES: Record<string, SealedModel> = Object.fromEntries(Object.values(SEALED_MODELS).map((m) => [m.table, m]));

/** The columns of a model that exist today (pending ones left out). */
export function activeFields(model: string): Record<string, SealedColumn> {
  const m = SEALED_MODELS[model];
  if (!m) return {};
  return Object.fromEntries(Object.entries(m.fields).filter(([, c]) => !c.pending));
}

export function sealedColumn(model: string, field: string): SealedColumn | null {
  const c = SEALED_MODELS[model]?.fields[field];
  return c && !c.pending ? c : null;
}

/** Plain on purpose, and kept so by tests (docs/privacy/02 §4.1.3): admin audit rows and metric spans. */
export const PLAIN_BY_CONSTRUCTION = ['AdminAction', 'ReadingAgentSpan', 'PageExecutionLog'] as const;

