// ============================================================
// Blood on the Clocktower — Core Type Definitions
// ============================================================

export type Alignment = "Townsfolk" | "Outsider" | "Minion" | "Demon";

export type AbilityTiming =
  | "first-night-only" // fires only on night 1
  | "each-night" // fires every night including night 1
  | "each-night-except-first" // fires every night except night 1
  | "day" // fires during the day phase
  | "passive" // always-on, no wake
  | "triggered" // fires when a condition is met
  | "once-per-game" // limited-use day ability
  | "setup-only"; // modifies setup, no in-game ability

export type CharacterId =
  // Townsfolk
  | "washerwoman"
  | "librarian"
  | "investigator"
  | "chef"
  | "empath"
  | "fortuneteller"
  | "undertaker"
  | "monk"
  | "ravenkeeper"
  | "virgin"
  | "slayer"
  | "soldier"
  | "mayor"
  // Outsiders
  | "butler"
  | "drunk"
  | "recluse"
  | "saint"
  // Minions
  | "poisoner"
  | "spy"
  | "scarletwoman"
  | "baron"
  // Demon
  | "imp";

export interface Character {
  id: CharacterId;
  name: string;
  alignment: Alignment;
  abilityText: string;
  timing: AbilityTiming;
  /** Position in first-night sequence; null if no first-night action */
  firstNightOrder: number | null;
  /** Position in each-night (except first) sequence; null if no action */
  eachNightOrder: number | null;
}

// ============================================================
// Player state
// ============================================================

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  /** True character as known to the Storyteller */
  trueCharacter: CharacterId;
  /**
   * Character the player believes they are.
   * Differs from trueCharacter only for the Drunk
   * (who holds a fake Townsfolk identity).
   */
  perceivedCharacter: CharacterId;
  alignment: Alignment;
  isAlive: boolean;
  /** Has used their single post-death vote token */
  ghostVoteUsed: boolean;
  isPoisoned: boolean;
  isDrunk: boolean;
  /** Protected by the Monk this night */
  isProtected: boolean;
  /** Seat position in the circle (0-indexed) */
  seatIndex: number;
}

// ============================================================
// Grimoire — Storyteller's authoritative game state
// ============================================================

export interface Grimoire {
  players: Player[];
  /** The Imp's kill target for tonight (set during night resolution) */
  impTarget: PlayerId | null;
  /**
   * Storyteller-set redirect target for Mayor's night-redirect ability.
   * When the Imp targets the Mayor, the Storyteller may redirect the kill
   * to this player instead. Cleared at dawn alongside impTarget.
   */
  mayorRedirectTarget: PlayerId | null;
  /** The Fortune Teller's permanent red-herring player */
  fortuneTellerRedHerring: PlayerId | null;
  /** The player the Monk chose to protect this night */
  monkProtectionTarget: PlayerId | null;
  /** The player the Poisoner chose to poison this night */
  poisonerTarget: PlayerId | null;
  /** The player the Butler chose as master this night */
  butlerMaster: PlayerId | null;
  /** Characters not in play — given to Imp as bluffs (7+ players) */
  demonBluffs: CharacterId[];
  /** Has the Slayer used their once-per-game ability */
  slayerUsed: boolean;
  /** Has the Virgin's ability already fired (first nomination consumed) */
  virginAbilityFired: boolean;
  /** The character executed today (set after each execution) */
  executedToday: CharacterId | null;
}

// ============================================================
// Game phase
// ============================================================

export type Phase = "setup" | "first-night" | "day" | "night" | "game-over";

export type WinningTeam = "good" | "evil" | null;

// ============================================================
// Day-phase voting state
// ============================================================

export interface VotingState {
  nominatorId: PlayerId;
  targetId: PlayerId;
  /** Ordered list of player IDs eligible to vote (circle order) */
  eligibleVoterIds: PlayerId[];
  /** Votes cast so far: true = execute, false = spare */
  votes: Partial<Record<PlayerId, boolean>>;
}

export interface GameState {
  phase: Phase;
  day: number; // 0 = first night, 1 = first day, etc.
  grimoire: Grimoire;
  winner: WinningTeam;
  /** Log of significant events for debugging/replay */
  log: GameEvent[];
  /** Active nomination being voted on (null when no vote in progress) */
  voting: VotingState | null;
  /** Player currently marked as execution candidate (highest votes today) */
  executionCandidateId: PlayerId | null;
  /** Vote count for the current execution candidate */
  executionCandidateVotes: number;
  /** Player IDs who have already nominated someone today (one nom per player per day) */
  nominatorsUsed: PlayerId[];
  /** Player IDs who have already been nominated today (can only be nominated once per day) */
  nominatedToday: PlayerId[];
  /**
   * Waiting for the Ravenkeeper (just killed this night) to choose a player.
   * Night resolution is paused; dispatch "ravenkeeper-choice" to continue.
   */
  pendingRavenkeeperChoice: boolean;
  /**
   * Waiting for the Storyteller to choose which living Minion becomes the Imp
   * after an Imp self-kill with no eligible Scarlet Woman.
   * Night resolution is paused; dispatch "storyteller-choose-minion" to continue.
   */
  pendingMinionPromotion: boolean;
}

// ============================================================
// Game events
// ============================================================

export type GameEventType =
  | "player-died"
  | "player-executed"
  | "player-protected"
  | "player-poisoned"
  | "demon-bluffs-assigned"
  | "scarlet-woman-activated"
  | "imp-self-killed"
  | "slayer-fired"
  | "virgin-triggered"
  | "mayor-redirect"
  | "game-ended";

export interface GameEvent {
  type: GameEventType;
  night: number;
  phase: Phase;
  payload: Record<string, unknown>;
}

// ============================================================
// Setup types
// ============================================================

export interface SetupCounts {
  townsfolk: number;
  outsiders: number;
  minions: number;
  demons: number;
}

export interface SetupConfig {
  playerCount: number;
  /** True if the Baron is part of the script */
  baronInPlay: boolean;
}
