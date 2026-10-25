import { describe, expect, it } from 'vitest';
import { classifyRules, extractHorizon, normalize, textOf } from '../../../src/reading/buckets/classifier.js';
import { BUCKETS, BUCKET_IDS, CHIP_BUCKETS, policyFor, type BucketId } from '../../../src/reading/buckets/taxonomy.js';
import { FRAMES } from '../../../src/reading/packs/frames.js';
import { LABELLED } from '../../fixtures/buckets/labelled.js';

const AS_OF = '2026-10-24';

function horizonClass(h: unknown): string {
  if (h === undefined) return 'none';
  return typeof h === 'object' ? 'range' : String(h);
}

describe('bucket taxonomy', () => {
  it('every bucket maps to existing evidence-pack frames and has a default template', () => {
    for (const id of BUCKET_IDS) {
      const b = BUCKETS[id];
      expect(b.id).toBe(id);
      expect(b.frames.length).toBeGreaterThan(0);
      for (const f of b.frames) expect(FRAMES[f], `${id} -> ${f}`).toBeTruthy();
      for (const s of b.subBuckets) if (s.frame) expect(FRAMES[s.frame], `${id}.${s.id}`).toBeTruthy();
      expect(b.defaultTemplate).toMatch(/^T([1-9]|10)$/);
    }
  });
  it('global policy applies to every bucket; health and compatibility carry their own', () => {
    for (const id of BUCKET_IDS) expect(policyFor(id)).toEqual(expect.arrayContaining(['no_remedies', 'no_death_prediction']));
    expect(policyFor('health_windows')).toEqual(expect.arrayContaining(['no_medical_advice', 'vigilance_only']));
    expect(policyFor('compatibility')).toContain('needs_second_chart');
  });
  it('chips list only real buckets', () => {
    for (const c of CHIP_BUCKETS) expect(BUCKET_IDS).toContain(c);
  });
});

describe('bucket classifier on the labelled set', () => {
  const results = LABELLED.map((l) => ({ l, r: classifyRules(l.q, AS_OF) }));

  it('has at least 150 labelled questions', () => {
    expect(LABELLED.length).toBeGreaterThanOrEqual(150);
  });

  it('overall accuracy is at least 90 %', () => {
    const wrong = results.filter(({ l, r }) => r.bucket !== l.bucket).map(({ l, r }) => `${l.q} -> ${r.bucket} (want ${l.bucket})`);
    const acc = 1 - wrong.length / results.length;
    expect(acc, wrong.join('\n')).toBeGreaterThanOrEqual(0.9);
  });

  it('per-bucket recall is at least 75 % and precision at least 75 %', () => {
    const report: string[] = [];
    for (const b of BUCKET_IDS) {
      const truth = results.filter(({ l }) => l.bucket === b);
      const pred = results.filter(({ r }) => r.bucket === b);
      if (!truth.length) continue;
      const tp = truth.filter(({ r }) => r.bucket === b).length;
      const recall = tp / truth.length;
      const precision = pred.length ? tp / pred.length : 1;
      report.push(`${b}: recall ${recall.toFixed(2)} precision ${precision.toFixed(2)} (n=${truth.length})`);
      expect(recall, report.join('\n')).toBeGreaterThanOrEqual(0.75);
      expect(precision, report.join('\n')).toBeGreaterThanOrEqual(0.75);
    }
  });

  it('sub-buckets match where labelled (at least 85 %)', () => {
    const labelled = results.filter(({ l }) => l.sub && l.bucket === BUCKETS[l.bucket].id);
    const ok = labelled.filter(({ l, r }) => r.bucket === l.bucket && r.subBucket === l.sub);
    const bad = labelled.filter((x) => !ok.includes(x)).map(({ l, r }) => `${l.q} -> ${r.subBucket} (want ${l.sub})`);
    expect(ok.length / labelled.length, bad.join('\n')).toBeGreaterThanOrEqual(0.85);
  });

  it('horizons match where labelled (at least 90 %)', () => {
    const labelled = results.filter(({ l }) => l.horizon);
    const bad = labelled.filter(({ l, r }) => horizonClass(r.slots.horizon?.value) !== l.horizon).map(({ l, r }) => `${l.q} -> ${horizonClass(r.slots.horizon?.value)} (want ${l.horizon})`);
    expect(1 - bad.length / labelled.length, bad.join('\n')).toBeGreaterThanOrEqual(0.9);
  });
});

describe('slot extraction', () => {
  const h = (q: string) => extractHorizon(textOf(q), AS_OF)?.value;
  it('reads spans, calendar years, months and ranges', () => {
    expect(h('in the next 6 months')).toBe('6m');
    expect(h('within three months')).toBe('3m');
    expect(h('over the next 2 years')).toBe('3y');
    expect(h('this year')).toEqual({ from: '2026-10-24', to: '2026-12-31' });
    expect(h('next year')).toEqual({ from: '2027-01-01', to: '2027-12-31' });
    expect(h('next month')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(h('by March')).toEqual({ from: '2026-10-24', to: '2027-03-31' });
    expect(h('before June 2027')).toEqual({ from: '2026-10-24', to: '2027-06-30' });
    expect(h('in 2028')).toEqual({ from: '2028-01-01', to: '2028-12-31' });
    expect(h('between Nov 2026 and Apr 2027')).toEqual({ from: '2026-11-01', to: '2027-04-30' });
    expect(h('right now')).toBe('now');
    expect(h('When will I get married?')).toBeUndefined();
  });
  it('finds whose chart a question is about', () => {
    expect(classifyRules('Will my son clear his exams?', AS_OF).slots.subject_person?.value).toBe('son');
    expect(classifyRules("How is my wife's career going?", AS_OF).slots.subject_person?.value).toBe('spouse');
    expect(classifyRules('When will I get married?', AS_OF).slots.subject_person?.value).toBe('me');
    expect(classifyRules('How is my relationship with my father?', AS_OF).slots.subject_person?.value).toBe('me');
  });
  it('lists missing required slots', () => {
    const r = classifyRules('When will I get married?', AS_OF);
    expect(r.missing).toEqual(['horizon']);
    const c = classifyRules('Should I change jobs this year?', AS_OF);
    expect(c.missing).toEqual([]);
    const k = classifyRules('Is my career going anywhere?', AS_OF);
    expect(k.missing).toEqual(expect.arrayContaining(['horizon', 'sub_bucket']));
  });
  it('reads career background and a specific event', () => {
    expect(classifyRules('I lost my job, when will I get another one?', AS_OF).slots.background?.value).toBe('between_jobs');
    expect(classifyRules('Is my promotion in March going to happen?', AS_OF).slots.specific_event?.value).toBe('promotion in march');
    expect(classifyRules('Is moving to Dubai good for my career?', AS_OF).slots.specific_event?.value).toBe('moving to dubai');
  });
});

describe('negation', () => {
  it('meta-negation removes a topic', () => {
    expect(classifyRules('Not about my marriage, I want to know about my job', AS_OF).bucket).toBe('career_job');
    expect(classifyRules('Apart from money, how will my relationship go?', AS_OF).bucket).toBe('love_relationships');
  });
  it('an ordinary negative keeps the topic', () => {
    expect(classifyRules('Why am I not getting a job?', AS_OF).bucket).toBe('career_job');
    expect(classifyRules('My marriage is not going well', AS_OF).bucket).toBe('marriage');
  });
});

describe('templates and policy', () => {
  const t = (q: string) => classifyRules(q, AS_OF).template;
  it('picks the template from the question kind', () => {
    expect(t('When will I get married?')).toBe('T2');
    expect(t('Will I clear my exam?')).toBe('T1');
    expect(t('Should I change jobs or stay?')).toBe('T5');
    expect(t('Why is everything so hard right now?')).toBe('T3');
    expect(t('Ketu is transiting over my natal Jupiter, what does that mean for me?')).toBe('T4');
    expect(t('What do my nakshatras say about me?')).toBe('T7');
    expect(t('Are my partner and I compatible?')).toBe('T8');
    expect(t('How does this month look for me?')).toBe('T9');
    expect(t('What is Sade Sati?')).toBe('T10');
  });
  it('flags questions astrology cannot answer as posed', () => {
    const death = classifyRules('When will I die?', AS_OF);
    expect(death.unanswerable).toBe('death_timing');
    expect(death.template).toBe('T10');
    expect(classifyRules('Give me the lottery numbers for tomorrow', AS_OF).unanswerable).toBe('lottery_numbers');
    expect(classifyRules('How much money will I earn next year?', AS_OF).unanswerable).toBe('exact_amount');
    expect(classifyRules('Will I get the call tomorrow at 3 pm?', AS_OF).unanswerable).toBe('exact_clock_time');
    expect(classifyRules('Do I have cancer?', AS_OF).unanswerable).toBe('diagnosis');
    expect(classifyRules('Will it happen?', AS_OF).unanswerable).toBe('no_subject');
    expect(classifyRules('When will I get married?', AS_OF).unanswerable).toBeNull();
  });
});

describe('speed and robustness', () => {
  it('classifies each labelled question in under 5 ms (p95)', () => {
    for (const l of LABELLED.slice(0, 20)) classifyRules(l.q, AS_OF); // warm up
    const times = LABELLED.map((l) => {
      const t0 = performance.now();
      classifyRules(l.q, AS_OF);
      return performance.now() - t0;
    }).sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)]!;
    expect(p95).toBeLessThan(5);
  });
  it('stays linear on adversarial input', () => {
    const inputs = ['a'.repeat(100_000), 'next '.repeat(20_000) + 'months', 'job '.repeat(10_000), '?'.repeat(50_000), '1 2 3 4 5 '.repeat(5_000), "'".repeat(30_000) + 'x'];
    for (const s of inputs) {
      const t0 = performance.now();
      const r = classifyRules(s, AS_OF);
      expect(performance.now() - t0, s.slice(0, 20)).toBeLessThan(50);
      expect(BUCKET_IDS).toContain(r.bucket);
    }
  });
  it('normalises case, punctuation and apostrophes', () => {
    expect(normalize("WHEN will I get MARRIED?!")).toBe('when will i get married ?');
    expect(normalize("my wife's job")).toBe('my wifes job');
  });
  it('unknown for text with no life area', () => {
    for (const q of ['Hello', 'asdf qwerty', 'Tell me something']) expect(classifyRules(q, AS_OF).bucket as BucketId).toBe('unknown');
  });
});

describe('multi-subject questions', () => {
  it('lists the other life areas and lowers confidence so the clarifier asks (golden Q12)', () => {
    const r = classifyRules('How will my work, money and marriage go over the next 3 years?', AS_OF);
    expect(r.alsoBuckets).toEqual(expect.arrayContaining(['money_wealth', 'career_job']));
    expect(r.confidence).toBeLessThanOrEqual(0.55);
  });
  it('a single-subject question has no secondary buckets', () => {
    expect(classifyRules('When will I get married?', AS_OF).alsoBuckets).toEqual([]);
  });
});
