/**
 * The Self card registry (docs/reading-engine/68 §4.3, §4.5 item 1). Replaces the fixed `SELF_V2_AREAS` list as the
 * board's source of cards. Phase A offers the eleven v2 areas (the `now` hero is not a card); the later ids are reserved
 * here, not offered, so a stored layout naming one is refused until its phase ships.
 *
 * Words only: titles and descriptions for the picker. What each card reads from the chart lives in the Oracle prompt's
 * card briefs (Phase B), never here.
 */
import { DEFAULT_SECTIONS, type SelfCardDef, type SelfCardId, type SelfCardIdV2 } from './types.js';

const S = DEFAULT_SECTIONS;

export const SELF_CARDS: readonly SelfCardDef[] = [
  // Body
  { id: 'body', group: 'body', title: 'Body & energy', description: 'What wears your body this year and what steadies it', v2Area: 'body', suggested: true, sensitive: true, needs: [], offered: true, defaultSections: S },
  { id: 'fitness', group: 'body', title: 'Fitness & strength', description: 'When to push, when to hold, and what kind of effort suits you', v2Area: null, suggested: false, sensitive: true, needs: [], offered: false, defaultSections: S },
  { id: 'sleep', group: 'body', title: 'Sleep & rest', description: 'When rest runs thin and when it comes back', v2Area: null, suggested: false, sensitive: true, needs: [], offered: false, defaultSections: S },
  { id: 'blood', group: 'body', title: 'Blood & vitality', description: 'Your stamina and recovery through the year', v2Area: null, suggested: false, sensitive: true, needs: [], offered: false, defaultSections: S },
  { id: 'constitution', group: 'indian', title: 'Constitution (Prakriti)', description: 'Your make-up in the Indian sense, and what unsettles it this year', v2Area: null, suggested: false, sensitive: true, needs: ['engine:constitution'], offered: false, defaultSections: S },

  // Mind
  { id: 'mind', group: 'mind', title: 'How you think', description: 'How you reason, judge and worry', v2Area: 'mind', suggested: true, sensitive: false, needs: [], offered: true, defaultSections: S },
  { id: 'sharpness', group: 'mind', title: 'Sharpness & focus', description: 'When your mind is quick and when it is foggy', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, defaultSections: S },
  { id: 'mood', group: 'mind', title: 'Mood & inner weather', description: 'The emotional tone of each stretch of your year', v2Area: null, suggested: false, sensitive: true, needs: [], offered: false, defaultSections: S },
  { id: 'stuck', group: 'mind', title: 'What bothers you', description: 'What gets under your skin, from whom, and until when', v2Area: 'stuck', suggested: true, sensitive: false, needs: [], offered: true, defaultSections: S },
  { id: 'restores', group: 'mind', title: 'What restores you', description: 'What brings you peace and where to find it', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, defaultSections: S },
  { id: 'play', group: 'mind', title: 'Play & joy', description: 'What entertains you and when there is room for it', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, defaultSections: S },

  // Character
  { id: 'diagnosis', group: 'character', title: 'In short', description: 'The one thing to know about you now', v2Area: 'diagnosis', suggested: true, sensitive: false, needs: [], offered: true, defaultSections: S },
  { id: 'lagna', group: 'character', title: 'Who you are', description: 'Your nature, the way you meet the world', v2Area: 'lagna', suggested: true, sensitive: false, needs: [], offered: true, defaultSections: S },
  { id: 'drive', group: 'character', title: 'Drive & ambition', description: 'What pushes you, and what it is for', v2Area: 'drive', suggested: true, sensitive: false, needs: [], offered: true, defaultSections: S },
  { id: 'presence', group: 'character', title: 'How you come across', description: 'How other people read you, which you cannot see yourself', v2Area: 'presence', suggested: false, sensitive: false, needs: [], offered: true, defaultSections: S },
  { id: 'yogas', group: 'character', title: 'Gifts & knots', description: 'What you were given, and what tangles', v2Area: 'yogas', suggested: false, sensitive: false, needs: [], offered: true, defaultSections: S },
  { id: 'purpose', group: 'character', title: 'Purpose & meaning', description: 'What this life is for, and what this year asks of it', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, defaultSections: S },
  { id: 'learning', group: 'character', title: 'Learning & skill', description: 'What to learn this year, and when it sticks', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, defaultSections: S },

  // Indian lens
  { id: 'layers', group: 'indian', title: 'The five layers', description: 'Body, breath, mind, judgment, joy: which layer needs care now', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, defaultSections: S },
  { id: 'aims', group: 'indian', title: 'The four aims', description: 'Duty, means, desire, release: which one this stretch serves', v2Area: null, suggested: false, sensitive: false, needs: ['engine:four_aims'], offered: false, defaultSections: S },
  { id: 'practice', group: 'indian', title: 'Practice & deity', description: 'The practice that suits you, and the deity of your chart', v2Area: null, suggested: false, sensitive: false, needs: ['engine:practice_deity'], offered: false, defaultSections: S },
  { id: 'saturn', group: 'indian', title: "Saturn's long passage", description: 'Where you are in the seven and a half years, by date', v2Area: null, suggested: false, sensitive: false, needs: ['sade_sati'], offered: false, defaultSections: S },
  { id: 'helps', group: 'indian', title: 'What helps', description: 'Fasting days, giving, mantra: practices for what presses now', v2Area: null, suggested: false, sensitive: false, needs: ['engine:practices'], offered: false, defaultSections: S },

  // Time
  { id: 'chapter', group: 'time', title: 'This chapter', description: 'The stretch of life you are in, and when it turns', v2Area: 'chapter', suggested: true, sensitive: false, needs: [], offered: true, defaultSections: S },
  { id: 'chapters', group: 'time', title: 'Chapters', description: 'The long arc of your life, chapter by chapter', v2Area: 'chapters', suggested: false, sensitive: false, needs: [], offered: true, defaultSections: S },
  { id: 'year', group: 'time', title: 'This year', description: 'Your year from birthday to birthday', v2Area: 'year', suggested: true, sensitive: false, needs: [], offered: true, defaultSections: S },
];

const BY_ID: ReadonlyMap<SelfCardId, SelfCardDef> = new Map(SELF_CARDS.map((c) => [c.id, c]));

export function cardDef(id: string): SelfCardDef | null {
  return BY_ID.get(id as SelfCardId) ?? null;
}

export const OFFERED_CARDS: readonly SelfCardDef[] = SELF_CARDS.filter((c) => c.offered);

/** the cards the v2 build fills, in registry order */
export const V2_FILLED_CARDS: readonly SelfCardIdV2[] = SELF_CARDS.flatMap((c) => (c.offered && c.v2Area ? [c.v2Area] : []));

/** the registry's own suggested set, in registry order: at most SUGGESTED_COUNT */
export function defaultSuggested(): SelfCardId[] {
  return OFFERED_CARDS.filter((c) => c.suggested).map((c) => c.id);
}
