// Builds one self-contained HTML page from the atlas markdown files (docs/techniques/atlas/*.md).
// Usage: node docs/techniques/atlas/build.mjs <out.html>
// The markdown files are the source of truth; edit them, never the page. No dependencies.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) throw new Error('usage: node build.mjs <out.html>');

const VIEWS = [
  { id: 'guide', file: '00-how-to-read.md', label: 'How to read' },
  { id: 'self', file: '01-self.md', label: 'Self' },
  { id: 'love', file: '02-love.md', label: 'Love' },
  { id: 'work', file: '03-work.md', label: 'Work' },
  { id: 'shared', file: '04-shared-machinery.md', label: 'Shared machinery' },
  { id: 'clocks', file: '05-clocks.md', label: 'Clocks' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function inline(s) {
  let t = esc(s);
  const codes = [];
  t = t.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  return t;
}

const STATE = [
  [/^built/i, 'built'],
  [/^planned|^not possible|^needs/i, 'planned'],
  [/^decision/i, 'dec'],
];
function cell(text, header) {
  const t = text.trim();
  if (!header) {
    for (const [re, cls] of STATE) if (re.test(t) && t.length < 400) return `<td><span class="st st-${cls}">${inline(t)}</span></td>`;
  }
  return header ? `<th>${inline(t)}</th>` : `<td>${inline(t)}</td>`;
}

function splitRow(line) {
  const parts = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/);
  return parts.map((p) => p.replace(/\\\|/g, '|'));
}

/** a small markdown subset: headings, paragraphs, tables, lists, fenced blocks, images (SVG files are inlined) */
function md(src, level = 3) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  let para = [];
  const flush = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush();
      const lang = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      if (lang === 'mermaid') html.push(`<div class="diagram"><pre class="mermaid">${esc(body.join('\n'))}</pre></div>`);
      else html.push(`<pre class="code"><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^<!--/.test(line)) {
      flush();
      while (i < lines.length && !/-->/.test(lines[i])) i++;
      i++;
      continue;
    }
    const h = /^(#{1,5})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const n = Math.min(6, Math.max(level, h[1].length + (level - 3)));
      html.push(`<h${n}>${inline(h[2])}</h${n}>`);
      i++;
      continue;
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      flush();
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      html.push(
        `<div class="tablewrap"><table><thead><tr>${head.map((c) => cell(c, true)).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => cell(c, false)).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line);
    if (img) {
      flush();
      const p = join(here, img[2]);
      if (existsSync(p) && /\.svg$/.test(p)) html.push(`<figure class="fig">${readFileSync(p, 'utf8').replace(/<\?xml[^>]*>/, '')}<figcaption>${inline(img[1])}</figcaption></figure>`);
      else html.push(`<p class="missing">Figure not found: ${esc(img[2])}</p>`);
      i++;
      continue;
    }
    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m) {
          items.push(m[3]);
          i++;
        } else if (/^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1] += ' ' + lines[i].trim();
          i++;
        } else break;
      }
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  return html.join('\n');
}

/** split a file into its title, intro and `## ` sections; a section with a pair comment becomes a pair */
function parseFile(text) {
  const src = text.replace(/\r\n/g, '\n');
  const parts = src.split(/^## /m);
  const head = parts.shift() ?? '';
  const title = (/^# (.*)$/m.exec(head) ?? [, ''])[1];
  const intro = head.replace(/^# .*$/m, '');
  const sections = parts.map((p) => {
    const nl = p.indexOf('\n');
    const name = p.slice(0, nl).trim();
    const body = p.slice(nl + 1);
    const meta = /<!--\s*pair\s+([^>]*?)-->/.exec(body);
    if (!meta) return { kind: 'prose', name, body };
    const attrs = Object.fromEntries([...meta[1].matchAll(/(\w+)=([^\s]+)/g)].map((m) => [m[1], m[2]]));
    const subs = {};
    const order = [];
    const chunks = body.replace(meta[0], '').split(/^### /m);
    const pre = chunks.shift() ?? '';
    for (const c of chunks) {
      const n = c.indexOf('\n');
      const k = c.slice(0, n).trim();
      subs[k] = c.slice(n + 1);
      order.push(k);
    }
    return { kind: 'pair', name, attrs, pre, subs, order };
  });
  return { title, intro, sections };
}

const KNOWN = ['Live today', 'With the research', 'Changes', 'Stays the same', 'Open'];
let pairCount = 0;
let diagramCount = 0;

function renderPair(view, s) {
  pairCount++;
  const id = `${view.id}-${slug(s.attrs.id ?? s.name)}`;
  const reaches = (s.attrs.reaches ?? 'yes') === 'yes';
  const lens = s.attrs.lens && s.attrs.lens !== '-' ? `<span class="tag">lens ${esc(s.attrs.lens)}</span>` : '';
  const live = s.subs['Live today'] ?? '';
  const next = s.subs['With the research'] ?? '';
  diagramCount += (live.match(/```mermaid/g) ?? []).length + (next.match(/```mermaid/g) ?? []).length;
  const extra = s.order.filter((k) => !KNOWN.includes(k));
  return `<section class="pair" id="${id}" data-side="both">
  <header class="pairhead">
    <h3>${inline(s.name)}</h3>
    <div class="tags"><span class="tag ${reaches ? 'tag-yes' : 'tag-no'}">${reaches ? 'reaches a card' : 'does not reach a card'}</span>${lens}</div>
  </header>
  ${s.pre.trim() ? md(s.pre, 4) : ''}
  <div class="sidetoggle" role="group" aria-label="Which side to show">
    <button type="button" data-show="live">Live today</button>
    <button type="button" data-show="next">With the research</button>
    <button type="button" data-show="both" aria-pressed="true">Both</button>
  </div>
  <div class="sides">
    <div class="side side-live"><h4>Live today <span class="commit">${esc(s.attrs.live ?? '')}</span></h4>${md(live, 5)}</div>
    <div class="side side-next"><h4>With the research <span class="commit">${esc(s.attrs.dev ?? '')}</span></h4>${md(next, 5)}
      <p class="legend"><span class="st st-built">built, not deployed</span><span class="st st-planned">planned</span><span class="st st-dec">waits on a decision</span></p>
    </div>
  </div>
  ${s.subs['Changes'] ? `<h4>What changes and why</h4>${md(s.subs['Changes'], 5)}` : ''}
  <dl class="notes">
    ${s.subs['Stays the same'] ? `<div><dt>Stays the same</dt><dd>${md(s.subs['Stays the same'], 5)}</dd></div>` : ''}
    ${s.subs['Open'] ? `<div><dt>Open</dt><dd>${md(s.subs['Open'], 5)}</dd></div>` : ''}
  </dl>
  ${extra.map((k) => `<h4>${inline(k)}</h4>${md(s.subs[k], 5)}`).join('\n')}
</section>`;
}

const views = [];
for (const v of VIEWS) {
  const p = join(here, v.file);
  if (!existsSync(p)) {
    views.push({ ...v, html: `<p class="missing">This chapter is not written yet (${esc(v.file)}).</p>`, toc: [] });
    continue;
  }
  const f = parseFile(readFileSync(p, 'utf8'));
  const toc = [];
  const body = f.sections
    .map((s) => {
      if (s.kind === 'pair') {
        toc.push({ id: `${v.id}-${slug(s.attrs.id ?? s.name)}`, name: s.name });
        return renderPair(v, s);
      }
      const id = `${v.id}-${slug(s.name)}`;
      toc.push({ id, name: s.name });
      return `<section class="prose" id="${id}"><h3>${inline(s.name)}</h3>${md(s.body, 4)}</section>`;
    })
    .join('\n');
  views.push({ ...v, title: f.title, html: `${md(f.intro, 4)}\n${body}`, toc });
}

const css = readFileSync(join(here, 'page.css'), 'utf8');
const js = readFileSync(join(here, 'page.js'), 'utf8');
const page = `<title>Technique Atlas</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap">
<style>
${css}
</style>
<header class="top">
  <div class="wrap topin">
    <p class="brand">Technique Atlas</p>
    <nav class="views" aria-label="Chapters">
      ${views.map((v) => `<a href="#${v.id}" data-view="${v.id}">${esc(v.label)}</a>`).join('\n      ')}
    </nav>
  </div>
</header>
<main class="wrap">
${views
  .map(
    (v) => `<article class="view" id="${v.id}" data-view="${v.id}">
  <h2>${inline(v.title ?? v.label)}</h2>
  ${v.toc.length > 3 ? `<nav class="toc" aria-label="In this chapter"><ol>${v.toc.map((t) => `<li><button type="button" data-jump="${t.id}">${inline(t.name)}</button></li>`).join('')}</ol></nav>` : ''}
  ${v.html}
</article>`,
  )
  .join('\n')}
</main>
<script>
${js}
</script>
`;
// the published page names no person: the docs say who decided, the page says "the owner"
const anon = page.replace(/>Sachin's/g, ">The owner's").replace(/>Sachin(?![a-z])/g, '>The owner').replace(/Sachin's/g, "the owner's").replace(/Sachin(?![a-z])/g, 'the owner');
writeFileSync(out, anon);
console.log(JSON.stringify({ out, bytes: page.length, pairs: pairCount, diagrams: diagramCount, views: views.map((v) => `${v.id}:${v.toc.length}`) }));
