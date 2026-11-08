/**
 * `self.reading.diagnosis` — Who you are, in short (docs/reading-engine/59 §2, §6.6; the Self instance of
 * `board.diagnosis`). Three sentences built last from the other panels' claims, shown first: the direction and footing of
 * the self (lagna panel), the central tension (a struggle the reading clock is running now, else the first knot, else the
 * first struggle), and where the person stands now (the running chapter and sub-chapter, dated). It adds no fact: every
 * sentence cites the claim ids it was built from as `claim:<id>` evidence.
 */
import { housesShort, housesWord, longDate } from '../words.js';
import { gaps } from '../slices.js';
import type { PanelBody, SelfClaim, SelfPanelId } from '../types.js';
import { body } from './common.js';

export type PanelBodies = Partial<Record<SelfPanelId, PanelBody>>;

const lower = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);

/** The claim the central tension is built from: a running struggle (it has a release date), else a knot, else the first struggle. */
export function tensionSource(b: PanelBodies): SelfClaim | null {
  const struggle = b.struggle?.claims ?? [];
  return struggle.find((c) => /presses hardest until/.test(c.text)) ?? (b.yogas?.claims ?? []).find((c) => c.text.startsWith('A knot')) ?? struggle[0] ?? null;
}

export function diagnosisPanel(b: PanelBodies): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const lord = b.lagna?.claims.find((c) => c.id === 'lagna.lord_house');
  const state = b.lagna?.claims.find((c) => c.id === 'lagna.lord_state');
  if (lord && b.lagna?.lead) {
    claims.push({
      id: 'diagnosis.direction',
      text: `${b.lagna.lead}${state ? ` ${state.text}` : ''}`,
      line: b.lagna.lead,
      range: 'always',
      detail: [lord.detail, state?.detail].filter(Boolean).join(' | '),
      certainty: 'fact',
      evidence: [`claim:${lord.id}`, ...(state ? [`claim:${state.id}`] : [])],
    });
  } else g.add('lagna panel has no lord_house claim');
  const t = tensionSource(b);
  if (t) {
    const text = t.text.startsWith('A knot') ? `The knot in it: ${lower(t.text.replace(/^A knot: a knot that asks for patience, /, ''))}` : `The tension in it: ${lower(t.text)}`;
    claims.push({ id: 'diagnosis.tension', text, line: t.line ?? (t.text.startsWith('A knot') ? t.text : undefined), range: t.range ?? 'always', detail: t.detail, certainty: t.certainty, evidence: [`claim:${t.id}`] });
  } else g.add('no struggle or knot claim to name a tension');
  const running = b.chapters?.chapters?.find((c) => c.kind === 'running');
  if (running) {
    const now =
      running.certainty === 'split'
        ? `Your clocks do not agree on the chapter you are in; your reading clock dates it ${longDate(running.from)} to ${longDate(running.to)}.`
        : `You are in a chapter of ${housesShort(running.houses)} that runs to ${longDate(running.to)}${running.sub ? `; since ${longDate(running.sub.from)}, what presses is ${housesShort(running.sub.houses)}` : ''}.`;
    const nowLine = running.certainty === 'split' ? undefined : running.sub ? `Until ${longDate(running.sub.to)} the pressure is on ${housesWord(running.sub.houses)}, inside a chapter of ${housesWord(running.houses, 2)}.` : `Until ${longDate(running.to)} you are in a chapter of ${housesWord(running.houses)}.`;
    claims.push({ id: 'diagnosis.now', text: now, line: nowLine, range: running.sub ? { from: running.sub.from, to: running.sub.to } : { from: running.from, to: running.to }, detail: running.detail, certainty: running.certainty, evidence: ['claim:chapters.running', ...(running.sub ? ['claim:chapters.sub'] : [])] });
  } else g.add('chapters panel has no running chapter');
  return body(claims[0]?.text ?? '', claims, g);
}
