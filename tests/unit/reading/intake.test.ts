import { describe, expect, it } from 'vitest';
import { ruleIntake, runIntake, SELF_HARM_RESPONSE } from '../../../src/reading/nodes/intake.js';

const ASOF = '2026-10-24';
const r = (q: string) => ruleIntake(q, ASOF).intent;

describe('rule intake: the 12 golden questions', () => {
  it('Q1 work and money problems, when does it improve', () => {
    const i = r('I am having a lot of problems with my work and with money. I am not happy. When does this improve?');
    expect(i.subjects.map((s) => s.id).sort()).toEqual(['career_work', 'income_wealth']);
    expect(i.questionType).toBe('timing');
    expect(i.horizon).toBe('1y');
    expect(i.format).toBe('timeline');
  });
  it('Q2 buy a house', () => {
    const i = r('When am I going to buy a house?');
    expect(i.subjects.map((s) => s.id)).toEqual(['property_home']);
    expect(i.horizon).toBe('3y');
    expect(i.format).toBe('timeline');
  });
  it('Q3 lottery is answered as gain windows in the direct format', () => {
    const i = r('When am I going to win the lottery?');
    expect(i.subjects.map((s) => s.id)).toEqual(['speculation_lottery']);
    expect(i.format).toBe('direct');
  });
  it('Q4 million dollars in 3 or 6 months', () => {
    const i = r('When will I make a million dollars? In the next 3 or 6 months is a big jump coming?');
    expect(i.subjects.map((s) => s.id)).toEqual(['income_wealth']);
    expect(i.horizon).toBe('6m');
    expect(i.format).toBe('timeline');
  });
  it('Q5 Ketu over my Jupiter', () => {
    const i = r('Ketu is transiting over my Jupiter. What does that even mean for me?');
    expect(i.questionType).toBe('why_meaning');
    expect(i.mentionsPlanets.sort()).toEqual(['Ju', 'Ke']);
    expect(i.format).toBe('narrative');
    expect(i.focusPoints.length).toBe(1);
  });
  it('Q6 nakshatras from all the different ways', () => {
    const i = r('Tell me about my nakshatras — look at it from all the different ways.');
    expect(i.subjects.map((s) => s.id)).toEqual(['general_life_direction']);
    expect(i.horizon).toBe('life');
    expect(i.format).toBe('narrative');
  });
  it('Q7 change jobs this year compares stay and move to year end', () => {
    const i = r('Should I change jobs this year?');
    expect(i.subjects.map((s) => s.id)).toEqual(['career_work']);
    expect(i.questionType).toBe('compare');
    expect(i.horizon).toEqual({ from: ASOF, to: '2026-12-31' });
    expect(i.format).toBe('factor_table');
  });
  it('Q8 what does my D-10 say', () => {
    const i = r('What does my D-10 say about the kind of work I am suited for?');
    expect(i.subjects.map((s) => s.id)).toEqual(['career_work']);
    expect(i.questionType).toBe('describe');
    expect(i.horizon).toBe('life');
  });
  it('Q9 when will I get married', () => {
    const i = r('When will I get married?');
    expect(i.subjects.map((s) => s.id)).toEqual(['marriage_relationship']);
    expect(i.horizon).toBe('3y');
    expect(i.format).toBe('timeline');
  });
  it('Q10 is this month a good time to sign a property deal', () => {
    const i = r('Is this month a good time to sign a property deal?');
    expect(i.subjects.map((s) => s.id)).toEqual(['property_home']);
    expect(i.horizon).toBe('now');
    expect(i.format).toBe('watchlist');
  });
  it('Q11 what is Sade Sati and am I in it', () => {
    const i = r('What is Sade Sati and am I in it?');
    expect(i.questionType).toBe('explain_term');
    expect(i.subjects.map((s) => s.id)).toEqual(['explain_term']);
    expect(i.format).toBe('direct');
  });
  it('Q12 three subjects are capped at three and flagged for the model', () => {
    const q = 'My work, my money, my marriage — what is coming in the next year?';
    const res = ruleIntake(q, ASOF);
    expect(res.intent.subjects.map((s) => s.id).sort()).toEqual(['career_work', 'income_wealth', 'marriage_relationship']);
    expect(res.intent.horizon).toBe('1y');
    expect(res.confident).toBe(false);
  });
});

describe('understanding line wording', () => {
  it('writes a date-range horizon the way a person would say it', () => {
    const i = ruleIntake('Should I change jobs this year?', ASOF).intent;
    expect(i.clarifyText).toContain('now until 31 Dec 2026');
    expect(i.clarifyText).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('rule intake: invariants', () => {
  it('weights sum to about 1 and ids are valid', () => {
    for (const q of ['When will I get married?', 'job and money', 'tell me something']) {
      const i = r(q);
      expect(Math.abs(i.subjects.reduce((n, s) => n + s.weight, 0) - 1)).toBeLessThan(0.02);
      expect(i.clarifyText.length).toBeGreaterThan(20);
    }
  });
  it('unknown questions fall back to life direction with low confidence', () => {
    const res = ruleIntake('hello there', ASOF);
    expect(res.intent.subjects[0]!.id).toBe('general_life_direction');
    expect(res.confident).toBe(false);
  });
  it('flags self harm and never reaches a model', async () => {
    const out = await runIntake('I want to die, what does my chart say', ASOF, { mode: 'llm' });
    expect(out.intent.safety).toBe('self_harm');
    expect(out.source).toBe('rules');
    expect(out.usage).toBeNull();
    expect(SELF_HARM_RESPONSE).toMatch(/988/);
  });
  it('auto mode skips the model when the rules are confident', async () => {
    const out = await runIntake('When will I get married?', ASOF, { mode: 'auto' });
    expect(out.source).toBe('rules');
    expect(out.ms).toBeLessThan(50);
  });
});
