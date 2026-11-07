/**
 * Writes docs/admin/07-technique-pieces-and-agents.md: the illustrations (Mermaid) of every agent and every piece of the
 * techniques of General Reading and of the Self, Love and Work boards, the families of techniques that share one recipe,
 * how long each technique's output stays valid, and where the pieces should be standardised next (docs/reading-engine/56).
 *
 * Pure: reads the catalogue and the agent registry in code, no database. Run after the catalogue changes:
 *   npx tsx scripts/write-technique-pieces-doc.ts            (writes the file)
 *   npx tsx scripts/write-technique-pieces-doc.ts --check    (exits 1 when the file is out of date)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPiecesDoc } from '../src/techniques/piecesDoc.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs', 'admin', '07-technique-pieces-and-agents.md');
const doc = renderPiecesDoc();

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
  if (cur !== doc) {
    console.error(`${path.relative(root, out)} is out of date; run npx tsx scripts/write-technique-pieces-doc.ts`);
    process.exit(1);
  }
  console.log(`${path.relative(root, out)} is up to date`);
} else {
  fs.writeFileSync(out, doc, 'utf8');
  console.log(`wrote ${path.relative(root, out)} (${doc.length} bytes)`);
}
