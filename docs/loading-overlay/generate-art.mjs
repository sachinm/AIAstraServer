// Generates the loading veil's four illustrations with Gemini image generation (docs/loading-overlay/03). Run only after
// Sachin's typed yes (given 2026-11-09). Hard cap 8 calls (4 images + retries). Reads GEMINI_API_KEY from the server
// .env, writes PNG + WebP into docs/loading-overlay/art/, copies the WebP to the web checkout's art/overlay/, and appends
// to docs/loading-overlay/art/log.md.
//   node docs/loading-overlay/generate-art.mjs [--only south-light,north-dark] [--web C:/path/to/AIAstra_WEB]
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const MODEL = process.env.GEMINI_IMAGE_MODEL_ID || 'gemini-2.5-flash-image';
const MAX_CALLS = 8;
const OUT = 'docs/loading-overlay/art';
const args = process.argv.slice(2);
const only = (args.includes('--only') ? args[args.indexOf('--only') + 1] : '').split(',').filter(Boolean);
const web = args.includes('--web') ? args[args.indexOf('--web') + 1] : '';

function envKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const m = /^GEMINI_API_KEY=\s*(\S+)\s*$/m.exec(readFileSync('.env', 'utf8'));
  if (!m) throw new Error('GEMINI_API_KEY not found');
  return m[1];
}

const SHARED = `A premium, minimal illustration of an empty Vedic astrology house chart, drawn as fine, even line work with a soft hand-inked feel, centred on a plain background with generous margins. No planets are placed inside the houses. Each of the twelve houses carries a small, elegant numeral 1 through 12 in a classic serif, starting at the first house. To the left of the chart, lined up in a single neat column like chess pieces beside a board, the nine graha symbols: Sun ☉, Moon ☽, Mars ♂, Mercury ☿, Jupiter ♃, Venus ♀, Saturn ♄, Rahu ☊, Ketu ☋, in warm gold. To the right, in a matching column, the twelve rashi symbols ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓. Along the bottom edge, in two quiet rows of small serif type, the 27 nakshatra names: Ashwini, Bharani, Krittika, Rohini, Mrigashira, Ardra, Punarvasu, Pushya, Ashlesha, Magha, Purva Phalguni, Uttara Phalguni, Hasta, Chitra, Swati, Vishakha, Anuradha, Jyeshtha, Mula, Purva Ashadha, Uttara Ashadha, Shravana, Dhanishta, Shatabhisha, Purva Bhadrapada, Uttara Bhadrapada, Revati. The centre of the chart stays open and calm so a short sentence can be read over it. Apple-grade restraint: thin lines, exact spacing, no texture noise, no people, no logos, no extra text, no decorative planets anywhere.`;
const SOUTH = `The chart is the South Indian style: a square divided into a 4 × 4 grid whose central 2 × 2 is one open square, the twelve outer cells being the houses, numbered clockwise from the second cell of the top row.`;
const NORTH = `The chart is the North Indian style: a square with both diagonals and an inner diamond joining the midpoints of the sides, giving four central diamonds and eight corner triangles; the first house is the top diamond, and the numbers run anticlockwise 1 to 12.`;
const LIGHT = `Background pale ivory (#f7f5ff), lines deep indigo (#3b2a7a), numerals slate, graha symbols warm gold (#b45309), rashi symbols indigo, nakshatra names soft grey-violet. Morning light, airy.`;
const DARK = `Background deep midnight (#0b0a1f) with the faintest violet vignette, lines pale lavender (#d8b4fe) with a gentle glow, numerals lavender-white, graha symbols pale gold (#fde68a), rashi symbols lavender, nakshatra names muted violet. Quiet night, luminous.`;

const JOBS = [
  { name: 'south-light', prompt: `${SHARED} ${SOUTH} ${LIGHT}` },
  { name: 'south-dark', prompt: `${SHARED} ${SOUTH} ${DARK}` },
  { name: 'north-light', prompt: `${SHARED} ${NORTH} ${LIGHT}` },
  { name: 'north-dark', prompt: `${SHARED} ${NORTH} ${DARK}` },
].filter((j) => only.length === 0 || only.includes(j.name));

const key = envKey();
mkdirSync(OUT, { recursive: true });
const logFile = join(OUT, 'log.md');
if (!existsSync(logFile)) writeFileSync(logFile, '# Generation log\n\n| when | image | model | status | bytes (png) | note |\n|---|---|---|---|---|---|\n');
const log = (name, status, bytes, note = '') => appendFileSync(logFile, `| ${new Date().toISOString()} | ${name} | ${MODEL} | ${status} | ${bytes} | ${note} |\n`);

let calls = 0;
async function generate(job) {
  if (calls >= MAX_CALLS) throw new Error('call cap reached');
  calls += 1;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: job.prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:3' } },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  const body = JSON.parse(text);
  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(`no image in response: ${text.slice(0, 300)}`);
  return Buffer.from(part.inlineData.data, 'base64');
}

for (const job of JOBS) {
  try {
    const png = await generate(job);
    writeFileSync(join(OUT, `${job.name}.png`), png);
    const webp = await sharp(png).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    writeFileSync(join(OUT, `${job.name}.webp`), webp);
    if (web) {
      mkdirSync(join(web, 'art/overlay'), { recursive: true });
      copyFileSync(join(OUT, `${job.name}.webp`), join(web, 'art/overlay', `${job.name}.webp`));
    }
    log(job.name, 'ok', png.length, `webp ${webp.length} bytes`);
    console.log(`[art] ${job.name}: png ${png.length} B, webp ${webp.length} B`);
  } catch (e) {
    log(job.name, 'failed', 0, String(e.message).replace(/\|/g, '/').slice(0, 200));
    console.error(`[art] ${job.name} failed: ${e.message}`);
  }
}
console.log(`[art] ${calls} call(s) made`);
