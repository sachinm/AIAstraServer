import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TECHNIQUES, type TechniqueDef } from '../../../src/techniques/catalog.js';
import { areaDiagram, mid, mlabel, renderPiecesDoc } from '../../../src/techniques/piecesDoc.js';

const DOC = path.resolve('docs/admin/07-technique-pieces-and-agents.md');

function mermaidBlocks(md: string): string[] {
  return [...md.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
}

describe('technique pieces doc (docs/admin/07)', () => {
  const doc = renderPiecesDoc();

  it('is deterministic', () => {
    expect(renderPiecesDoc()).toBe(doc);
  });

  it('matches the checked-in file (run npx tsx scripts/write-technique-pieces-doc.ts)', () => {
    expect(fs.readFileSync(DOC, 'utf8')).toBe(doc);
  });

  it('draws the machinery, the agents and one diagram per area', () => {
    const blocks = mermaidBlocks(doc);
    expect(blocks.length).toBe(2 + 4);
    for (const area of ['General Reading', 'Self', 'Love', 'Work']) expect(doc).toContain(`. ${area}`);
  });

  it('every mermaid block opens and closes its subgraphs', () => {
    for (const b of mermaidBlocks(doc)) {
      const opens = (b.match(/^\s*subgraph /gm) ?? []).length;
      const ends = (b.match(/^\s*end\s*$/gm) ?? []).length;
      expect(ends).toBe(opens);
    }
  });

  it('names every technique and every agent the catalogue uses', () => {
    for (const t of TECHNIQUES) {
      expect(doc, t.id).toContain(`\`${t.id}\``);
      for (const a of t.agents) expect(doc, a).toContain(a);
    }
  });

  it('never names the engine library', () => {
    expect(doc).not.toMatch(/radha|pyjhora|jhora/i);
  });
});

describe('mermaid helpers', () => {
  it('makes safe ids and labels', () => {
    expect(mid('r', 'reader:house/house_card')).toBe('r_reader_house_house_card');
    expect(mid('f', 'lucky.work.* (6)')).toBe('f_lucky_work_6');
    expect(mlabel(['a "b"', '<c>'])).toBe('"a #quot;b#quot;<br/>#lt;c#gt;"');
  });

  it('says so when an area has no techniques', () => {
    expect(areaDiagram('love', [] as TechniqueDef[])).toMatch(/No techniques/);
  });
});

describe('one-per-page technique illustrations manual (docs/techniques/01..06)', () => {
  const volumes = [
    'docs/techniques/README.md',
    'docs/techniques/01-architecture-and-reusable-pieces.md',
    'docs/techniques/02-general-reading-illustrations.md',
    'docs/techniques/03-self-board-illustrations.md',
    'docs/techniques/04-love-board-illustrations.md',
    'docs/techniques/05-work-board-illustrations.md',
    'docs/techniques/06-lucky-times-and-life-illustrations.md',
  ];

  it('has all 6 volumes and README with balanced Mermaid subgraphs and no internal engine names', () => {
    const allContent: string[] = [];
    for (const rel of volumes) {
      const full = path.resolve(rel);
      expect(fs.existsSync(full), rel).toBe(true);
      const md = fs.readFileSync(full, 'utf8');
      expect(md, rel).not.toMatch(/radha|pyjhora|jhora/i);
      for (const b of mermaidBlocks(md)) {
        const opens = (b.match(/^\s*subgraph /gm) ?? []).length;
        const ends = (b.match(/^\s*end\s*$/gm) ?? []).length;
        expect(ends, `${rel} subgraph balance`).toBe(opens);
      }
      if (!rel.endsWith('README.md')) allContent.push(md);
    }

    const joined = allContent.join('\n');
    for (const t of TECHNIQUES) {
      expect(joined, `page for ${t.id}`).toMatch(new RegExp(`## Page \\d+ of \\d+ — \`${t.id.replace('.', '\\.')}\``));
    }
  });
});
