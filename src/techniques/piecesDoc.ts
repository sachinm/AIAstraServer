/**
 * Renders docs/admin/07-technique-pieces-and-agents.md (docs/reading-engine/56): Mermaid illustrations of the agents and
 * the pieces of every technique of General Reading and the Self, Love and Work boards, the recipe families, how long
 * each output stays valid, and the standardisation candidates. Deterministic (no dates, catalogue order), so the
 * generated file can be checked in CI (`scripts/write-technique-pieces-doc.ts --check`). Reads code only.
 */
import { AGENTS, type AgentDef } from '../agents/registry.js';
import type { TechniqueDef } from './catalog.js';
import { TECHNIQUES } from './catalog.js';
import type { TechniqueCategory } from './categories.js';
import {
  FRESHNESS_ORDER,
  families,
  pieces,
  recipes,
  reuseReport,
  techniqueFreshness,
  techniqueScope,
  type Freshness,
  type Piece,
  type RecipeFamily,
  type ReuseScope,
} from './pieces.js';

export const AREA_LABELS: Record<TechniqueCategory, string> = {
  general: 'General Reading',
  self: 'Self (You board and its Lucky times)',
  love: 'Love',
  work: 'Work',
};

/** General Reading first: it is the one the boards borrow from. */
const AREA_ORDER: TechniqueCategory[] = ['general', 'self', 'love', 'work'];

export const FRESHNESS_RULE: Record<Freshness, string> = {
  natal: 'open: valid until the digest version or the contract changes',
  annual: 'the running year chart (fallback `TECHNIQUE_ANNUAL_FALLBACK_DAYS`, default 90 days)',
  dasha: 'the running dasha period (fallback `TECHNIQUE_DASHA_FALLBACK_DAYS`, default 30 days)',
  daily: 'the local day at the place (UTC day when no place is given)',
  transit: 'a `TECHNIQUE_TRANSIT_WINDOW_HOURS` window aligned to the clock (default 2 hours)',
  question: 'not reusable: made for each question',
};

const SCOPE_RULE: Record<ReuseScope, string> = {
  kundli: 'same for every question',
  question: 'per question (keyed by a hash of the question)',
};

const KIND_LABEL: Record<AgentDef['kind'], string> = { llm: 'model', code: 'code', engine_pull: 'engine pull' };

/** A Mermaid node id: letters, digits and underscores only. */
export function mid(prefix: string, raw: string): string {
  return `${prefix}_${raw.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}

/** A Mermaid label: quotes and angle brackets escaped (the `<br/>` we add ourselves is kept). */
export function mlabel(parts: string[]): string {
  const esc = (s: string) => s.replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;');
  return `"${parts.map(esc).join('<br/>')}"`;
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const code = (s: string) => `\`${s}\``;
const short = (pieceId: string) => pieceId.replace(/^(reader|prompt|output|agent):/, '').replace(/^src\/reading\/prompts\//, '');

function agentById(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}

/** The machinery as a whole: data in, pieces, the stored-output check, agents, synthesizers, screens. */
function overviewDiagram(): string {
  return [
    '```mermaid',
    'flowchart TB',
    '  subgraph DATA["Stored data (refreshed on its own clock)"]',
    '    KD[("kundli_digest<br/>house · planet · yoga · point · star · annual")]',
    '    KA[("kundli_activation<br/>every dasha period, birth to +30 years")]',
    '    SKY[("shared sky + kundli transit overlay")]',
    '    DAY[("day tables per place + personal day overlay")]',
    '    TXT[("the question, the thread, the clarify turns")]',
    '  end',
    '  ENG[("engine tables: kundli_data")] --> DB["digest.build (code, no model)"] --> KD',
    '  DB --> KA',
    '  KD --> RP',
    '  KA --> RP',
    '  SKY --> RP',
    '  DAY --> RP',
    '  TXT --> RP',
    '  RP["Reader pieces<br/>a section read in a named layout, with a filter"] --> TQ{"Stored output for<br/>technique + kundli + window?"}',
    '  TQ -- "yes: skip the agent" --> OUT["Technique output<br/>findings · area_board · career_map · windows"]',
    '  TQ -- "no" --> AG["Agent piece<br/>code, engine pull or model + prompt piece"]',
    '  AG --> ST[("technique output store<br/>keyed by technique, contract, kundli, digest version, window")]',
    '  ST --> OUT',
    '  OUT --> SYN["Synthesizer technique<br/>Oracle · board builder · life dashboard"]',
    '  SYN --> UI["Screens: General Reading chat · You · Love · Work · Lucky times · Life timeline"]',
    '```',
  ].join('\n');
}

/** One area: its reader and prompt pieces, its technique families, its agents, and the synthesizer links. */
export function areaDiagram(area: TechniqueCategory, techniques: readonly TechniqueDef[] = TECHNIQUES): string {
  const inArea = techniques.filter((t) => t.category === area);
  if (inArea.length === 0) return '_No techniques in this area._';
  const fams = families(inArea);
  const famOf = new Map<string, RecipeFamily>();
  for (const f of fams) for (const m of f.members) famOf.set(m, f);
  const lines: string[] = ['```mermaid', 'flowchart LR'];

  const readers = [...new Set(fams.flatMap((f) => f.readers))].sort();
  const prompts = [...new Set(fams.map((f) => f.prompt).filter((p): p is string => !!p))].sort();
  const agents = [...new Set(fams.flatMap((f) => f.agents))].sort();
  const freshByReader = new Map(pieces(inArea).filter((p) => p.kind === 'reader').map((p) => [p.id, p.freshness ?? 'question']));

  lines.push('  subgraph R["Reader pieces"]');
  for (const r of readers) lines.push(`    ${mid('r', r)}[${mlabel([short(r).replace('/', ' as '), String(freshByReader.get(r) ?? '')])}]`);
  lines.push('  end');
  if (prompts.length) {
    lines.push('  subgraph P["Prompt pieces"]');
    for (const p of prompts) lines.push(`    ${mid('p', p)}[/${mlabel([short(p)])}/]`);
    lines.push('  end');
  }
  lines.push('  subgraph T["Techniques (one box per recipe family)"]');
  for (const f of fams) {
    const title = f.members.length === 1 ? (inArea.find((t) => t.id === f.members[0])?.title ?? f.label) : `${f.members.length} techniques`;
    lines.push(`    ${mid('f', f.label)}[${mlabel([f.label, title, `${short(f.output)} · ${f.freshness}`])}]`);
  }
  lines.push('  end');
  lines.push('  subgraph A["Agents"]');
  for (const a of agents) {
    const def = agentById(short(a));
    lines.push(`    ${mid('a', a)}([${mlabel([short(a), def ? KIND_LABEL[def.kind] : 'not registered'])}])`);
  }
  lines.push('  end');

  for (const f of fams) {
    for (const r of f.readers) lines.push(`  ${mid('r', r)} --> ${mid('f', f.label)}`);
    if (f.prompt) lines.push(`  ${mid('p', f.prompt)} --> ${mid('f', f.label)}`);
    for (const a of f.agents) lines.push(`  ${mid('f', f.label)} --- ${mid('a', a)}`);
  }
  // synthesizer links between families (inside the area) or to a technique of another area
  const synthEdges = new Set<string>();
  const external = new Set<string>();
  for (const t of inArea) {
    const s = t.contract.synthesizer;
    if (!s) continue;
    const from = famOf.get(t.id);
    const to = famOf.get(s);
    if (!from) continue;
    if (to) {
      if (to === from) continue;
      synthEdges.add(`  ${mid('f', from.label)} -. feeds .-> ${mid('f', to.label)}`);
    } else {
      external.add(s);
      synthEdges.add(`  ${mid('f', from.label)} -. feeds .-> ${mid('x', s)}`);
    }
  }
  for (const s of [...external].sort()) lines.push(`  ${mid('x', s)}{{${mlabel([s, 'another area'])}}}`);
  lines.push(...[...synthEdges].sort());
  lines.push('```');
  return lines.join('\n');
}

/** Every registered agent, by module, with the areas it serves. */
function agentsDiagram(techniques: readonly TechniqueDef[]): string {
  const modules = [...new Set(AGENTS.map((a) => a.module))];
  const lines = ['```mermaid', 'flowchart LR'];
  for (const m of modules) {
    lines.push(`  subgraph ${mid('m', m)}["${m}"]`);
    for (const a of AGENTS.filter((x) => x.module === m)) lines.push(`    ${mid('a', a.id)}([${mlabel([a.id, KIND_LABEL[a.kind]])}])`);
    lines.push('  end');
  }
  for (const area of AREA_ORDER) lines.push(`  ${mid('area', area)}[[${mlabel([AREA_LABELS[area]])}]]`);
  const edges = new Set<string>();
  for (const t of techniques) for (const a of t.agents) if (agentById(a)) edges.add(`  ${mid('a', a)} --> ${mid('area', t.category)}`);
  lines.push(...[...edges].sort());
  lines.push('```');
  return lines.join('\n');
}

function piecesTable(ps: Piece[], techniques: readonly TechniqueDef[]): string {
  const total = techniques.length;
  const rows = ps.map((p) => {
    const areas = AREA_ORDER.filter((a) => p.categories.includes(a)).map((a) => a).join(', ');
    const variants = p.kind === 'reader' ? String(p.variants?.length ?? 0) : '';
    return `| ${p.kind} | ${code(short(p.id))} | ${p.freshness ?? ''} | ${p.usedBy.length} of ${total} | ${areas} | ${variants} |`;
  });
  return ['| Kind | Piece | Freshness | Used by | Areas | Filters |', '|---|---|---|---|---|---|', ...rows].join('\n');
}

function familiesTable(techniques: readonly TechniqueDef[]): string {
  const rows = families(techniques).map(
    (f) =>
      `| ${code(f.label)} | ${f.members.length} | ${f.readers.map((r) => code(short(r))).join(', ')} | ${f.prompt ? code(short(f.prompt)) : 'code'} | ${code(short(f.output))} | ${f.agents.map((a) => code(short(a))).join(', ')} | ${f.freshness} |`,
  );
  return ['| Family | Techniques | Readers | Prompt | Output | Agents | Freshness |', '|---|---|---|---|---|---|---|', ...rows].join('\n');
}

function compositionTable(area: TechniqueCategory, techniques: readonly TechniqueDef[]): string {
  const rs = recipes(techniques).filter((r) => r.category === area);
  const rows = rs.map((r) => {
    const readers = r.readers.map((x) => `${code(`${x.section}/${x.layout}`)} ${cell(x.filter)}`).join('<br/>');
    const feeds = r.synthesizer ? code(r.synthesizer) : '';
    return `| ${code(r.id)} | ${cell(r.title)} | ${readers} | ${r.prompt ? code(short(r.prompt)) : 'code'} | ${code(short(r.output))} | ${r.agents.map((a) => code(short(a))).join(', ')} | ${feeds} | ${r.freshness} · ${r.scope} |`;
  });
  return ['| Technique | Title | Reader pieces (filter) | Prompt | Output | Agents | Feeds | Freshness · scope |', '|---|---|---|---|---|---|---|---|', ...rows].join('\n');
}

function validityTable(techniques: readonly TechniqueDef[]): string {
  const rows = FRESHNESS_ORDER.map((f) => {
    const ts = techniques.filter((t) => techniqueFreshness(t, techniques) === f);
    const kundli = ts.filter((t) => techniqueScope(t) === 'kundli').length;
    return `| ${f} | ${FRESHNESS_RULE[f]} | ${ts.length} | ${kundli} | ${ts.length - kundli} |`;
  });
  return ['| Freshness | Window the output is stored for | Techniques | Same for every question | Per question |', '|---|---|---|---|---|', ...rows].join('\n');
}

function agentsTable(techniques: readonly TechniqueDef[]): string {
  const rows = AGENTS.map((a) => {
    const ts = techniques.filter((t) => t.agents.includes(a.id));
    const areas = AREA_ORDER.filter((c) => ts.some((t) => t.category === c)).join(', ');
    return `| ${code(a.id)} | ${cell(a.title)} | ${KIND_LABEL[a.kind]} | ${a.module}${a.subModule ? `/${a.subModule}` : ''} | ${ts.length} | ${areas || '—'} |`;
  });
  return ['| Agent | Title | Kind | Module | Techniques | Areas |', '|---|---|---|---|---|---|', ...rows].join('\n');
}

export function renderPiecesDoc(techniques: readonly TechniqueDef[] = TECHNIQUES): string {
  const r = reuseReport(techniques);
  const ps = pieces(techniques);
  const unregistered = [...new Set(techniques.flatMap((t) => t.agents))].filter((a) => !agentById(a)).sort();
  const out: string[] = [];
  out.push('# 07 — Technique pieces and agents, illustrated');
  out.push('');
  out.push('Generated from the catalogue (`src/techniques/catalog.ts`) and the agent registry (`src/agents/registry.ts`) by');
  out.push('`src/techniques/piecesDoc.ts`. Do not edit by hand: run `npx tsx scripts/write-technique-pieces-doc.ts` after the');
  out.push('catalogue changes (`--check` fails when this file is out of date). The plan behind it is');
  out.push('[docs/reading-engine/56](../reading-engine/56-technique-pieces-and-validity-windows.md); the same pictures are on the');
  out.push('Admin Panel page **Machinery**.');
  out.push('');
  out.push('A technique is a recipe of standard pieces. The data changes on its own clock (transits every couple of hours, the');
  out.push('day at midnight, the dasha period when it ends); the recipe does not. So each piece is built and tested once, reused');
  out.push('by every technique that needs it, and a technique\'s output is stored for the window in which its inputs cannot');
  out.push('change, so it is not made again and its agent is skipped until the window ends.');
  out.push('');
  out.push('- **Reader piece**: a digest section read in a named table layout (`house` as `house_card`). The filter (which houses,');
  out.push('  vargas, years) is a parameter, not a new piece.');
  out.push('- **Prompt piece**: a system prompt file. Code techniques have none.');
  out.push('- **Output piece**: the schema or type returned (`findings.v2`, `area_board.v1`, `career_map.v1` …).');
  out.push('- **Agent piece**: the registered agent that runs it (code, engine pull or model).');
  out.push('- **Family**: techniques with the same readers, prompt, output and agents: one recipe run over different filters.');
  out.push('- **Freshness**: how long the output stays true, from the most changeable section read. **Scope**: whether it is');
  out.push('  the same for every question or depends on the question.');
  out.push('');
  out.push('## 1. Counts');
  out.push('');
  out.push(`- ${r.techniques} techniques, ${r.pieces} distinct pieces, ${r.shared} of them shared by two or more techniques.`);
  out.push(`- By kind: ${(['reader', 'prompt', 'output', 'agent'] as const).map((k) => `${r.byKind[k].total} ${k} (${r.byKind[k].shared} shared)`).join(', ')}.`);
  out.push(`- ${r.families} recipe families; ${r.inFamilies} techniques share their recipe with at least one other.`);
  out.push(`- Freshness: ${FRESHNESS_ORDER.map((f) => `${r.freshness[f]} ${f}`).join(', ')}. Scope: ${r.scope.kundli} same for every question, ${r.scope.question} per question.`);
  if (unregistered.length) out.push(`- Agents named by a technique but not in the registry: ${unregistered.map(code).join(', ')}.`);
  out.push('');
  out.push('## 2. The machinery');
  out.push('');
  out.push(overviewDiagram());
  out.push('');
  out.push('## 3. Every agent and the areas it serves');
  out.push('');
  out.push(agentsDiagram(techniques));
  out.push('');
  out.push(agentsTable(techniques));
  out.push('');
  let n = 4;
  for (const area of AREA_ORDER) {
    const count = techniques.filter((t) => t.category === area).length;
    out.push(`## ${n}. ${AREA_LABELS[area]} (${count} techniques)`);
    out.push('');
    out.push(areaDiagram(area, techniques));
    out.push('');
    out.push(compositionTable(area, techniques));
    out.push('');
    n++;
  }
  out.push(`## ${n}. The pieces and who uses them`);
  out.push('');
  out.push(piecesTable(ps, techniques));
  out.push('');
  n++;
  out.push(`## ${n}. Recipe families`);
  out.push('');
  out.push(familiesTable(techniques));
  out.push('');
  n++;
  out.push(`## ${n}. How long each output stays valid (store it, skip the agent)`);
  out.push('');
  out.push('The window comes from `validityWindow` in `src/techniques/pieces.ts`; the key from `techniqueCacheKey` (technique, a');
  out.push('hash of its contract and algorithm, kundli, digest version, freshness, window, and the question hash when the scope is');
  out.push('per question, plus `TECHNIQUE_CACHE_VERSION`). A key is stable for the whole window, so every caller inside it reads');
  out.push('the same stored output.');
  out.push('');
  out.push(validityTable(techniques));
  out.push('');
  n++;
  out.push(`## ${n}. Where to standardise next`);
  out.push('');
  out.push('Reader pieces applied with many different filters: each filter is free text today. A shared filter vocabulary');
  out.push('(houses, vargas, planets, span) would let two techniques with the same filter share one rendered table.');
  out.push('');
  out.push('| Reader piece | Distinct filters |');
  out.push('|---|---|');
  for (const s of r.filterSprawl) out.push(`| ${code(short(s.piece))} | ${s.variants} |`);
  out.push('');
  out.push('Pieces used by one technique only (candidates to fold into a shared piece, or genuinely special):');
  out.push('');
  out.push(r.singleUse.length ? r.singleUse.map((p) => `- ${code(p)}`).join('\n') : '- none');
  out.push('');
  return out.join('\n');
}
