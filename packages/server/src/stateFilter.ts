/**
 * State filtering — ensures each client only receives the information
 * they are authorised to see.
 *
 * Storyteller: full GameState (all character identities, night targets, etc.)
 * Player:      public GameState + their own private character info
 */

import { GameState, PlayerId, CharacterId, Alignment } from "@botc/engine";

// ============================================================
// Public player view (what other players see about you)
// ============================================================

export interface PublicPlayer {
  id: PlayerId;
  name: string;
  isAlive: boolean;
  ghostVoteUsed: boolean;
  seatIndex: number;
}

// ============================================================
// Filtered state types
// ============================================================

/** The grimoire view a regular player receives */
export interface PlayerGrimoire {
  /** Public info for every player at the table */
  players: PublicPlayer[];
  /** This player's own character (their true identity) */
  myTrueCharacter: CharacterId;
  /** The character this player *believes* they are (Drunk sees a fake token) */
  myPerceivedCharacter: CharacterId;
  myAlignment: Alignment;
  /** Whether this player is poisoned (they may not know, but we tell them) */
  myIsPoisoned: boolean;
  myIsDrunk: boolean;
  /** Demon bluffs — only non-null for the Imp player */
  myDemonBluffs: CharacterId[] | null;
  /** Public grimoire fields */
  slayerUsed: boolean;
  virginAbilityFired: boolean;
  executedToday: CharacterId | null;
}

/** The full state snapshot sent to the Storyteller */
export interface StorytelllerSnapshot {
  role: "storyteller";
  state: GameState;
}

/** The filtered state snapshot sent to a regular player */
export interface PlayerSnapshot {
  role: "player";
  phase: GameState["phase"];
  day: GameState["day"];
  winner: GameState["winner"];
  voting: GameState["voting"];
  executionCandidateId: GameState["executionCandidateId"];
  executionCandidateVotes: GameState["executionCandidateVotes"];
  nominatorsUsed: GameState["nominatorsUsed"];
  nominatedToday: GameState["nominatedToday"];
  pendingRavenkeeperChoice: boolean;
  pendingMinionPromotion: boolean;
  grimoire: PlayerGrimoire;
}

export type StateSnapshot = StorytelllerSnapshot | PlayerSnapshot;

// ============================================================
// Filter functions
// ============================================================

/** Full state for the Storyteller — no filtering needed */
export function filterForStoryteller(state: GameState): StorytelllerSnapshot {
  return { role: "storyteller", state };
}

/** Filtered state for a specific player */
export function filterForPlayer(
  state: GameState,
  playerId: PlayerId,
): PlayerSnapshot {
  const { grimoire } = state;

  const me = grimoire.players.find((p) => p.id === playerId);

  // Fallback if player isn't found (shouldn't happen in practice)
  const myTrueCharacter: CharacterId = me?.trueCharacter ?? "washerwoman";
  const myPerceivedCharacter: CharacterId =
    me?.perceivedCharacter ?? myTrueCharacter;
  const myAlignment: Alignment = me?.alignment ?? "Townsfolk";
  const myIsPoisoned = me?.isPoisoned ?? false;
  const myIsDrunk = me?.isDrunk ?? false;

  // Demon bluffs only visible to the Imp player
  const isImp = me?.trueCharacter === "imp";
  const myDemonBluffs = isImp ? grimoire.demonBluffs : null;

  const publicPlayers: PublicPlayer[] = grimoire.players.map((p) => ({
    id: p.id,
    name: p.name,
    isAlive: p.isAlive,
    ghostVoteUsed: p.ghostVoteUsed,
    seatIndex: p.seatIndex,
  }));

  return {
    role: "player",
    phase: state.phase,
    day: state.day,
    winner: state.winner,
    voting: state.voting,
    executionCandidateId: state.executionCandidateId,
    executionCandidateVotes: state.executionCandidateVotes,
    nominatorsUsed: state.nominatorsUsed,
    nominatedToday: state.nominatedToday,
    pendingRavenkeeperChoice: state.pendingRavenkeeperChoice,
    pendingMinionPromotion: state.pendingMinionPromotion,
    grimoire: {
      players: publicPlayers,
      myTrueCharacter,
      myPerceivedCharacter,
      myAlignment,
      myIsPoisoned,
      myIsDrunk,
      myDemonBluffs,
      slayerUsed: grimoire.slayerUsed,
      virginAbilityFired: grimoire.virginAbilityFired,
      executedToday: grimoire.executedToday,
    },
  };
}

/** Build the appropriate snapshot for a given client role */
export function buildSnapshot(
  state: GameState,
  role: "storyteller" | "player",
  playerId?: PlayerId,
): StateSnapshot {
  if (role === "storyteller") {
    return filterForStoryteller(state);
  }
  return filterForPlayer(state, playerId ?? "");
}

/** Type for client identity */
export interface ClientIdentity {
  role: "storyteller" | "player";
  playerId?: PlayerId;
}
