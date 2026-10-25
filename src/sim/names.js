// Procedural medieval names. nameFor(seed, index) depends only on its arguments,
// so subscriber #index always gets the same villager name.
import { hash } from './prng.js';
import { BAD_WORDS, BAD_ROOTS } from './badwords.js';

const MALE = [
  'Aldric', 'Bertram', 'Cedric', 'Dunstan', 'Edmund', 'Felix', 'Godfrey', 'Hamon', 'Ivo', 'Jocelin',
  'Lambert', 'Merek', 'Nigel', 'Osric', 'Piers', 'Ranulf', 'Simon', 'Tobias', 'Ulric', 'Walter',
  'Alaric', 'Baldwin', 'Conrad', 'Drogo', 'Everard', 'Fulk', 'Gervase', 'Hugh', 'Jasper', 'Leofric',
  'Martin', 'Norbert', 'Odo', 'Percival', 'Roger', 'Stephen', 'Thibault', 'Warin', 'Wymond', 'Ansel',
  'Benedict', 'Crispin', 'Eustace', 'Gilbert', 'Humphrey', 'Lionel', 'Matthias', 'Oswin', 'Reginald', 'Tristan',
];
const FEMALE = [
  'Adela', 'Beatrix', 'Cecily', 'Edith', 'Elena', 'Gisela', 'Hawise', 'Isolde', 'Joan', 'Juliana',
  'Mabel', 'Matilda', 'Nicola', 'Petronilla', 'Rohesia', 'Sabina', 'Agnes', 'Alice', 'Amice', 'Ava',
  'Emma', 'Ermengarde', 'Eleanor', 'Helewise', 'Ida', 'Margery', 'Maud', 'Millicent', 'Odelina', 'Rosamund',
  'Sybil', 'Thomasina', 'Wilmot', 'Yvette', 'Aveline', 'Christiana', 'Denise', 'Eda', 'Felicia', 'Godiva',
  'Ismay', 'Lettice', 'Melisende', 'Orabel', 'Philippa', 'Richenda', 'Scholastica', 'Tiphaine', 'Ursula', 'Wenna',
];
const BYNAMES = [
  'Ashford', 'Blackwood', 'Brookside', 'Coldwell', 'Crowmere', 'Dunmoor', 'Elmstead', 'Fairbrook', 'Foxley',
  'Greystone', 'Hawthorne', 'Highmoor', 'Ironhill', 'Kingsbridge', 'Larkfield', 'Marsh', 'Millbrook', 'Oakhurst',
  'Ravenscar', 'Redcliffe', 'Rivermouth', 'Rosedale', 'Stonebridge', 'Thornbury', 'Westmarch', 'Whitlow',
  'Willowmere', 'Wolfden', 'Yarrow', 'Amberley',
];
const EPITHETS = [
  'the Bold', 'the Kind', 'the Tall', 'the Quick', 'the Wise', 'the Young', 'the Red', 'the Patient',
  'the Merry', 'the Steadfast', 'the Quiet', 'the Lucky',
];

export function nameFor(seed, index) {
  const h = hash(seed, 'name', index);
  const female = (h & 1) === 1;
  const given = (female ? FEMALE : MALE)[(h >>> 1) % 50];
  const style = (h >>> 9) % 10;
  if (style < 7) return `${given} of ${BYNAMES[(h >>> 13) % BYNAMES.length]}`;
  return `${given} ${EPITHETS[(h >>> 13) % EPITHETS.length]}`;
}

// ------------------------------------------------------------------ names from YouTube comments
// Villagers have no name until a commenter gives them one (see simulate.js). Display names are
// cleaned for the video: no "@", only letters, digits and . _ - (emoji and symbols render badly),
// at most 22 characters. Offensive names are dropped (badwords.js); state/blocked.json can drop any by hand.
const WORDS = new Set(BAD_WORDS);
const PHRASES = BAD_WORDS.filter((w) => w.includes(' '));
const LINKS = ['http', 'www.', '.com', '.net', '.org', '.ly', '.gg', '.tv'];

export function cleanName(raw) {
  const s = String(raw || '')
    .normalize('NFKC')
    .replace(/^@+/, '')
    .replace(/-[a-z0-9]{3,5}$/, (m) => (/\d/.test(m) ? '' : m)) // YouTube's auto handle suffix (-l6p1m)
    .replace(/[^\p{L}\p{N} ._-]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/\p{L}|\p{N}/u.test(s)) return null;
  return s.length > 22 ? s.slice(0, 21).trimEnd() + '…' : s;
}

// accents off and lower case; "BigBoss" is read as "big boss" so a bad word cannot hide in camel case
const fold = (s) => String(s).normalize('NFKD').replace(/\p{M}/gu, '').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').toLowerCase()
  .replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/ø/g, 'o');
const leet = (s) => s.replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/[5$]/g, 's').replace(/7/g, 't');

export function isOffensive(name) {
  const plain = fold(name);
  // the link pieces ('.com', 'www.') only as written: squeezed, '.com' would match any name with 'com' in it
  if (LINKS.some((w) => plain.includes(w))) return true;
  for (const v of [plain, leet(plain)]) {
    const words = v.replace(/[^a-z0-9]+/g, ' ').trim();
    if (words.split(' ').some((w) => WORDS.has(w))) return true;
    if (PHRASES.some((p) => ` ${words} `.includes(` ${p} `))) return true;
    const squeezed = v.replace(/[^a-z]/g, '');
    if (BAD_ROOTS.some((r) => squeezed.includes(r))) return true;
  }
  return false;
}

// Names are untrusted input. A name is only ever drawn on screen and saved in state/ (never run, never given
// to a shell, a template or a language model), and cleanName keeps only letters, digits, space and . _ -.
// As a second line, a name that reads like markup, code or an instruction to an AI is not used at all.
const CODE_CHARS = /[`\\]|<[a-z/!?]|\$[({]|\{\{|\}\}|&#|%[0-9a-f]{2}/i;
const CODE_WORDS = new RegExp([
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|above|prior|earlier|all|instructions?|rules?|prompt)\b/,
  /\b(system|developer|hidden)\s*(prompt|message|instructions?)\b/, /\bprompts?\b/, /\binstructions?\b/, /\bjailbreak/,
  /\bassistant\b/, /\byou are now\b/, /\bact as\b/, /\bpretend\b/, /\bchatgpt\b|\bopenai\b|\banthropic\b|\bclaude\b/,
  /\bsudo\b/, /\brm\s+-/, /\bdrop\s+table\b/, /\bunion\s+select\b/, /\bselect\b.+\bfrom\b/, /\binsert\s+into\b/,
  /\bscript\b/, /\beval\b/, /javascript/, /\bon(error|load|click)\b/, /\balert\s*\(/, /__proto__/, /\bconstructor\b/,
  /\bprototype\b/, /\bprocess\.env\b/, /\brequire\s*\(/, /\bimport\s*\(/,
].map((r) => r.source).join('|'), 'i');

/** True when a raw or cleaned name looks like markup, code or a prompt injection: such a name is never used. */
export function looksLikeCode(raw) {
  const s = String(raw ?? '').normalize('NFKC');
  return CODE_CHARS.test(s) || CODE_WORDS.test(s);
}
