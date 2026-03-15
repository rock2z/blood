// ============================================================
// Blood on the Clocktower — Action Types
// All actions players or the Storyteller can dispatch to the engine.
// Players make decisions via UI choices — never by typing free text.
// ============================================================

import { PlayerId } from "../types";

// ============================================================
// Phase-transition actions (Storyteller only)
// ============================================================

/** Advance from setup → first-night */
export interface StartGameAction {
  type: "start-game";
}

/**
 * Storyteller resolves the night: apply Imp kill, clear night state,
 * transition to day phase.
 */
export interface ResolveNightAction {
  type: "resolve-night";
}

/** Storyteller advances from day → night */
export interface AdvanceToNightAction {
  type: "advance-to-night";
}

// ============================================================
// Night actions (players submit target choices; Storyteller confirms)
// ============================================================

/**
 * A player submits their night-choice targets.
 * The engine dispatches the appropriate night effect based on the
 * player's true character (monk → protection, poisoner → poison, etc.).
 * Players pick from a list — no text input.
 */
export interface NightChoiceAction {
  type: "night-choice";
  playerId: PlayerId;
  /** Selected target player IDs (usually 1; Fortune Teller picks 2) */
  targetIds: PlayerId[];
}

// ============================================================
// Day-phase actions (players)
// ============================================================

/**
 * A player nominates another player for execution.
 * Each alive player may nominate once per day.
 * Each player may only be nominated once per day.
 * Players pick from a list of eligible targets — no text input.
 */
export interface NominateAction {
  type: "nominate";
  nominatorId: PlayerId;
  targetId: PlayerId;
}

/**
 * A player casts their vote on the current nomination.
 * true  = raise hand (execute)
 * false = keep hand down (spare)
 * Voting goes clockwise from the player left of the nominated;
 * nominated player votes last.
 * Players click a button — no text input.
 */
export interface VoteAction {
  type: "vote";
  playerId: PlayerId;
  vote: boolean;
}

// ============================================================
// Execution actions (Storyteller)
// ============================================================

/**
 * Storyteller confirms execution of the day's candidate.
 * Checks Saint, win conditions, and Scarlet Woman activation.
 */
export interface ExecuteAction {
  type: "execute";
  targetId: PlayerId;
}

/**
 * Storyteller ends the day with no execution.
 * Checks Mayor 3-player win condition.
 */
export interface SkipExecutionAction {
  type: "skip-execution";
}

// ============================================================
// Once-per-game player abilities (day)
// ============================================================

/**
 * Slayer uses their once-per-game ability: points at a player claiming
 * they are the Demon. If the target is the Imp → target dies, good wins.
 * Otherwise nothing happens and the ability is spent.
 * Player picks from a list — no text input.
 */
export interface SlayerShootAction {
  type: "slayer-shoot";
  slayerId: PlayerId;
  targetId: PlayerId;
}

// ============================================================
// Storyteller discretionary night actions
// ============================================================

/**
 * Storyteller sets a redirect target for the Mayor's night ability.
 * Must be dispatched BEFORE "resolve-night" when the Imp's target is the Mayor.
 * targetId = null means no redirect (Mayor dies normally).
 */
export interface StorytellerMayorRedirectAction {
  type: "storyteller-mayor-redirect";
  targetId: PlayerId | null;
}

/**
 * Ravenkeeper (just killed this night) chooses a player to learn their character.
 * Only valid when state.pendingRavenkeeperChoice === true.
 * Completing this unblocks night resolution and transitions to day.
 */
export interface RavenkeeperChoiceAction {
  type: "ravenkeeper-choice";
  targetId: PlayerId;
}

/**
 * Storyteller chooses which living Minion becomes the new Imp after an Imp
 * self-kill with no eligible Scarlet Woman.
 * Only valid when state.pendingMinionPromotion === true.
 * Completing this unblocks night resolution and transitions to day.
 */
export interface StorytellerChooseMinionAction {
  type: "storyteller-choose-minion";
  minionId: PlayerId;
}

/**
 * Storyteller delivers night information to a specific player.
 * Used for info-giving characters (Washerwoman, Empath, Chef, etc.).
 * The Storyteller composes the info string after consulting the Grimoire;
 * false information may be sent to poisoned or Drunk players.
 * Only valid during a night phase.
 */
export interface StorytellerDeliverInfoAction {
  type: "storyteller-deliver-info";
  playerId: PlayerId;
  info: string;
}

// ============================================================
// Union
// ============================================================

export type Action =
  | StartGameAction
  | ResolveNightAction
  | AdvanceToNightAction
  | NightChoiceAction
  | NominateAction
  | VoteAction
  | ExecuteAction
  | SkipExecutionAction
  | SlayerShootAction
  | StorytellerMayorRedirectAction
  | RavenkeeperChoiceAction
  | StorytellerChooseMinionAction
  | StorytellerDeliverInfoAction;
