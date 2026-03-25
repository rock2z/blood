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

/**
 * One row of the Spy's Grimoire view — the true information the Spy sees
 * for each player each night.
 */
export interface SpyGrimoirePlayer {
  id: PlayerId;
  name: string;
  trueCharacter: CharacterId;
  alignment: Alignment;
  isAlive: boolean;
  isPoisoned: boolean;
  isDrunk: boolean;
  isProtected: boolean;
}

/** The grimoire view a regular player receives */
export interface PlayerGrimoire {
  /** Public info for every player at the table */
  players: PublicPlayer[];
  /** The character this player *believes* they are (Drunk sees a fake token) */
  myCharacter: CharacterId;
  /** Demon bluffs — only non-null for the Imp player */
  myDemonBluffs: CharacterId[] | null;
  /** Public grimoire fields */
  slayerUsed: boolean;
  virginAbilityFired: boolean;
  executedToday: CharacterId | null;
  /** Night information delivered by the Storyteller to this player tonight */
  myNightInfo: string | null;
  /**
   * Spy-only: full character/alignment data for every player, visible to
   * the Spy each night (first night and each subsequent night).
   * Null for all other players.
   */
  mySpyGrimoire: SpyGrimoirePlayer[] | null;
}

/** The full state snapshot sent to the Storyteller */
export interface StorytellerSnapshot {
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
  /** Only true for the Ravenkeeper player when they must submit their choice */
  pendingRavenkeeperChoice: boolean;
  /** True when night resolution is paused waiting for the Storyteller to choose a Minion */
  pendingMinionPromotion: boolean;
  /** True for the Imp player when it's a non-first night and they haven't submitted their kill choice yet */
  pendingImpChoice: boolean;
  /** True for the Monk player (each-night-except-first) when they haven't submitted their protection choice yet */
  pendingMonkChoice: boolean;
  /** True for the Poisoner player when they haven't submitted their poison choice yet */
  pendingPoisonerChoice: boolean;
  /** True for the Butler player when they haven't submitted their master choice yet */
  pendingButlerChoice: boolean;
  /** True for the Fortune Teller player when they haven't submitted their two targets yet */
  pendingFortuneTellerChoice: boolean;
  grimoire: PlayerGrimoire;
  /** Announcements from the previous night shown to all players at the start of each day */
  dayAnnouncements: GameState["dayAnnouncements"];
}

export type StateSnapshot = StorytellerSnapshot | PlayerSnapshot;

// ============================================================
// Filter functions
// ============================================================

/** Full state for the Storyteller — no filtering needed */
export function filterForStoryteller(state: GameState): StorytellerSnapshot {
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
  const myCharacter: CharacterId = me?.perceivedCharacter ?? myTrueCharacter;

  // Night info delivered by the Storyteller to this specific player
  const myNightInfo = state.nightInfo[playerId] ?? null;

  const isNight = state.phase === "first-night" || state.phase === "night";
  const isEachNight = state.phase === "night";

  // Demon bluffs only visible to the Imp player
  const isImp = me?.trueCharacter === "imp";
  const myDemonBluffs = isImp ? grimoire.demonBluffs : null;

  // Spy Grimoire: the Spy sees true character, alignment, and status tokens
  // for every player during each night phase (first night and each-night).
  const isSpy = me?.trueCharacter === "spy";
  const mySpyGrimoire: SpyGrimoirePlayer[] | null =
    isSpy && isNight
      ? grimoire.players.map((p) => ({
          id: p.id,
          name: p.name,
          trueCharacter: p.trueCharacter,
          alignment: p.alignment,
          isAlive: p.isAlive,
          isPoisoned: p.isPoisoned,
          isDrunk: p.isDrunk,
          isProtected: p.isProtected,
        }))
      : null;

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
    // Only expose to the Ravenkeeper themselves — other players must not know
    // whether the Ravenkeeper was killed this night before it is announced.
    pendingRavenkeeperChoice:
      state.pendingRavenkeeperChoice && me?.trueCharacter === "ravenkeeper",
    // All players can see that the game is paused for Storyteller minion choice.
    pendingMinionPromotion: state.pendingMinionPromotion,
    // Only expose to the Imp player — they need to submit their kill target.
    pendingImpChoice:
      state.phase === "night" &&
      state.grimoire.impTarget === null &&
      me?.trueCharacter === "imp" &&
      (me?.isAlive ?? false),
    // Monk acts each-night-except-first: prompt when no protection target set yet.
    pendingMonkChoice:
      isEachNight &&
      state.grimoire.monkProtectionTarget === null &&
      me?.trueCharacter === "monk" &&
      (me?.isAlive ?? false),
    // Poisoner acts each-night (including first): prompt when no target set yet.
    pendingPoisonerChoice:
      isNight &&
      state.grimoire.poisonerTarget === null &&
      me?.trueCharacter === "poisoner" &&
      (me?.isAlive ?? false),
    // Butler acts each-night (including first): prompt when no master set yet.
    pendingButlerChoice:
      isNight &&
      state.grimoire.butlerMaster === null &&
      me?.trueCharacter === "butler" &&
      (me?.isAlive ?? false),
    // Fortune Teller acts each-night (including first): prompt when targets not yet submitted.
    pendingFortuneTellerChoice:
      isNight &&
      state.grimoire.fortuneTellerTargets === null &&
      me?.trueCharacter === "fortuneteller" &&
      (me?.isAlive ?? false),
    dayAnnouncements: state.dayAnnouncements,
    grimoire: {
      players: publicPlayers,
      myCharacter,
      myDemonBluffs,
      slayerUsed: grimoire.slayerUsed,
      virginAbilityFired: grimoire.virginAbilityFired,
      executedToday: grimoire.executedToday,
      myNightInfo,
      mySpyGrimoire,
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
