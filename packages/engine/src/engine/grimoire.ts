import {
  GameState,
  Grimoire,
  Player,
  PlayerId,
  CharacterId,
  Phase,
  WinningTeam,
  GameEvent,
} from "../types";

// ============================================================
// Grimoire factory
// ============================================================

export function createGrimoire(players: Player[]): Grimoire {
  return {
    players,
    impTarget: null,
    mayorRedirectTarget: null,
    fortuneTellerRedHerring: null,
    monkProtectionTarget: null,
    poisonerTarget: null,
    butlerMaster: null,
    demonBluffs: [],
    slayerUsed: false,
    virginAbilityFired: false,
    executedToday: null,
  };
}

// ============================================================
// GameState factory
// ============================================================

export function createGameState(players: Player[]): GameState {
  return {
    phase: "setup",
    day: 0,
    grimoire: createGrimoire(players),
    winner: null,
    log: [],
    voting: null,
    executionCandidateId: null,
    executionCandidateVotes: 0,
    nominatorsUsed: [],
    nominatedToday: [],
    pendingRavenkeeperChoice: false,
    pendingMinionPromotion: false,
    nightInfo: {},
  };
}

// ============================================================
// Player helpers
// ============================================================

export function getPlayer(grimoire: Grimoire, id: PlayerId): Player {
  const player = grimoire.players.find((p) => p.id === id);
  if (!player) throw new Error(`Player not found: ${id}`);
  return player;
}

export function getAlivePlayers(grimoire: Grimoire): Player[] {
  return grimoire.players.filter((p) => p.isAlive);
}

export function getDeadPlayers(grimoire: Grimoire): Player[] {
  return grimoire.players.filter((p) => !p.isAlive);
}

export function getPlayersByAlignment(
  grimoire: Grimoire,
  alignment: Player["alignment"],
): Player[] {
  return grimoire.players.filter((p) => p.alignment === alignment);
}

export function getPlayerByCharacter(
  grimoire: Grimoire,
  character: CharacterId,
): Player | undefined {
  return grimoire.players.find((p) => p.trueCharacter === character);
}

// ============================================================
// Night-state helpers
// ============================================================

/** Apply poison: mark the target and update grimoire */
export function applyPoison(grimoire: Grimoire, targetId: PlayerId): Grimoire {
  // Clear previous night's poison
  const players = grimoire.players.map((p) => ({ ...p, isPoisoned: false }));
  const updated = players.map((p) =>
    p.id === targetId ? { ...p, isPoisoned: true } : p,
  );
  return { ...grimoire, players: updated, poisonerTarget: targetId };
}

/** Apply monk protection for the night */
export function applyMonkProtection(
  grimoire: Grimoire,
  targetId: PlayerId,
): Grimoire {
  const players = grimoire.players.map((p) =>
    p.id === targetId
      ? { ...p, isProtected: true }
      : { ...p, isProtected: false },
  );
  return { ...grimoire, players, monkProtectionTarget: targetId };
}

/**
 * Clear transient night-state (Monk protection, Imp target, etc.) at dawn.
 * NOTE: isPoisoned is intentionally NOT cleared here — poison lasts "tonight
 * and tomorrow day" and is cleared at the START of the next night
 * (see handleAdvanceToNight in dispatch.ts).
 */
export function clearNightState(grimoire: Grimoire): Grimoire {
  const players = grimoire.players.map((p) => ({ ...p, isProtected: false }));
  return {
    ...grimoire,
    players,
    impTarget: null,
    mayorRedirectTarget: null,
    monkProtectionTarget: null,
    poisonerTarget: null,
    executedToday: null,
  };
}

// ============================================================
// Death helpers
// ============================================================

export function killPlayer(
  grimoire: Grimoire,
  targetId: PlayerId,
  log: GameEvent[],
  phase: Phase,
  day: number,
  reason: GameEvent["type"] = "player-died",
): { grimoire: Grimoire; log: GameEvent[] } {
  const players = grimoire.players.map((p) =>
    p.id === targetId ? { ...p, isAlive: false } : p,
  );
  const event: GameEvent = {
    type: reason,
    night: day,
    phase,
    payload: { targetId },
  };
  return { grimoire: { ...grimoire, players }, log: [...log, event] };
}

// ============================================================
// Win condition checks
// ============================================================

/**
 * Check the primary win conditions.
 *
 * - Good wins when no Demon is alive.
 * - Evil wins when only 2 (or fewer) players are alive — the good team can
 *   no longer execute effectively when only the Demon and one other player
 *   remain.
 *
 * NOTE: The Mayor 3-player win is a DAY-END condition checked exclusively
 * in handleSkipExecution — it is intentionally NOT checked here to avoid
 * triggering during night resolution.
 */
export function checkWinCondition(grimoire: Grimoire): WinningTeam {
  const alive = getAlivePlayers(grimoire);

  // Good wins if no Demon is alive
  const demonAlive = alive.some((p) => p.alignment === "Demon");
  if (!demonAlive) return "good";

  // Evil wins if only 2 or fewer players are alive
  if (alive.length <= 2) return "evil";

  return null;
}

// ============================================================
// Execution helpers
// ============================================================

/**
 * Execute a player. Handles:
 * - Saint: if Saint is executed (and not poisoned/drunk), evil wins immediately.
 * - Returns updated state including a winner flag if applicable.
 */
export function executePlayer(
  state: GameState,
  targetId: PlayerId,
): { state: GameState; winner: WinningTeam } {
  const target = getPlayer(state.grimoire, targetId);
  let winner: WinningTeam = null;

  // Saint check (must be the real Saint, not drunk/poisoned)
  if (
    target.trueCharacter === "saint" &&
    !target.isPoisoned &&
    !target.isDrunk
  ) {
    winner = "evil";
  }

  const { grimoire, log } = killPlayer(
    state.grimoire,
    targetId,
    state.log,
    state.phase,
    state.day,
    "player-executed",
  );

  const updatedGrimoire: Grimoire = {
    ...grimoire,
    executedToday: target.trueCharacter,
  };

  // If Saint wasn't triggered, check standard win conditions
  if (!winner) {
    winner = checkWinCondition(updatedGrimoire);
  }

  return {
    state: {
      ...state,
      grimoire: updatedGrimoire,
      log,
      winner: winner ?? state.winner,
    },
    winner,
  };
}

// ============================================================
// Night-info calculation helpers
// ============================================================

/**
 * Calculate the Chef number: how many adjacent pairs of evil players exist
 * in the seating circle (including the wrap-around pair).
 */
export function calcChefNumber(grimoire: Grimoire): number {
  const players = [...grimoire.players].sort(
    (a, b) => a.seatIndex - b.seatIndex,
  );
  const n = players.length;
  const isEvil = (p: Player) =>
    p.alignment === "Minion" || p.alignment === "Demon";
  let count = 0;
  for (let i = 0; i < n; i++) {
    const a = players[i];
    const b = players[(i + 1) % n];
    if (isEvil(a) && isEvil(b)) count++;
  }
  return count;
}

/**
 * Calculate the Empath number: how many of the Empath's two living neighbours
 * (left and right in seat order, skipping dead players) are evil.
 */
export function calcEmpathNumber(
  grimoire: Grimoire,
  playerId: PlayerId,
): number {
  const players = [...grimoire.players].sort(
    (a, b) => a.seatIndex - b.seatIndex,
  );
  const n = players.length;
  const idx = players.findIndex((p) => p.id === playerId);
  if (idx === -1) return 0;

  const findLivingNeighbor = (dir: 1 | -1): Player | undefined => {
    for (let i = 1; i < n; i++) {
      const neighbor = players[(idx + dir * i + n) % n];
      if (neighbor.isAlive) return neighbor;
    }
    return undefined;
  };

  const left = findLivingNeighbor(-1);
  const right = findLivingNeighbor(1);
  const isEvil = (p: Player) =>
    p.alignment === "Minion" || p.alignment === "Demon";
  return (left && isEvil(left) ? 1 : 0) + (right && isEvil(right) ? 1 : 0);
}

// ============================================================
// Fortune Teller result calculation
// ============================================================

/**
 * Calculate the Fortune Teller's nightly result.
 *
 * Returns true (nod) if either chosen target is the Demon or the permanent
 * red-herring player, false (shake) otherwise.
 *
 * Rules:
 * - Spy may register as a Townsfolk or Outsider (good) — so a Spy can produce
 *   a false negative. This is Storyteller-discretionary per-check. This helper
 *   returns the *true* result; the Storyteller may override for a Spy target.
 * - Recluse may register as evil/Demon — similarly Storyteller-discretionary.
 *   The helper returns the true result; the Storyteller may override.
 * - A poisoned or drunk Fortune Teller may receive false info — the Storyteller
 *   shows this player whatever info they choose. This helper returns the correct
 *   answer; callers must ignore it when the FT is poisoned/drunk.
 *
 * @param grimoire  Current grimoire (contains red herring assignment)
 * @param target1Id First player chosen by the Fortune Teller
 * @param target2Id Second player chosen by the Fortune Teller
 * @returns true = nod (at least one is Demon or red herring); false = shake head
 */
export function calcFortuneTellerResult(
  grimoire: Grimoire,
  target1Id: PlayerId,
  target2Id: PlayerId,
): boolean {
  const t1 = grimoire.players.find((p) => p.id === target1Id);
  const t2 = grimoire.players.find((p) => p.id === target2Id);

  const isDemon = (p: Player | undefined) => p?.alignment === "Demon";
  const isRedHerring = (p: Player | undefined) =>
    p !== undefined && p.id === grimoire.fortuneTellerRedHerring;

  return isDemon(t1) || isDemon(t2) || isRedHerring(t1) || isRedHerring(t2);
}

// ============================================================
// Scarlet Woman activation
// ============================================================

/**
 * When the Demon dies, check if the Scarlet Woman should take over.
 * Returns activated=false if Scarlet Woman is not eligible.
 * Returns activatedPlayerId when activation occurs (for log events at call sites).
 */
export function tryActivateScarletWoman(grimoire: Grimoire): {
  grimoire: Grimoire;
  activated: boolean;
  activatedPlayerId: PlayerId | null;
} {
  const alive = getAlivePlayers(grimoire);
  const sw = alive.find((p) => p.trueCharacter === "scarletwoman");

  if (!sw) return { grimoire, activated: false, activatedPlayerId: null };
  if (sw.isPoisoned || sw.isDrunk)
    return { grimoire, activated: false, activatedPlayerId: null };

  // Travellers don't count — in TB there are no Travellers, so alive.length is correct
  if (alive.length < 5)
    return { grimoire, activated: false, activatedPlayerId: null };

  // Promote Scarlet Woman to Imp
  const players = grimoire.players.map((p) =>
    p.id === sw.id
      ? {
          ...p,
          trueCharacter: "imp" as CharacterId,
          alignment: "Demon" as const,
        }
      : p,
  );

  return {
    grimoire: { ...grimoire, players },
    activated: true,
    activatedPlayerId: sw.id,
  };
}
