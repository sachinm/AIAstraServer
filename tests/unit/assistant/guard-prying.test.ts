import { describe, expect, it } from 'vitest';
import { DATA_REPLY, WOULD_NOT_KNOW, fixedAnswer } from '../../../src/assistant/guard.js';

describe('questions about where it comes from and how it is done', () => {
  it.each([
    'where did the data come from',
    'where does your data come from?',
    'where do you get your data',
    'where does your information come from',
    'what is your process for a reading',
    'what method do you use for the readings',
    'what are the steps to interpret a chart',
    'how are the readings made',
    'how does a reading work',
    'how are predictions generated',
    'who built this',
    'who made this site',
  ])('%s gets the fixed line', (q) => {
    expect(fixedAnswer(q)?.answer).toBe(WOULD_NOT_KNOW);
  });
});

describe('questions about storage and security', () => {
  it.each([
    'what encryption do you use',
    'is it encrypted',
    'do you use AES 256',
    'how do you store my data',
    'where is my data stored',
    'where do you store birth details',
    'do you keep my birth details',
    'what database storage do you have',
    'how secure is this site',
    'what security do you have',
    'is my data safe',
    'are my details sold',
    'are you SOC 2 certified',
    'where are your data centers',
  ])('%s points to the policy, saying nothing about how', (q) => {
    expect(fixedAnswer(q)?.answer).toBe(DATA_REPLY);
  });

  it('the reply itself gives nothing away', () => {
    expect(DATA_REPLY).not.toMatch(/encrypt|database|server|cloud|aws|store/i);
  });
});

describe('ordinary questions still get through', () => {
  it.each([
    'can you tell me where my son will go to college',
    'what field are they more inclined for',
    'how do I get a reading',
    'what can a reading tell me about my career',
    'is there a free plan',
    'will you answer questions about my illness',
    'can you read my birth chart',
    'where should I move for work',
    'who will I marry',
    'how much does it cost',
  ])('%s', (q) => {
    expect(fixedAnswer(q)).toBeNull();
  });
});
