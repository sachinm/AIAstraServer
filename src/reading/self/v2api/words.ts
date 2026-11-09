/**
 * Words for the Self board v2 API (docs/reading-engine/66 §4.4, §4.7; doc 52 §3). Plain lines for the clock sheet and
 * the wizard's questions for a missing fact. Vocabulary only: nothing here is computed.
 */
import type { NotApplicableCause } from '../clock.js';

/** One plain line per clock for the clock sheet; a system without a line gets SYSTEM_LINE_FALLBACK. */
export const SYSTEM_LINES: Readonly<Record<string, string>> = {
  vimsottari: 'The most widely used clock: long chapters of life, read from your birth star.',
  yogini: 'A shorter clock of eight phases that repeats every 36 years; good for checking timing.',
  tithi_yogini: 'The shorter eight-phase clock, started from the lunar day you were born on.',
  tithi_ashtottari: 'A clock started from the lunar day you were born on; used to confirm the main chapters.',
  karaka: 'A clock that follows what each part of your life is meant to teach you.',
  narayana: 'A sign-based clock that times where life puts you and what it asks of you there.',
  chara: 'A sign-based clock that times the outer events of life, chapter by chapter.',
  ashtottari: 'A clock some charts qualify for; it reads the chapters through a 108-year cycle.',
  dwisatpathi: 'A clock some charts qualify for; it reads life in even 72-year rounds.',
  chathuraaseethi_sama: 'A clock some charts qualify for, tied to work and standing; even 84-year rounds.',
  chaturshitisama: 'A clock some charts qualify for, tied to work and standing; even 84-year rounds.',
  dwadasottari: 'A clock some charts qualify for; it reads the chapters through a 112-year cycle.',
  panchottari: 'A clock some charts qualify for; it reads the chapters through a 105-year cycle.',
  sataatbika: 'A clock some charts qualify for; it reads the chapters through a 100-year cycle.',
  shastihayani: 'A clock some charts qualify for; it reads the chapters through a 60-year cycle.',
  shodasottari: 'A clock some charts qualify for; it reads the chapters through a 116-year cycle.',
  shattrimsa_sama: 'A clock some charts qualify for; it reads life in even 36-year rounds.',
};

export const SYSTEM_LINE_FALLBACK = 'Another traditional way of timing the chapters of your life.';

export function systemLine(system: string): string {
  return SYSTEM_LINES[system] ?? SYSTEM_LINE_FALLBACK;
}

/** Why the board reads on this clock, one plain line (ClockResolutionV2['reason']). */
export const CLOCK_REASON_LINES: Readonly<Record<'preferred' | 'conditional_applies' | 'default', string>> = {
  preferred: 'The clock you chose.',
  conditional_applies: 'The clock your chart qualifies for.',
  default: 'The standard clock, used when no special clock applies to your chart.',
};

/** Why a conditional clock is greyed (doc 66 §4.4). */
export const NOT_APPLICABLE_LINES: Readonly<Record<NotApplicableCause, string>> = {
  does_not_apply: 'Your chart does not meet the condition this clock needs.',
  not_checked: 'Not checked for your chart.',
  no_periods: 'Not available for your chart yet.',
};

export interface FactQuestion {
  key: string;
  text: string;
  options: Array<{ value: string | null; label: string }>;
}

const RATHER_NOT = { value: null, label: 'Rather not say' };

/** The wizard's questions for the facts the Personalizer benefits from (doc 52 §3, words as written there). */
export const FACT_QUESTIONS: Readonly<Record<string, FactQuestion>> = {
  'work.status': {
    key: 'work.status',
    text: 'Do you have a job right now?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'between_jobs', label: 'Between jobs' },
      { value: 'own_business', label: 'Own business' },
      { value: 'studying', label: 'Studying' },
      { value: 'retired', label: 'Retired' },
      RATHER_NOT,
    ],
  },
  'love.status': {
    key: 'love.status',
    text: 'Right now are you…',
    options: [
      { value: 'single', label: 'Single' },
      { value: 'dating', label: 'Dating' },
      { value: 'committed', label: 'Committed' },
      { value: 'married', label: 'Married' },
      { value: 'separated', label: 'Separated' },
      { value: 'complicated', label: 'It’s complicated' },
      RATHER_NOT,
    ],
  },
  'family.children': {
    key: 'family.children',
    text: 'Children?',
    options: [
      { value: 'none', label: 'None' },
      { value: 'expecting', label: 'Expecting' },
      { value: 'young', label: 'Yes, young' },
      { value: 'grown', label: 'Yes, grown' },
      RATHER_NOT,
    ],
  },
  'self.focus': {
    key: 'self.focus',
    text: 'What matters most to you now?',
    options: [
      { value: 'career', label: 'Career' },
      { value: 'money', label: 'Money' },
      { value: 'love', label: 'Love' },
      { value: 'family', label: 'Family' },
      { value: 'home', label: 'Home' },
      { value: 'learning', label: 'Learning' },
      { value: 'travel', label: 'Travel' },
      { value: 'health', label: 'Health' },
      { value: 'creativity', label: 'Creativity' },
      { value: 'spirituality', label: 'Spirituality' },
      RATHER_NOT,
    ],
  },
};
