import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { AGENTS, registryRow, seedAgentRegistry } from '../src/agents/registry.js';
import { TECHNIQUES, seedTechniqueRegistry, type TechniqueBoard, type TechniqueChart, type TechniqueDef } from '../src/techniques/catalog.js';
import { TECHNIQUE_CATEGORIES, type TechniqueCategory } from '../src/techniques/categories.js';
import type { TechniqueSelectors } from '../src/techniques/contracts.js';

const CATEGORY_LABELS: Record<TechniqueCategory, string> = {
  general: 'General Reading',
  self: 'Self (You board)',
  love: 'Love',
  work: 'Work',
};

const BOARD_NAMES: Record<TechniqueBoard, string> = {
  chat: 'General Reading chat',
  you: 'You board',
  love: 'Love board',
  work: 'Work board',
  lucky: 'Lucky times',
  timeline: 'Timeline',
};

const CHART_LABELS: Record<string, string> = {
  vimshottari: 'Vimshottari',
  yogini: 'Yogini',
  tithi_ashtottari: 'Tithi Ashtottari',
  narayana: 'Narayana',
  chara: 'Chara',
  transit_contacts: 'Transit contacts',
  double_transit: 'Double transit',
  sade_sati: 'Sade Sati',
  tithi_pravesha: 'Tithi Pravesha',
  varshaphal: 'Varshaphal',
  house_counts: 'house counts',
  benefic_malefic: 'benefic malefic',
  special_lagnas: 'special lagnas',
  chara_karakas: 'chara karakas',
  transit_overlay: 'transit overlay',
  transit_at: 'transit at',
  all_systems: 'all systems',
  tithi_pravesha_dasha: 'tithi pravesha dasha',
  cusp_nak: 'cusp nak',
  star_lord: 'star lord',
  occupant_stars: 'occupant stars',
  chandra_bala: 'chandra bala',
  transit_ashtakavarga: 'transit ashtakavarga',
  sudarshana_chakra: 'Sudarshana Chakra',
  ashtakavarga: 'ashtakavarga',
};

function fmtChart(c: TechniqueChart): string {
  const name = CHART_LABELS[c.id] ?? c.id;
  return `${name} (${c.source})`;
}

function fmtStatus(s: TechniqueDef['status']): string {
  return s === 'built' ? 'Built' : s === 'partial' ? 'Partly built' : 'Planned';
}

function fmtSelectors(sel: TechniqueSelectors): string {
  const parts: string[] = [];
  if (sel.boards?.length) parts.push(`board is ${sel.boards.join(', ')}`);
  if (sel.subjects?.length) parts.push(`subject is ${sel.subjects.map((s) => s.replace(/_/g, ' ')).join(' or ')}`);
  if (sel.horizons?.length) parts.push(`horizon is ${sel.horizons.join(', ')}`);
  if (sel.questionTypes?.length) parts.push(`question is ${sel.questionTypes.join(' or ')}`);
  if (sel.houses?.length) parts.push(`about houses ${sel.houses.join(', ')}`);
  if (sel.vargas?.length) parts.push(`in ${sel.vargas.join(', ')}`);
  if (sel.requiresFacts?.length) {
    parts.push(sel.requiresFacts.map((f) => `${f.key} is ${f.in.join(' or ')}`).join('; '));
  }
  if (sel.anyOf?.length) parts.push(`any of: ${sel.anyOf.join('; ')}`);
  return parts.length ? parts.join('; ') : 'every query / board';
}

function renderDoc(): string {
  const built = TECHNIQUES.filter((t) => t.status === 'built').length;
  const partial = TECHNIQUES.filter((t) => t.status === 'partial').length;
  const planned = TECHNIQUES.filter((t) => t.status === 'planned').length;
  const byCat = Object.fromEntries(TECHNIQUE_CATEGORIES.map((c) => [c, TECHNIQUES.filter((t) => t.category === c)]));
  const catSummary = TECHNIQUE_CATEGORIES.map((c) => `${CATEGORY_LABELS[c]}: ${byCat[c]!.length}`).join(', ');

  const lines: string[] = [
    '# 05 — The techniques catalogue, as registered on 2026-11-06',
    '',
    'Generated from `technique_registry` (the catalogue in `src/techniques/catalog.ts`, seeded at boot; docs/admin/03). The Admin',
    'Panel shows the same rows with their runs, timings and accuracy at https://admin.vedic-astrology.app/techniques. Regenerate',
    'with `npx tsx scripts/write-techniques-doc.ts` after the catalogue changes.',
    '',
    'Every row is a contract (doc 53 §4.3): *Selected when* says which questions or boards choose it; *Contract* says what it reads, in which table layout, under which prompt, and what it returns.',
    '',
    `Counts: ${TECHNIQUES.length} techniques (${catSummary}); ${built} built, ${partial} partly built, ${planned} planned. Agents registered: ${AGENTS.length}.`,
    '',
    '## Summary',
    '',
    '| Id | Technique | Category | Board | Status | Charts and tables read | Agents | Accuracy evidence |',
    '|---|---|---|---|---|---|---|---|',
  ];

  const sortedAll = [...TECHNIQUES].sort((a, b) => {
    const ca = TECHNIQUE_CATEGORIES.indexOf(a.category);
    const cb = TECHNIQUE_CATEGORIES.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  });

  for (const t of sortedAll) {
    const charts = t.charts.length ? t.charts.map(fmtChart).join(', ') : '—';
    const agents = t.agents.length ? t.agents.map((a) => `\`${a}\``).join(', ') : '—';
    lines.push(`| \`${t.id}\` | ${t.title} | ${t.category} | ${BOARD_NAMES[t.board]} | ${fmtStatus(t.status)} | ${charts} | ${agents} | ${t.accuracy} |`);
  }

  for (const cat of TECHNIQUE_CATEGORIES) {
    lines.push('', `## ${CATEGORY_LABELS[cat]}`);
    const list = [...byCat[cat]!].sort((a, b) => a.id.localeCompare(b.id));
    for (const t of list) {
      const charts = t.charts.length ? t.charts.map(fmtChart).join(', ') : '—';
      const agents = t.agents.length ? t.agents.map((a) => `\`${a}\``).join(', ') : 'none yet';
      const readsCol = t.contract.inputs.length ? t.contract.inputs.map((i) => `${i.section} · ${i.filter}`).join('<br>') : '—';
      const asCol = t.contract.inputs.length ? t.contract.inputs.map((i) => i.layout).join('<br>') : '—';
      const userCol = t.contract.user.length ? t.contract.user.join(', ') : '—';
      const synthCol = t.contract.synthesizer ? `\`${t.contract.synthesizer}\`` : '—';
      lines.push(
        '',
        `### ${t.title} — \`${t.id}\``,
        '',
        `**${fmtStatus(t.status)}** · board: ${BOARD_NAMES[t.board]} · accuracy: ${t.accuracy}`,
        '',
        `**Reads:** ${charts}`,
        '',
        '**Algorithm:**',
        '',
        ...t.algorithm.map((step, idx) => `${idx + 1}. ${step}`),
      );
      if (t.special) {
        lines.push('', `**Special:** ${t.special}`);
      }
      lines.push(
        '',
        `**Selected when:** ${fmtSelectors(t.selectors)}`,
        '',
        '**Contract:**',
        '',
        '| Reads | As | Prompt | User turn | Output | Synthesizer |',
        '|---|---|---|---|---|---|',
        `| ${readsCol} | ${asCol} | \`${t.contract.system}\` | ${userCol} | ${t.contract.output} | ${synthCol} |`,
        '',
        `**Source:** ${t.source}  `,
        `**Code:** \`${t.code}\`  `,
        `**Agents:** ${agents}`,
      );
    }
  }

  lines.push(
    '',
    '## Agents registered (`agent_registry`)',
    '',
    '| Id | Title | Kind | Module | Model | Price in / out per 1M |',
    '|---|---|---|---|---|---|',
  );

  for (const a of [...AGENTS].sort((x, y) => x.id.localeCompare(y.id))) {
    const r = registryRow(a);
    const mod = r.sub_module ? `${r.module} / ${r.sub_module}` : r.module;
    const model = r.model ?? '—';
    const price = r.price_in != null && r.price_out != null ? `$${r.price_in.toFixed(6)} / $${r.price_out.toFixed(6)}` : '—';
    lines.push(`| \`${r.id}\` | ${r.title} | ${r.kind} | ${mod} | ${model} | ${price} |`);
  }

  lines.push(
    '',
    '## How to regenerate',
    '',
    'Run `npx tsx scripts/write-techniques-doc.ts` to seed `technique_registry` and `agent_registry` (when `DATABASE_URL` is set) and regenerate `docs/admin/05-techniques-catalogue.md`.',
    '',
  );

  return lines.join('\n');
}

async function main() {
  const outPath = path.resolve('docs/admin/05-techniques-catalogue.md');
  fs.writeFileSync(outPath, renderDoc(), 'utf8');
  console.log(`Wrote ${outPath} (${TECHNIQUES.length} techniques, ${AGENTS.length} agents).`);

  if (process.env.DATABASE_URL) {
    const prisma = new PrismaClient();
    try {
      const aCount = await seedAgentRegistry(prisma);
      const tCount = await seedTechniqueRegistry(prisma);
      console.log(`Seeded DB: ${aCount} agents, ${tCount} techniques.`);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
