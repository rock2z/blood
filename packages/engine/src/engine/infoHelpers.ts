/**
 * Info-computation helpers for the Storyteller.
 *
 * These pure functions compute the "correct" information a Storyteller should
 * give to each information-receiving character at night.  They do NOT mutate
 * state — they only read the current Grimoire and return a value.
 *
 * Important caveats:
 *
 * - **Poison / Drunk**: When the target character is poisoned or drunk their
 *   ability "might not work right". The helper returns the TRUE result. The
 *   Storyteller may (but is not required to) give a false answer instead. It
 *   is always the Storyteller's discretion how wrong to be; these helpers give
 *   the factually correct answer as a baseline.
 *
 * - **Spy**: May register as a Townsfolk or Outsider for any per-ability check
 *   at Storyteller discretion. The helpers do NOT automatically treat the Spy
 *   as good — they return the true answer. If the Storyteller wants Spy to
 *   register as a different alignment for a specific check, they should adjust
 *   the value before delivering it.
 *
 * - **Recluse**: May register as a Minion or Demon for any per-ability check
 *   at Storyteller discretion. Same applies as for Spy.
 */

import { CharacterId, Grimoire, PlayerId } from "../types";
import { getAlivePlayers, getPlayer } from "./grimoire";

// ============================================================
// Empath — "You start knowing how many of your 2 alive
// neighbours are evil."
// ============================================================

/**
 * Returns 0, 1, or 2: the number of the Empath's two closest living
 * neighbours (clockwise and counter-clockwise) who are evil-aligned.
 *
 * The Empath's own alignment does not matter. Only living neighbours count.
 * If the Empath has fewer than 2 living neighbours, only the existing ones
 * are counted.
 */
export function computeEmpathInfo(
  grimoire: Grimoire,
  empathId: PlayerId,
): number {
  const alive = getAlivePlayers(grimoire);
  const empathIndex = alive.findIndex((p) => p.id === empathId);
  if (empathIndex === -1) return 0;

  const n = alive.length;
  if (n < 2) return 0;

  const leftNeighbour = alive[(empathIndex - 1 + n) % n];
  const rightNeighbour = alive[(empathIndex + 1) % n];

  let count = 0;
  if (
    leftNeighbour.alignment === "Minion" ||
    leftNeighbour.alignment === "Demon"
  )
    count++;
  if (
    rightNeighbour.alignment === "Minion" ||
    rightNeighbour.alignment === "Demon"
  )
    count++;
  return count;
}

// ============================================================
// Chef — "You start knowing how many pairs of evil players
// there are."
// ============================================================

/**
 * Returns the number of adjacent evil pairs sitting next to each other
 * in the circle of ALL players (alive + dead, in seat order).
 *
 * "Pair" means two evil players in consecutive seats. The same player can
 * be part of multiple pairs (e.g. three evil players in a row = 2 pairs).
 * The circle wraps — seat 0 is adjacent to the last seat.
 */
export function computeChefInfo(grimoire: Grimoire): number {
  const seated = [...grimoire.players].sort(
    (a, b) => a.seatIndex - b.seatIndex,
  );
  const n = seated.length;
  let pairs = 0;
  for (let i = 0; i < n; i++) {
    const current = seated[i];
    const next = seated[(i + 1) % n];
    const currentEvil =
      current.alignment === "Minion" || current.alignment === "Demon";
    const nextEvil = next.alignment === "Minion" || next.alignment === "Demon";
    if (currentEvil && nextEvil) pairs++;
  }
  return pairs;
}

// ============================================================
// Fortune Teller — "Each night, choose 2 players: you learn
// if either is the Demon. There is a good player that
// registers as the Demon to you."
// ============================================================

/**
 * Returns true if either `target1` or `target2` is the Demon (true Demon
 * alignment) OR is the Fortune Teller's permanent Red Herring player.
 *
 * The FT always gets YES for their Red Herring regardless of its alignment.
 * Does not account for Recluse registration (Storyteller discretion).
 */
export function computeFortuneTellerResult(
  grimoire: Grimoire,
  target1Id: PlayerId,
  target2Id: PlayerId,
): boolean {
  const t1 = getPlayer(grimoire, target1Id);
  const t2 = getPlayer(grimoire, target2Id);
  const redHerring = grimoire.fortuneTellerRedHerring;

  const isDemon = (p: typeof t1) => p.alignment === "Demon";
  const isRedHerring = (id: PlayerId) => id === redHerring;

  return (
    isDemon(t1) ||
    isDemon(t2) ||
    isRedHerring(target1Id) ||
    isRedHerring(target2Id)
  );
}

// ============================================================
// Undertaker — "Each night*, you learn which character died
// by execution today."
// ============================================================

/**
 * Returns the CharacterId of the player executed today, or null if no one
 * was executed (or if `executedToday` has been cleared at dawn).
 *
 * The Undertaker fires on the night AFTER an execution.  In the engine,
 * `grimoire.executedToday` is set during `handleExecute` and cleared by
 * `clearNightState` at dawn of the following night.  Call this helper
 * before `resolve-night` clears it.
 */
export function computeUndertakerInfo(grimoire: Grimoire): CharacterId | null {
  return grimoire.executedToday;
}

// ============================================================
// Washerwoman — "You start knowing that 1 of 2 players is
// a particular Townsfolk."
// ============================================================

/**
 * Returns the ID of the player who is actually the given Townsfolk character
 * among `candidate1` and `candidate2`, or null if neither is that character.
 *
 * The Storyteller shows both candidates and the Townsfolk token; only one of
 * them is truly that Townsfolk (or either could be if Spy registers as one).
 * This helper returns the true result.
 */
export function computeWasherwomanInfo(
  grimoire: Grimoire,
  candidate1Id: PlayerId,
  candidate2Id: PlayerId,
  townsfolkCharacter: CharacterId,
): PlayerId | null {
  const c1 = getPlayer(grimoire, candidate1Id);
  const c2 = getPlayer(grimoire, candidate2Id);
  if (c1.trueCharacter === townsfolkCharacter) return candidate1Id;
  if (c2.trueCharacter === townsfolkCharacter) return candidate2Id;
  return null;
}

// ============================================================
// Librarian — "You start knowing that 1 of 2 players is
// a particular Outsider."
// ============================================================

/**
 * Returns the ID of the player who is actually the given Outsider character
 * among `candidate1` and `candidate2`, or null if neither is that character.
 */
export function computeLibrarianInfo(
  grimoire: Grimoire,
  candidate1Id: PlayerId,
  candidate2Id: PlayerId,
  outsiderCharacter: CharacterId,
): PlayerId | null {
  const c1 = getPlayer(grimoire, candidate1Id);
  const c2 = getPlayer(grimoire, candidate2Id);
  if (c1.trueCharacter === outsiderCharacter) return candidate1Id;
  if (c2.trueCharacter === outsiderCharacter) return candidate2Id;
  return null;
}

// ============================================================
// Investigator — "You start knowing that 1 of 2 players is
// a particular Minion."
// ============================================================

/**
 * Returns the ID of the player who is actually the given Minion character
 * among `candidate1` and `candidate2`, or null if neither is that character.
 */
export function computeInvestigatorInfo(
  grimoire: Grimoire,
  candidate1Id: PlayerId,
  candidate2Id: PlayerId,
  minionCharacter: CharacterId,
): PlayerId | null {
  const c1 = getPlayer(grimoire, candidate1Id);
  const c2 = getPlayer(grimoire, candidate2Id);
  if (c1.trueCharacter === minionCharacter) return candidate1Id;
  if (c2.trueCharacter === minionCharacter) return candidate2Id;
  return null;
}
