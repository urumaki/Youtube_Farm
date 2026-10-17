// Procedural medieval names. nameFor(seed, index) depends only on its arguments,
// so subscriber #index always gets the same villager name.
import { hash } from './prng.js';

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

export function genderFor(seed, index) {
  return (hash(seed, 'name', index) & 1) === 1 ? 'f' : 'm';
}

// ------------------------------------------------------------------ names from YouTube comments
// Villagers have no name until a commenter gives them one (see simulate.js). Display names are
// cleaned for the video: no "@", only letters, digits and . _ - (emoji and symbols render badly),
// at most 22 characters. Offensive names are dropped; state/blocked.json can drop any by hand.
const BAD = [
  // substrings, so avoid short ones that hide in ordinary names (skill, grape, Sussex, analyst, Dickens)
  'fuck', 'shit', 'cunt', 'bitch', 'nigg', 'faggot', 'retard', 'whore', 'slut', 'rapist', 'nazi', 'hitler', 'porn', 'sexy',
  'pussy', 'cock', 'penis', 'vagina', 'suicide', 'cazzo', 'merda', 'troia', 'puttana', 'stronz', 'vaffanc',
  'frocio', 'negro', 'figa', 'coglion', 'porco dio', 'porcodio', 'dioporco', 'onlyfans', 'free robux', 'http', 'www.', '.com',
];

export function cleanName(raw) {
  const s = String(raw || '')
    .normalize('NFKC')
    .replace(/^@+/, '')
    .replace(/[^\p{L}\p{N} ._-]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/\p{L}|\p{N}/u.test(s)) return null;
  return s.length > 22 ? s.slice(0, 21).trimEnd() + '…' : s;
}

export function isOffensive(name) {
  const flat = name.toLowerCase().replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/[5$]/g, 's');
  const squeezed = flat.replace(/[^a-z]/g, '');
  return BAD.some((w) => flat.includes(w) || (w.length > 3 && squeezed.includes(w.replace(/[^a-z]/g, ''))));
}
