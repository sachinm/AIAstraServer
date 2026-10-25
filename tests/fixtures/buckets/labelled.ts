/**
 * Labelled question set for the bucket classifier (brief item 1: at least 150 questions, the golden 12 plus variants
 * and negation). English only for now. `sub` and `horizon` are checked only where given.
 */
import type { BucketId } from '../../../src/reading/buckets/taxonomy.js';

export interface Labelled {
  q: string;
  bucket: BucketId;
  sub?: string;
  /** closed horizon id, 'range' for an explicit date range, or 'none' when the question names no period */
  horizon?: 'now' | '3m' | '6m' | '1y' | '3y' | 'life' | 'range' | 'none';
}

export const LABELLED: Labelled[] = [
  // ---- golden 12 (evals/questions.ts) ----
  { q: 'When will I get a promotion or a better paying job in the next year?', bucket: 'career_job', sub: 'promotion' },
  { q: 'When am I going to buy a house?', bucket: 'property_vehicles', sub: 'buy_home', horizon: 'none' },
  { q: 'Will I win the lottery?', bucket: 'money_wealth', sub: 'windfall' },
  { q: 'When will my income improve?', bucket: 'money_wealth', sub: 'income_growth', horizon: 'none' },
  { q: 'Ketu is transiting over my natal Jupiter, what does that mean for me?', bucket: 'time_window_outlook' },
  { q: 'What do my nakshatras say about me?', bucket: 'spirituality_direction', sub: 'nakshatra_portrait' },
  { q: 'Should I change jobs this year?', bucket: 'career_job', sub: 'job_change', horizon: 'range' },
  { q: 'What does my D-10 say about my career?', bucket: 'career_job' },
  { q: 'When will I get married?', bucket: 'marriage', sub: 'marriage_timing', horizon: 'none' },
  { q: 'Is this month a good time to sign a property deal?', bucket: 'property_vehicles', horizon: 'now' },
  { q: 'What is Sade Sati?', bucket: 'explain_term' },
  { q: 'How will my work, money and marriage go over the next 3 years?', bucket: 'marriage', horizon: '3y' }, // multi-subject: alsoBuckets + low confidence (tested)

  // ---- career and job ----
  { q: 'Should I quit my job and look for another one?', bucket: 'career_job', sub: 'job_change' },
  { q: 'Will I get a new job in the next 6 months?', bucket: 'career_job', sub: 'job_change', horizon: '6m' },
  { q: 'When will I find a job?', bucket: 'career_job', sub: 'job_search', horizon: 'none' },
  { q: 'I lost my job, when will I get another one?', bucket: 'career_job' },
  { q: 'Will my interview next week go well?', bucket: 'career_job', sub: 'job_search', horizon: 'now' },
  { q: 'My boss keeps targeting me, when will this end?', bucket: 'career_job', sub: 'workplace_trouble' },
  { q: 'Why am I not getting a job even after so many interviews?', bucket: 'career_job' },
  { q: 'What kind of career suits me?', bucket: 'career_job', sub: 'career_direction' },
  { q: 'Is a government job in my destiny?', bucket: 'career_job' },
  { q: 'When will I get recognition at work?', bucket: 'career_job', sub: 'promotion' },
  { q: 'Will I get an appraisal hike this year?', bucket: 'career_job', sub: 'promotion', horizon: 'range' },
  { q: 'Is it a good time to resign?', bucket: 'career_job', sub: 'job_change' },
  { q: 'Will there be layoffs affecting me?', bucket: 'career_job', sub: 'workplace_trouble' },
  { q: 'Which profession is right for me?', bucket: 'career_job', sub: 'career_direction' },
  { q: 'My colleagues are causing problems, will it get better by March?', bucket: 'career_job', sub: 'workplace_trouble', horizon: 'range' },
  { q: 'Should I switch my career to IT?', bucket: 'career_job', sub: 'job_change' },
  { q: 'Will I get the job offer from this company?', bucket: 'career_job', sub: 'job_search' },
  { q: 'Not about my marriage, I want to know about my job in 2027', bucket: 'career_job', horizon: 'range' },
  { q: 'Will my career grow over the next 2 years?', bucket: 'career_job', horizon: '3y' },
  { q: 'When will my work life become stable?', bucket: 'career_job' },
  { q: 'Is my promotion in March going to happen?', bucket: 'career_job', sub: 'promotion' },

  // ---- money and wealth ----
  { q: 'Will I ever become rich?', bucket: 'money_wealth' },
  { q: 'When will I get out of debt?', bucket: 'money_wealth', sub: 'debt_loss' },
  { q: 'Is this a good year for savings?', bucket: 'money_wealth' },
  { q: 'Why am I always losing money?', bucket: 'money_wealth' },
  { q: 'Should I invest in stocks this year?', bucket: 'money_wealth', sub: 'windfall' },
  { q: 'Will crypto trading work for me?', bucket: 'money_wealth', sub: 'windfall' },
  { q: 'When will my financial situation improve?', bucket: 'money_wealth' },
  { q: 'Will I be able to repay my loans by December?', bucket: 'money_wealth', sub: 'debt_loss', horizon: 'range' },
  { q: 'How will my finances look in the next 3 months?', bucket: 'money_wealth', horizon: '3m' },
  { q: 'Is there any windfall coming my way?', bucket: 'money_wealth', sub: 'windfall' },
  { q: 'My expenses keep rising, when will it settle?', bucket: 'money_wealth', sub: 'debt_loss' },
  { q: 'Will my salary increase next year?', bucket: 'money_wealth', horizon: 'range' },
  { q: 'Is gambling lucky for me?', bucket: 'money_wealth', sub: 'windfall' },

  // ---- business ----
  { q: 'Is this a good time to start my own business?', bucket: 'business' },
  { q: 'Will my startup succeed?', bucket: 'business' },
  { q: 'When will my business grow?', bucket: 'business' },
  { q: 'Should I take a business partner?', bucket: 'business' },
  { q: 'Will my shop make profit this year?', bucket: 'business', horizon: 'range' },
  { q: 'Should I open a franchise next year?', bucket: 'business' },
  { q: 'Will my business make money in the next 6 months?', bucket: 'business', horizon: '6m' },

  // ---- love and relationships ----
  { q: 'When will I find love?', bucket: 'love_relationships' },
  { q: 'Will my girlfriend and I stay together?', bucket: 'love_relationships', sub: 'current_relationship' },
  { q: 'Why do my relationships keep ending?', bucket: 'love_relationships', sub: 'breakup_friction' },
  { q: 'Will I get back with my ex?', bucket: 'love_relationships', sub: 'breakup_friction' },
  { q: 'When will I meet someone special?', bucket: 'love_relationships', sub: 'new_relationship' },
  { q: 'Is my boyfriend serious about me?', bucket: 'love_relationships' },
  { q: 'How is my love life this year?', bucket: 'love_relationships', horizon: 'range' },
  { q: 'Will this relationship last?', bucket: 'love_relationships' },
  { q: 'I am single, when will that change?', bucket: 'love_relationships' },
  { q: 'Will we break up soon?', bucket: 'love_relationships', sub: 'breakup_friction', horizon: '3m' },

  // ---- marriage ----
  { q: 'When will I get married in the next 2 years?', bucket: 'marriage', horizon: '3y' },
  { q: 'Will I have a love marriage or arranged marriage?', bucket: 'marriage' },
  { q: 'Will my marriage improve?', bucket: 'marriage', sub: 'marriage_health' },
  { q: 'Is there a chance of divorce?', bucket: 'marriage', sub: 'marriage_health' },
  { q: 'Problems with my in-laws, when will they end?', bucket: 'marriage', sub: 'marriage_health' },
  { q: 'Why is my marriage getting delayed?', bucket: 'marriage' },
  { q: 'Will my husband and I stop fighting?', bucket: 'marriage' },
  { q: 'How will my married life be this year?', bucket: 'marriage', horizon: 'range' },
  { q: 'Is Saturn affecting my marriage right now?', bucket: 'marriage', horizon: 'now' },
  { q: 'Will I marry the person I love?', bucket: 'marriage' },
  { q: 'Wedding by end of the year possible?', bucket: 'marriage', horizon: 'range' },

  // ---- property and vehicles ----
  { q: 'Will I buy a flat in the next 3 years?', bucket: 'property_vehicles', horizon: '3y' },
  { q: 'Is next year good for buying land?', bucket: 'property_vehicles', horizon: 'range' },
  { q: 'When can I buy a car?', bucket: 'property_vehicles', sub: 'vehicle' },
  { q: 'Should I sell my property now?', bucket: 'property_vehicles', horizon: 'now' },
  { q: 'Will I get my own house?', bucket: 'property_vehicles' },
  { q: 'Is it a good time to take a mortgage?', bucket: 'property_vehicles' },
  { q: 'Will the plot deal go through by June 2027?', bucket: 'property_vehicles', horizon: 'range' },

  // ---- education ----
  { q: 'Will I clear my exam this year?', bucket: 'education', sub: 'exams', horizon: 'range' },
  { q: 'When is a good time for higher studies?', bucket: 'education', sub: 'higher_studies' },
  { q: 'Which field of study suits me?', bucket: 'education', sub: 'field_fit' },
  { q: 'Will I get admission to a good university?', bucket: 'education', sub: 'exams' },
  { q: 'Should I do an MBA?', bucket: 'education', sub: 'higher_studies' },
  { q: 'Will I pass NEET next year?', bucket: 'education', sub: 'exams', horizon: 'range' },
  { q: 'Will my son clear his exams?', bucket: 'education' },
  { q: 'Is a PhD right for me?', bucket: 'education', sub: 'higher_studies' },

  // ---- health windows ----
  { q: 'Which periods should I be careful about my health?', bucket: 'health_windows' },
  { q: 'When will my health improve?', bucket: 'health_windows', sub: 'recovery' },
  { q: 'Will my surgery go well?', bucket: 'health_windows', sub: 'recovery' },
  { q: 'Is this year good for recovery from illness?', bucket: 'health_windows', horizon: 'range' },
  { q: 'When will my mother recover from her illness?', bucket: 'health_windows' },
  { q: 'Will I be healthy in the next 6 months?', bucket: 'health_windows', horizon: '6m' },
  { q: 'When will I die?', bucket: 'health_windows' },
  { q: 'Do I have cancer?', bucket: 'health_windows' },

  // ---- family and children ----
  { q: 'When will we have a child?', bucket: 'family_children', sub: 'children' },
  { q: 'Will I conceive this year?', bucket: 'family_children', sub: 'children', horizon: 'range' },
  { q: 'How is my relationship with my father?', bucket: 'family_children', sub: 'parents_siblings' },
  { q: 'Will my daughter get married soon?', bucket: 'marriage' },
  { q: 'How will my kids do in the coming years?', bucket: 'family_children', horizon: '3y' },
  { q: 'Will my brother and I settle our differences?', bucket: 'family_children' },
  { q: 'Is there family peace ahead?', bucket: 'family_children' },
  { q: 'When will I become pregnant?', bucket: 'family_children', sub: 'children' },

  // ---- foreign and legal ----
  { q: 'When will I move abroad?', bucket: 'foreign_legal', sub: 'abroad' },
  { q: 'Will my visa come through?', bucket: 'foreign_legal', sub: 'abroad' },
  { q: 'How will my court case go?', bucket: 'foreign_legal', sub: 'legal' },
  { q: 'Will I settle in Canada?', bucket: 'foreign_legal', sub: 'abroad' },
  { q: 'Will I win the property dispute in court?', bucket: 'foreign_legal', sub: 'legal' },
  { q: 'Will I get a green card in the next 2 years?', bucket: 'foreign_legal', horizon: '3y' },
  { q: 'Is relocating to Dubai good for me?', bucket: 'foreign_legal' },
  { q: 'Will the government tax matter resolve?', bucket: 'foreign_legal', sub: 'legal' },

  // ---- spirituality and life direction ----
  { q: 'What is my life purpose?', bucket: 'spirituality_direction', sub: 'purpose' },
  { q: 'When will a spiritual phase begin?', bucket: 'spirituality_direction', sub: 'spiritual_phase' },
  { q: 'What does my chart say about my personality?', bucket: 'spirituality_direction' },
  { q: 'Am I meant to follow a spiritual path?', bucket: 'spirituality_direction' },
  { q: 'Tell me all the different ways my nakshatras shape me', bucket: 'spirituality_direction', sub: 'nakshatra_portrait' },
  { q: 'What is my dharma?', bucket: 'spirituality_direction' },
  { q: 'Will meditation help me this year?', bucket: 'spirituality_direction' },
  { q: 'What is my destiny in life?', bucket: 'spirituality_direction', horizon: 'life' },

  // ---- time-window outlook ----
  { q: 'How does this month look for me?', bucket: 'time_window_outlook', sub: 'month_ahead', horizon: 'now' },
  { q: 'What is the year ahead like?', bucket: 'time_window_outlook', sub: 'year_ahead' },
  { q: 'Why is everything so hard right now?', bucket: 'time_window_outlook', sub: 'current_difficulty', horizon: 'now' },
  { q: 'When will this bad phase end?', bucket: 'time_window_outlook', sub: 'current_difficulty' },
  { q: 'What does Saturn transit mean for me?', bucket: 'time_window_outlook', sub: 'transit_meaning' },
  { q: 'Am I in Sade Sati right now?', bucket: 'time_window_outlook', horizon: 'now' },
  { q: 'I am going through a rough patch, when will it get better?', bucket: 'time_window_outlook', sub: 'current_difficulty' },
  { q: 'How will next week be for me?', bucket: 'time_window_outlook', horizon: 'now' },
  { q: 'Rahu is on my moon, what happens?', bucket: 'time_window_outlook' },

  // ---- explain a term ----
  { q: 'What is a mahadasha?', bucket: 'explain_term' },
  { q: 'Explain navamsa', bucket: 'explain_term' },
  { q: 'What does manglik mean?', bucket: 'explain_term' },
  { q: 'Define ascendant', bucket: 'explain_term' },
  { q: 'What is Kaal Sarp dosha?', bucket: 'explain_term' },
  { q: 'What are nakshatras?', bucket: 'explain_term' },
  { q: 'What is the meaning of retrograde?', bucket: 'explain_term' },

  // ---- compatibility ----
  { q: 'Are my partner and I compatible?', bucket: 'compatibility' },
  { q: 'Kundli milan for my match', bucket: 'compatibility' },
  { q: 'How do my chart and my wife\'s chart fit?', bucket: 'compatibility' },
  { q: 'Is this girl a good match for me?', bucket: 'compatibility' },
  { q: 'Check compatibility between me and my fiance', bucket: 'compatibility' },

  // ---- unknown / coaching ----
  { q: 'Will it happen?', bucket: 'unknown' },
  { q: 'Yes or no?', bucket: 'unknown' },
  { q: 'Hello', bucket: 'unknown' },
  { q: 'Tell me something', bucket: 'unknown' },
  { q: 'asdf qwerty', bucket: 'unknown' },
// ---- more English variants and negation ----
  { q: 'Apart from money, how will my relationship go this year?', bucket: 'love_relationships', horizon: 'range' },
  { q: 'Not asking about my career, when will I get married?', bucket: 'marriage' },
  { q: 'Will I get a job in the next three months?', bucket: 'career_job', horizon: '3m' },
  { q: 'Can I expect a raise before June?', bucket: 'career_job', sub: 'promotion', horizon: 'range' },
  { q: 'Is my manager going to support my promotion?', bucket: 'career_job', sub: 'promotion' },
  { q: 'When will my debts be cleared?', bucket: 'money_wealth', sub: 'debt_loss' },
  { q: 'Will I earn more money in 2027?', bucket: 'money_wealth', horizon: 'range' },
  { q: 'Should I launch my startup next year or wait?', bucket: 'business' },
  { q: 'When will I buy a new house?', bucket: 'property_vehicles', sub: 'buy_home' },
  { q: 'Is it a good time to buy a vehicle?', bucket: 'property_vehicles', sub: 'vehicle' },
  { q: 'Will I get into a good college next year?', bucket: 'education' },
  { q: 'When will my father recover?', bucket: 'health_windows', sub: 'recovery' },
  { q: 'When will we have a baby?', bucket: 'family_children', sub: 'children' },
  { q: 'Will I go overseas for work in the coming years?', bucket: 'foreign_legal', horizon: '3y' },
  { q: 'What does Jupiter transit over my moon mean?', bucket: 'time_window_outlook', sub: 'transit_meaning' },
  { q: 'How will the next few months be overall?', bucket: 'time_window_outlook', horizon: '6m' },
  { q: 'What is an antardasha?', bucket: 'explain_term' },
  { q: 'Are our charts compatible for marriage?', bucket: 'compatibility' },
];
