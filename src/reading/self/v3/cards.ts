/**
 * The Self card registry (docs/reading-engine/68 §4.3, §4.5 item 1). Replaces the fixed `SELF_V2_AREAS` list as the
 * board's source of cards. Phase A offers the eleven v2 areas (the `now` hero is not a card); the later ids are reserved
 * here, not offered, so a stored layout naming one is refused until its phase ships.
 *
 * Words only: titles, descriptions, and the engine matter keys each card reads (a product words table). What each
 * card reads from the chart is in its brief (`src/reading/prompts/cards/self/<id>.md`, doc 70 §7 step 6).
 */
import { isCardsReadEnabled } from '../../../config/env.js';
import { DEFAULT_SECTIONS, type SelfCardDef, type SelfCardId, type SelfCardIdV2 } from './types.js';

const S = DEFAULT_SECTIONS;

export const SELF_CARDS: readonly SelfCardDef[] = [
  // Body
  { id: 'body', group: 'body', title: 'Body & energy', description: 'What wears your body this year and what steadies it', subtitle: 'How to pace yourself', v2Area: 'body', suggested: true, sensitive: true, needs: [], offered: true, matters: ['self_and_body', 'work_load_and_health', 'sudden_and_hidden'], defaultSections: S },
  { id: 'fitness', group: 'body', title: 'Fitness & strength', description: 'When to push, when to hold, and what kind of effort suits you', v2Area: null, suggested: false, sensitive: true, needs: [], offered: false, briefOnly: true, matters: ['self_and_body', 'effort_and_courage', 'work_load_and_health'], defaultSections: S },
  { id: 'sleep', group: 'body', title: 'Sleep & rest', description: 'When rest runs thin and when it comes back', v2Area: null, suggested: false, sensitive: true, needs: [], offered: false, briefOnly: true, matters: ['loss_rest_and_distance', 'home_and_peace', 'self_and_body'], defaultSections: S },
  { id: 'blood', group: 'body', title: 'Blood & vitality', description: 'Your stamina and recovery through the year', v2Area: null, suggested: false, sensitive: true, needs: [], offered: false, briefOnly: true, matters: ['self_and_body', 'work_load_and_health', 'effort_and_courage'], defaultSections: S },
  { id: 'constitution', group: 'indian', title: 'Constitution (Prakriti)', description: 'Your make-up in the Indian sense, and what unsettles it this year', v2Area: null, suggested: false, sensitive: true, needs: ['engine:constitution'], offered: false, matters: ['self_and_body', 'work_load_and_health'], defaultSections: S },

  // Mind
  { id: 'mind', group: 'mind', title: 'How you think', description: 'How you reason, judge and worry', subtitle: 'How you reason, judge and worry', v2Area: 'mind', suggested: true, sensitive: false, needs: [], offered: true, matters: ['home_and_peace', 'ideas_and_children', 'self_and_body'], defaultSections: S },
  { id: 'sharpness', group: 'mind', title: 'Sharpness & focus', description: 'When your mind is quick and when it is foggy', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, briefOnly: true, matters: ['ideas_and_children', 'effort_and_courage', 'career_and_standing'], defaultSections: S },
  { id: 'mood', group: 'mind', title: 'Mood & inner weather', description: 'The emotional tone of each stretch of your year', v2Area: null, suggested: false, sensitive: true, needs: [], offered: false, briefOnly: true, matters: ['home_and_peace', 'self_and_body', 'loss_rest_and_distance'], defaultSections: S },
  { id: 'stuck', group: 'mind', title: "What's weighing on you", description: 'What gets under your skin, from whom, and until when', subtitle: 'What gets under your skin, and until when', v2Area: 'stuck', suggested: true, sensitive: false, needs: [], offered: true, matters: ['work_load_and_health', 'sudden_and_hidden', 'loss_rest_and_distance'], defaultSections: S },
  { id: 'restores', group: 'mind', title: 'What restores you', description: 'What brings you peace and where to find it', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, briefOnly: true, matters: ['home_and_peace', 'loss_rest_and_distance', 'luck_and_belief'], defaultSections: S },
  { id: 'play', group: 'mind', title: 'Play & joy', description: 'What entertains you and when there is room for it', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, briefOnly: true, matters: ['ideas_and_children', 'gains_and_network', 'home_and_peace'], defaultSections: S },

  // Character
  { id: 'diagnosis', group: 'character', title: 'Your life right now', description: 'The one thing to know about you now', subtitle: 'The one thing to know about you now', v2Area: 'diagnosis', suggested: true, sensitive: false, needs: [], offered: true, matters: ['self_and_body', 'career_and_standing', 'work_load_and_health'], defaultSections: S },
  { id: 'lagna', group: 'character', title: 'Who you are', description: 'Your nature, the way you meet the world', subtitle: 'Your nature, the way you meet the world', v2Area: 'lagna', suggested: true, sensitive: false, needs: [], offered: true, matters: ['self_and_body', 'partnership', 'career_and_standing'], defaultSections: S },
  { id: 'drive', group: 'character', title: 'Drive & ambition', description: 'What pushes you, and what it is for', subtitle: 'What pushes you, and what it is for', v2Area: 'drive', suggested: true, sensitive: false, needs: [], offered: true, matters: ['career_and_standing', 'effort_and_courage', 'gains_and_network'], defaultSections: S },
  { id: 'presence', group: 'character', title: 'How you come across', description: 'How other people read you, which you cannot see yourself', subtitle: 'How other people read you', v2Area: 'presence', suggested: false, sensitive: false, needs: [], offered: true, matters: ['self_and_body', 'partnership', 'money_in_hand'], defaultSections: S },
  { id: 'yogas', group: 'character', title: 'Your strengths and sticking points', description: 'What you were given, and what tangles', subtitle: 'What comes easily to you, and where you get stuck', v2Area: 'yogas', suggested: false, sensitive: false, needs: [], offered: true, matters: ['luck_and_belief', 'career_and_standing', 'money_in_hand'], defaultSections: S },
  { id: 'purpose', group: 'character', title: 'Purpose & meaning', description: 'What this life is for, and what this year asks of it', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, briefOnly: true, matters: ['luck_and_belief', 'ideas_and_children', 'loss_rest_and_distance'], defaultSections: S },
  { id: 'learning', group: 'character', title: 'Learning & skill', description: 'What to learn this year, and when it sticks', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, briefOnly: true, matters: ['ideas_and_children', 'luck_and_belief', 'effort_and_courage'], defaultSections: S },

  // Indian lens
  { id: 'layers', group: 'indian', title: 'The five layers', description: 'Body, breath, mind, judgment, joy: which layer needs care now', v2Area: null, suggested: false, sensitive: false, needs: [], offered: false, briefOnly: true, matters: ['self_and_body', 'home_and_peace', 'luck_and_belief'], defaultSections: S },
  { id: 'aims', group: 'indian', title: 'The four aims', description: 'Duty, means, desire, release: which one this stretch serves', v2Area: null, suggested: false, sensitive: false, needs: ['engine:four_aims'], offered: false, matters: ['luck_and_belief', 'money_in_hand', 'partnership', 'loss_rest_and_distance'], defaultSections: S },
  { id: 'practice', group: 'indian', title: 'Practice & deity', description: 'The practice that suits you, and the deity of your chart', v2Area: null, suggested: false, sensitive: false, needs: ['engine:practice_deity'], offered: false, matters: ['luck_and_belief', 'loss_rest_and_distance'], defaultSections: S },
  { id: 'saturn', group: 'indian', title: "Saturn's long passage", description: 'Where you are in the seven and a half years, by date', v2Area: null, suggested: false, sensitive: false, needs: ['sade_sati'], offered: false, matters: ['self_and_body', 'home_and_peace', 'loss_rest_and_distance'], defaultSections: S },
  { id: 'helps', group: 'indian', title: 'What helps', description: 'Fasting days, giving, mantra: practices for what presses now', v2Area: null, suggested: false, sensitive: false, needs: ['engine:practices'], offered: false, matters: ['self_and_body', 'luck_and_belief'], defaultSections: S },

  // Time
  { id: 'chapter', group: 'time', title: 'This chapter', description: 'The stretch of life you are in, and when it turns', subtitle: 'The stretch of life you are in, and when it turns', foldedInto: 'chapters', v2Area: 'chapter', suggested: false, sensitive: false, needs: [], offered: true, matters: ['career_and_standing', 'self_and_body', 'home_and_peace'], defaultSections: S },
  { id: 'chapters', group: 'time', title: 'Your life phases: before, now, next', description: 'The long arc of your life, chapter by chapter', subtitle: 'Where you have been, where you are, what comes next', v2Area: 'chapters', suggested: true, sensitive: false, needs: [], offered: true, matters: ['career_and_standing', 'luck_and_belief', 'self_and_body'], defaultSections: S },
  { id: 'year', group: 'time', title: 'Your year', description: 'Your year from birthday to birthday', subtitle: 'What this year asks of you, birthday to birthday', v2Area: 'year', suggested: true, sensitive: false, needs: [], offered: true, matters: ['self_and_body', 'career_and_standing', 'gains_and_network'], defaultSections: S },
];

const BY_ID: ReadonlyMap<SelfCardId, SelfCardDef> = new Map(SELF_CARDS.map((c) => [c.id, c]));

export function cardDef(id: string): SelfCardDef | null {
  return BY_ID.get(id as SelfCardId) ?? null;
}

/** the eleven cards offered in every mode (the v2 areas) */
export const OFFERED_CARDS: readonly SelfCardDef[] = SELF_CARDS.filter((c) => c.offered);

/** offered now: the eleven, plus the Phase C cards while the per-card reading is on (doc 70 §7 step 6) */
export function isCardOffered(def: SelfCardDef, cardsRead: boolean = isCardsReadEnabled()): boolean {
  return def.offered || (Boolean(def.briefOnly) && cardsRead);
}

/** the cards a person can choose now, in registry order (11, or 21 with the per-card reading on) */
export function offeredCards(cardsRead: boolean = isCardsReadEnabled()): SelfCardDef[] {
  return SELF_CARDS.filter((c) => isCardOffered(c, cardsRead));
}

/** the 21 cards the per-card reading builds: every card that needs no engine export */
export const READABLE_CARDS: readonly SelfCardId[] = SELF_CARDS.filter((c) => c.offered || c.briefOnly).map((c) => c.id);

/** the cards the v2 build fills, in registry order */
export const V2_FILLED_CARDS: readonly SelfCardIdV2[] = SELF_CARDS.flatMap((c) => (c.offered && c.v2Area ? [c.v2Area] : []));

/** the registry's own suggested set, in registry order: at most SUGGESTED_COUNT */
export function defaultSuggested(): SelfCardId[] {
  return OFFERED_CARDS.filter((c) => c.suggested).map((c) => c.id);
}
