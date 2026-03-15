import { SetupCounts, SetupConfig, CharacterId } from "../types";
import {
  TB_BY_ALIGNMENT,
  TROUBLE_BREWING_CHARACTERS,
} from "../data/troubleBrewing";

// ============================================================
// Player count distribution (Trouble Brewing, 5–15 players)
// Always exactly 1 Demon. Townsfolk count is always odd.
// ============================================================

const BASE_DISTRIBUTION: Record<number, SetupCounts> = {
  5: { townsfolk: 3, outsiders: 0, minions: 1, demons: 1 },
  6: { townsfolk: 3, outsiders: 1, minions: 1, demons: 1 },
  7: { townsfolk: 5, outsiders: 0, minions: 1, demons: 1 },
  8: { townsfolk: 5, outsiders: 1, minions: 1, demons: 1 },
  9: { townsfolk: 5, outsiders: 2, minions: 1, demons: 1 },
  10: { townsfolk: 7, outsiders: 0, minions: 2, demons: 1 },
  11: { townsfolk: 7, outsiders: 1, minions: 2, demons: 1 },
  12: { townsfolk: 7, outsiders: 2, minions: 2, demons: 1 },
  13: { townsfolk: 9, outsiders: 0, minions: 3, demons: 1 },
  14: { townsfolk: 9, outsiders: 1, minions: 3, demons: 1 },
  15: { townsfolk: 9, outsiders: 2, minions: 3, demons: 1 },
};

/**
 * Returns the character-type counts for a game of the given configuration.
 * When the Baron is in play, 2 Townsfolk slots become 2 Outsider slots.
 */
export function getSetupCounts(config: SetupConfig): SetupCounts {
  const { playerCount, baronInPlay } = config;

  if (playerCount < 5 || playerCount > 15) {
    throw new Error(
      `Trouble Brewing supports 5–15 players. Got: ${playerCount}`,
    );
  }

  const base = BASE_DISTRIBUTION[playerCount];
  if (!base) {
    throw new Error(`No distribution defined for ${playerCount} players`);
  }

  if (!baronInPlay) return { ...base };

  return {
    townsfolk: base.townsfolk - 2,
    outsiders: base.outsiders + 2,
    minions: base.minions,
    demons: base.demons,
  };
}

// ============================================================
// Token bag construction
// ============================================================

/**
 * Builds the pool of character tokens to be put in the setup bag.
 * The caller may pass preferred character IDs; the rest are filled
 * randomly from the appropriate alignment pools.
 *
 * Rules:
 *  - Exactly 1 Demon token (always Imp in Trouble Brewing).
 *  - Minion tokens match the minion count; Baron counts as a Minion slot.
 *  - Outsider / Townsfolk fill the remaining slots.
 *  - The Drunk token is NEVER drawn from this function — the Drunk is
 *    included automatically in the Outsider pool but the player who draws
 *    it receives a fake Townsfolk token instead.
 */
export function buildTokenBag(
  config: SetupConfig,
  seed?: number,
): CharacterId[] {
  const counts = getSetupCounts(config);

  const townsfolkPool = [...TB_BY_ALIGNMENT.townsfolk];
  const outsiderPool = [...TB_BY_ALIGNMENT.outsiders];
  const minionPool = config.baronInPlay
    ? TB_BY_ALIGNMENT.minions // Baron is already in the minion pool
    : TB_BY_ALIGNMENT.minions.filter((id) => id !== "baron");
  const demonPool: CharacterId[] = ["imp"];

  // Simple deterministic shuffle using a seed, or random if no seed.
  const rng = seed !== undefined ? seededRng(seed) : Math.random;

  const pick = <T>(arr: T[], n: number): T[] => {
    const shuffled = [...arr].sort(() => rng() - 0.5);
    return shuffled.slice(0, n);
  };

  const minions = config.baronInPlay
    ? [
        "baron" as CharacterId,
        ...pick(
          minionPool.filter((id) => id !== "baron"),
          counts.minions - 1,
        ),
      ]
    : pick(minionPool, counts.minions);

  return [
    ...pick(townsfolkPool, counts.townsfolk),
    ...pick(outsiderPool, counts.outsiders),
    ...minions,
    ...demonPool,
  ];
}

// ============================================================
// First-night info: demon bluffs
// ============================================================

/**
 * Returns 3 good (Townsfolk or Outsider) character IDs that are NOT in play,
 * for the Imp to use as bluffs. Only applies in games with 7+ players.
 */
export function selectDemonBluffs(
  inPlayIds: CharacterId[],
  seed?: number,
): CharacterId[] {
  const goodIds: CharacterId[] = [
    ...TB_BY_ALIGNMENT.townsfolk,
    ...TB_BY_ALIGNMENT.outsiders,
  ];
  const notInPlay = goodIds.filter((id) => !inPlayIds.includes(id));

  const rng = seed !== undefined ? seededRng(seed) : Math.random;
  const shuffled = [...notInPlay].sort(() => rng() - 0.5);
  return shuffled.slice(0, 3);
}

// ============================================================
// Grimoire initialisation helpers
// ============================================================

/**
 * Among the in-play good characters, picks one to be the Fortune Teller's
 * permanent red herring. The Fortune Teller themselves may be chosen.
 */
export function selectFortuneTellerRedHerring(
  players: Array<{
    id: string;
    trueCharacter: CharacterId;
    alignment: "Townsfolk" | "Outsider" | "Minion" | "Demon";
  }>,
  seed?: number,
): string | null {
  const goodPlayers = players.filter(
    (p) => p.alignment === "Townsfolk" || p.alignment === "Outsider",
  );
  if (goodPlayers.length === 0) return null;

  const rng = seed !== undefined ? seededRng(seed) : Math.random;
  const shuffled = [...goodPlayers].sort(() => rng() - 0.5);
  return shuffled[0].id;
}

// ============================================================
// Utilities
// ============================================================

/** Minimal seeded PRNG (mulberry32) */
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns true when the Drunk character is in the token bag.
 * The Drunk must be given a fake Townsfolk token distinct from the
 * real Townsfolk tokens in the bag.
 */
export function findDrunkFakeCharacter(
  bag: CharacterId[],
  allTownsfolk: CharacterId[],
): CharacterId | null {
  if (!bag.includes("drunk")) return null;

  // Pick a Townsfolk character NOT already in the bag as a fake identity
  const usedTownsfolk = bag.filter(
    (id) => TROUBLE_BREWING_CHARACTERS[id]?.alignment === "Townsfolk",
  );
  const available = allTownsfolk.filter((id) => !usedTownsfolk.includes(id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}
