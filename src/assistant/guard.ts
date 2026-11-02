/**
 * The public assistant's fixed answers, and the check on what the model says. Nothing about how charts are built is in
 * the assistant's prompt, so it has nothing to give away; these catch the question first, and the answer last.
 */

/** Sachin's wording (2026-11-02) for anything about how the product works inside. */
export const WOULD_NOT_KNOW =
  "I wouldn't know all that. I leave it to the ancient Vedic texts and the sages and oracles inside the site. They're busy helping real people with real readings in there.";

export const PRIVATE_REPLY = "I can't share anything private, about anyone. If you have an account, your own details are there once you sign in.";

export const UNSURE =
  'I can tell you what AI AdAstra can do, such as questions about career, study, relationships and timing, read from a birth chart. For anything about your own chart, sign up and let us look at it together.';

/** Asking how it works inside: method, sources, systems, data, software, or trying to get at its instructions. */
const INSIDE: RegExp[] = [
  /\b(system|initial|hidden|developer)\s+(prompt|message|instruction)s?\b/,
  /\b(your|the)\s+(prompt|instructions?|rules|configuration|guidelines)\b/,
  /\b(ignore|disregard|forget|override)\b.{0,30}\b(previous|above|prior|earlier|all|instructions?|rules)\b/,
  /\b(repeat|print|reveal|show|output|translate|summari[sz]e)\b.{0,30}\b(above|everything|prompt|instructions?|text before|what you were told)\b/,
  /\b(jailbreak|pretend you|act as|you are now|developer mode|dan mode|roleplay)\b/,
  /\b(ephemeris|ephemerides|swiss\s*eph|swe|jhora|pyjhora|radha|nasa|jpl|ayanamsa|ayanamsha|lahiri|raman|krishnamurti|kp system)\b/,
  /\b(vimshottari|vimsottari|yogini|ashtottari|chara dasha|kalachakra|narayana dasha|shadbala|ashtakavarga|bhava chalit|sarvashtakavarga)\b/,
  /\b(how|what|which|where|why)\b.{0,50}\b(calculat\w*|comput\w*|algorithm\w*|formula\w*|methodolog\w*|derive\w*)\b/,
  /\b(calculat\w*|comput\w*)\b.{0,40}\b(chart|kundli|planet|sky|position|dasha|house)\w*\b/,
  // "you" or "it", so a visitor's own "how do I get a reading?" still reaches the model
  /\b(how|where)\b.{0,15}\b(do|does|did|are|is)\s+(you|it|this|the app|the site|they)\b.{0,30}\b(build|built|make|made|generate|create|get|source|obtain)\w*\b/,
  /\b(which|what)\s+((kind|type|sort)s?\s+of\s+)?ai\b(?!\s+adastra)/,
  /\b(what|which|how many)\b.{0,30}\b(dasha|dashas|house system|divisional|varga|data ?points?|data ?sets?|records?|tables?|sources?|calculation)\b/,
  /\b(what|which|whose|are you|is it|built on|running on|powered by|based on)\b.{0,40}\b(model|llm|gpt|chatgpt|openai|gemini|google|claude|anthropic|llama|meta|nemotron|nvidia|bedrock|aws|amazon|cloud|server|database|api|software|code|stack|framework|library|engine)\b/,
  /\b(source ?code|tech ?stack|architecture|intellectual property|trade secret|back ?end|training data|trained)\b/,
];

/** Asking for someone's account, or for the keys to anything. */
const PRIVATE: RegExp[] = [
  /\b(other|another|all|list|your)\b.{0,20}\b(users?|customers?|members?|accounts?|subscribers?)\b/,
  /\b(who|which people)\b.{0,20}\b(signed up|registered|uses?|using|subscribed)\b/,
  /\b(email|phone|address|birth ?(date|time|details?|chart)|password|login|kundli)\b.{0,25}\b(of|for|belonging to)\b.{0,25}\b(user|customer|member|someone|somebody|anyone|mr|mrs|ms)\b/,
  /\b(passwords?|api ?keys?|secrets?|tokens?|credentials?|admin(istrator)?)\b/,
];

const normalize = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim();

export type FixedAnswer = { kind: 'inside' | 'private'; answer: string } | null;

/** A fixed answer for this question, or null when the model may try. Runs before any model call. */
export function fixedAnswer(question: string): FixedAnswer {
  const q = normalize(question);
  if (PRIVATE.some((r) => r.test(q))) return { kind: 'private', answer: PRIVATE_REPLY };
  if (INSIDE.some((r) => r.test(q))) return { kind: 'inside', answer: WOULD_NOT_KNOW };
  return null;
}

/** Words the assistant must never say, whatever it was asked. */
const NEVER_SAY =
  /\b(radha|jhora|pyjhora|swiss ?eph\w*|ephemer\w*|lahiri|ayanamsh?a|vimshottari|vimsottari|yogini|ashtottari|kalachakra|shadbala|ashtakavarga|nemotron|nvidia|bedrock|aws|amazon|gemini|openai|chatgpt|gpt|claude|anthropic|llama|cloudflare|prisma|postgres\w*|lambda|system prompt|my instructions|large language model|llm|as an ai)\b/i;

/** A model answer fit to show, or null when it must be replaced. */
export function cleanAnswer(answer: unknown): string | null {
  if (typeof answer !== 'string') return null;
  const a = answer.trim();
  if (a.length < 2 || a.length > 700) return null;
  if (NEVER_SAY.test(a)) return null;
  // no links, no addresses, and nothing a person could take for code
  if (/https?:\/\/|www\.|\S+@\S+\.\S+|```|\{|\}/.test(a)) return null;
  return a;
}
