/**
 * The Work area as a house-layer config (docs/dashboards/14): the same eight layers of houseLayers.ts the Love board
 * reads, over the career houses. Config only, and only what career.ts already states: houses 10, 6, 1, 2, 11
 * (`CAREER_HOUSES`), the 10th lord and the AmK (`workKarakaVote`), the Sun (`careerSubareas`: promotion), D10 with D9
 * and D60 (docs/techniques/work), the rajya, karma, punya and yasas sahams (`workAnnualVote`), and the seven sub-areas
 * of `work.subarea_windows` with the drivers `careerSubareas` and `careerMap` name. The Work board itself still reads
 * career.ts (its timeline grid); this config lets the card pack carry the Work board's layer rows beside the stored
 * career map. Nothing here computes: houseLayers reads the digest's own labels.
 */
import type { AreaConfig } from './houseLayers.js';

export const WORK: AreaConfig = {
  area: 'career',
  // the career houses, and the houses the sub-area drivers lord (3, 7, 9, 12) so their sign periods are read
  houses: [10, 6, 1, 2, 11, 3, 7, 9, 12],
  primary: [10, 6, 1, 2, 11],
  karakas: ['L10', 'AmK', 'Su'],
  protectPoints: [],
  vargaChecks: [{ varga: 'D10', house: 10 }],
  vargas: ['D1', 'D10', 'D9', 'D60'],
  heavy: ['Sa', 'Ra', 'Ke'],
  yogaAfflictions: [],
  gandantaMoon: false,
  sadeSati: false,
  sahams: { support: ['rajya', 'karma', 'punya', 'yasas'], test: [] },
  // career.ts careerSubareas / careerMap: promotion (10th lord, Sun, 11th lord), job change (Rahu, 12th, 3rd, 9th
  // lords), abroad (Rahu, 12th, 9th lords), pay (the money houses 2 and 11 beside a career window), business (the 7th);
  // a testing window is job security
  subareas: [
    { id: 'get_job', title: 'Getting a job', planets: ['L10', 'L6', 'L1', 'L11'], houses: [10, 6], sides: ['support'] },
    { id: 'job_change', title: 'Changing jobs', planets: ['Ra', 'L12', 'L3', 'L9'], houses: [3, 9, 12], sides: ['support'] },
    { id: 'promotion', title: 'Promotion and recognition', planets: ['L10', 'Su', 'L11'], houses: [10, 11], sides: ['support'] },
    { id: 'job_security', title: 'Job security', planets: ['L10', 'L6', 'L1', 'Sa', 'Ra', 'Ke'], houses: [10, 6], sides: ['test'] },
    { id: 'abroad', title: 'Work abroad', planets: ['Ra', 'L12', 'L9'], houses: [12, 9], sides: ['support'] },
    { id: 'pay', title: 'Pay', planets: ['L2', 'L11'], houses: [2, 11], sides: ['support'] },
    { id: 'business', title: 'Business', planets: ['L7', 'L10', 'L11'], houses: [7, 10], sides: ['support'] },
  ],
  words: {
    themes: {
      h10: 'your work and standing',
      h6: 'daily work and its load',
      h1: 'your drive',
      h2: 'your earnings',
      h11: 'gains and your network',
      L10: 'your career',
      AmK: 'the work you are built for',
      Su: 'your authority',
    },
    back: { test: 'a demanding stretch at work began', support: 'a good stretch at work began' },
    year: {
      support: "This year's chart backs your work: take the opening.",
      test: "This year's chart asks for patience at work: hold steady.",
      mixed: "This year's chart is mixed for work: small steps work best.",
    },
    turn: { support: 'A new chapter for work opens', test: 'A new chapter that asks more of your work' },
    ahead: {
      support: { strong: 'A strong opening at work', moderate: 'A good stretch at work', weak: 'A small opening at work' },
      test: { strong: 'A demanding stretch at work', moderate: 'A tense stretch at work', weak: 'A little pressure at work' },
    },
  },
};
