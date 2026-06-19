// src/lib/sourcebook-openings/cos/tarokka-tables.ts
/**
 * Canonical Curse of Strahd Tarokka reading tables. Each artifact/ally/Strahd
 * slot draws one card; the card maps to a location (or ally / Strahd's mood).
 * VERIFY values against the CoS appendix before relying on them in play.
 */

export interface CardEntry {
  /** Display card name, e.g. "Tome — 5 of Glyphs". */
  card: string;
  /** Resolved location / ally / Strahd placement text. */
  resolution: string;
}

/** Shared pool of hiding locations used for the three artifacts. */
export const ARTIFACT_LOCATIONS: readonly CardEntry[] = [
  { card: 'Warrior — Ace of Swords', resolution: 'The Village of Barovia, among the dead in the church' },
  { card: 'Tinker — 2 of Coins', resolution: 'Vallaki, hidden in the Blue Water Inn' },
  { card: 'Hooded One — 3 of Stars', resolution: 'Krezk, within the Abbey of Saint Markovia' },
  { card: 'Mists — 4 of Glyphs', resolution: 'Old Bonegrinder, the windmill on the hill' },
  { card: 'Beast — 5 of Swords', resolution: 'Argynvostholt, the ruined manor of the silver dragon' },
  { card: 'Broken One — 6 of Coins', resolution: "Baba Lysaga's hut in the ruins of Berez" },
  { card: 'Seer — 7 of Stars', resolution: "Tser Pool, in Madam Eva's tent" },
  { card: 'Marionette — 8 of Glyphs', resolution: "Van Richten's Tower by Lake Baratok" },
  { card: 'Horseman — 9 of Swords', resolution: 'Yester Hill, beneath the gulthias tree' },
  { card: 'Innocent — 10 of Coins', resolution: 'The Wizard of Wines winery' },
  { card: 'Darklord — Master of Stars', resolution: 'Castle Ravenloft, in the treasury (K41)' },
  { card: 'Anarchist — Master of Glyphs', resolution: 'The Amber Temple, among the dark gifts' },
  { card: 'Donjon — Master of Coins', resolution: 'Castle Ravenloft, in the dungeon (K75)' },
  { card: 'Tempter — Master of Swords', resolution: "Tsolenka Pass, the Roc of Mount Ghakis's nest" },
];

/** Possible allies (card 4). */
export const ALLY_TABLE: readonly CardEntry[] = [
  { card: 'Soldier', resolution: "Ezmerelda d'Avenir, the monster hunter" },
  { card: 'Missionary', resolution: 'The Keepers of the Feather (the Martikov family)' },
  { card: 'Mercenary', resolution: 'Kasimir Velikov, the dusk elf' },
  { card: 'Myrmidon', resolution: 'Sir Godfrey Gwilym, the revenant of Argynvostholt' },
  { card: 'Philanthropist', resolution: 'The Abbot of the Abbey of Saint Markovia' },
  { card: 'Guildmember', resolution: 'Rictavio (Rudolph van Richten in disguise)' },
];

/** Strahd's location & mood for the final confrontation (card 5, High Deck). */
export const STRAHD_TABLE: readonly CardEntry[] = [
  { card: 'Ghost', resolution: 'In his tomb (K84), brooding over Sergei' },
  { card: 'Innocent', resolution: 'On the overlook (K6), gazing across the valley' },
  { card: 'Darklord', resolution: 'In the heart of the castle, on his throne (K25)' },
  { card: 'Seer', resolution: "In the audience hall, awaiting the party's arrival (K25)" },
  { card: 'Broken One', resolution: 'In the study (K37), among Sergei’s portrait' },
  { card: 'Tempter', resolution: 'In the dungeon (K75), where Cyrus Belview toils' },
];
