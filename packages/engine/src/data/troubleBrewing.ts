import { Character, CharacterId } from "../types";

// ============================================================
// Trouble Brewing — Complete Character Registry (22 characters)
// ============================================================

export const TROUBLE_BREWING_CHARACTERS: Record<CharacterId, Character> = {
  // ----------------------------------------------------------
  // TOWNSFOLK (13)
  // ----------------------------------------------------------

  washerwoman: {
    id: "washerwoman",
    name: "Washerwoman",
    alignment: "Townsfolk",
    abilityText:
      "You start knowing that 1 of 2 players is a particular Townsfolk.",
    timing: "first-night-only",
    firstNightOrder: 5,
    eachNightOrder: null,
  },

  librarian: {
    id: "librarian",
    name: "Librarian",
    alignment: "Townsfolk",
    abilityText:
      "You start knowing that 1 of 2 players is a particular Outsider. (Or that zero are in play.)",
    timing: "first-night-only",
    firstNightOrder: 6,
    eachNightOrder: null,
  },

  investigator: {
    id: "investigator",
    name: "Investigator",
    alignment: "Townsfolk",
    abilityText:
      "You start knowing that 1 of 2 players is a particular Minion.",
    timing: "first-night-only",
    firstNightOrder: 7,
    eachNightOrder: null,
  },

  chef: {
    id: "chef",
    name: "Chef",
    alignment: "Townsfolk",
    abilityText: "You start knowing how many pairs of evil players there are.",
    timing: "first-night-only",
    firstNightOrder: 8,
    eachNightOrder: null,
  },

  empath: {
    id: "empath",
    name: "Empath",
    alignment: "Townsfolk",
    abilityText:
      "Each night, you learn how many of your 2 alive neighbours are evil.",
    timing: "each-night",
    firstNightOrder: 9,
    eachNightOrder: 6,
  },

  fortuneteller: {
    id: "fortuneteller",
    name: "Fortune Teller",
    alignment: "Townsfolk",
    abilityText:
      "Each night, choose 2 players: you learn if either is the Demon. There is 1 good player that registers falsely to you.",
    timing: "each-night",
    firstNightOrder: 10,
    eachNightOrder: 7,
  },

  undertaker: {
    id: "undertaker",
    name: "Undertaker",
    alignment: "Townsfolk",
    abilityText:
      "Each night*, you learn which character died by execution today.",
    timing: "each-night-except-first",
    firstNightOrder: null,
    eachNightOrder: 8,
  },

  monk: {
    id: "monk",
    name: "Monk",
    alignment: "Townsfolk",
    abilityText:
      "Each night*, choose a player (not yourself): they are safe from the Demon tonight.",
    timing: "each-night-except-first",
    firstNightOrder: null,
    eachNightOrder: 3,
  },

  ravenkeeper: {
    id: "ravenkeeper",
    name: "Ravenkeeper",
    alignment: "Townsfolk",
    abilityText:
      "If you die at night, you are woken to choose a player: you learn their character.",
    timing: "triggered",
    firstNightOrder: null,
    eachNightOrder: 5, // fires same night as death, after the Imp
  },

  virgin: {
    id: "virgin",
    name: "Virgin",
    alignment: "Townsfolk",
    abilityText:
      "The 1st time you are nominated, if the nominator is a Townsfolk, they are executed immediately.",
    timing: "triggered",
    firstNightOrder: null,
    eachNightOrder: null,
  },

  slayer: {
    id: "slayer",
    name: "Slayer",
    alignment: "Townsfolk",
    abilityText:
      "Once per game, during the day, publicly choose a player: if they are the Demon, they die.",
    timing: "once-per-game",
    firstNightOrder: null,
    eachNightOrder: null,
  },

  soldier: {
    id: "soldier",
    name: "Soldier",
    alignment: "Townsfolk",
    abilityText: "You are safe from the Demon.",
    timing: "passive",
    firstNightOrder: null,
    eachNightOrder: null,
  },

  mayor: {
    id: "mayor",
    name: "Mayor",
    alignment: "Townsfolk",
    abilityText:
      "If only 3 players live & no execution occurs, your team wins. If you die at night, another player might die instead.",
    timing: "passive",
    firstNightOrder: null,
    eachNightOrder: null,
  },

  // ----------------------------------------------------------
  // OUTSIDERS (4)
  // ----------------------------------------------------------

  butler: {
    id: "butler",
    name: "Butler",
    alignment: "Outsider",
    abilityText:
      "Each night, choose a player (not yourself): tomorrow, you may only vote if they are voting too.",
    timing: "each-night",
    firstNightOrder: 11,
    eachNightOrder: 9,
  },

  drunk: {
    id: "drunk",
    name: "Drunk",
    alignment: "Outsider",
    abilityText:
      "You do not know you are the Drunk. You think you are a Townsfolk character, but your ability malfunctions.",
    timing: "passive",
    firstNightOrder: null,
    eachNightOrder: null,
  },

  recluse: {
    id: "recluse",
    name: "Recluse",
    alignment: "Outsider",
    abilityText:
      "You might register as evil & as a Minion or Demon, even if dead.",
    timing: "passive",
    firstNightOrder: null,
    eachNightOrder: null,
  },

  saint: {
    id: "saint",
    name: "Saint",
    alignment: "Outsider",
    abilityText: "If you die by execution, your team loses.",
    timing: "triggered",
    firstNightOrder: null,
    eachNightOrder: null,
  },

  // ----------------------------------------------------------
  // MINIONS (4)
  // ----------------------------------------------------------

  poisoner: {
    id: "poisoner",
    name: "Poisoner",
    alignment: "Minion",
    abilityText:
      "Each night, choose a player: they are poisoned tonight and tomorrow day.",
    timing: "each-night",
    firstNightOrder: 3,
    eachNightOrder: 1,
  },

  spy: {
    id: "spy",
    name: "Spy",
    alignment: "Minion",
    abilityText:
      "Each night, you see the Grimoire. You might register as good & as a Townsfolk or Outsider, even if dead.",
    timing: "each-night",
    firstNightOrder: 4,
    eachNightOrder: 2,
  },

  scarletwoman: {
    id: "scarletwoman",
    name: "Scarlet Woman",
    alignment: "Minion",
    abilityText:
      "If there are 5 or more players alive & the Demon dies, you become the Demon. (Travellers don't count.)",
    timing: "triggered",
    firstNightOrder: null,
    eachNightOrder: null, // passive trigger; no wake
  },

  baron: {
    id: "baron",
    name: "Baron",
    alignment: "Minion",
    abilityText: "There are extra Outsiders in play. [+2 Outsiders]",
    timing: "setup-only",
    firstNightOrder: null,
    eachNightOrder: null,
  },

  // ----------------------------------------------------------
  // DEMON (1)
  // ----------------------------------------------------------

  imp: {
    id: "imp",
    name: "Imp",
    alignment: "Demon",
    abilityText:
      "Each night*, choose a player: they die. If you kill yourself this way, a Minion becomes the Imp.",
    timing: "each-night-except-first",
    firstNightOrder: null,
    eachNightOrder: 4,
  },
};

/** Ordered list of all Trouble Brewing character IDs */
export const TROUBLE_BREWING_CHARACTER_IDS = Object.keys(
  TROUBLE_BREWING_CHARACTERS,
) as CharacterId[];

/** Characters grouped by alignment */
export const TB_BY_ALIGNMENT = {
  townsfolk: TROUBLE_BREWING_CHARACTER_IDS.filter(
    (id) => TROUBLE_BREWING_CHARACTERS[id].alignment === "Townsfolk",
  ),
  outsiders: TROUBLE_BREWING_CHARACTER_IDS.filter(
    (id) => TROUBLE_BREWING_CHARACTERS[id].alignment === "Outsider",
  ),
  minions: TROUBLE_BREWING_CHARACTER_IDS.filter(
    (id) => TROUBLE_BREWING_CHARACTERS[id].alignment === "Minion",
  ),
  demons: TROUBLE_BREWING_CHARACTER_IDS.filter(
    (id) => TROUBLE_BREWING_CHARACTERS[id].alignment === "Demon",
  ),
};
