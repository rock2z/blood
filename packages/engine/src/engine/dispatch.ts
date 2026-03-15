// ============================================================
// Blood on the Clocktower — State Machine Dispatcher
// dispatch(state, action) → state (pure, no side effects)
// ============================================================

import { GameState, VotingState, PlayerId } from "../types";
import {
  getPlayer,
  getAlivePlayers,
  getPlayerByCharacter,
  applyPoison,
  applyMonkProtection,
  clearNightState,
  killPlayer,
  executePlayer,
  checkWinCondition,
  tryActivateScarletWoman,
} from "./grimoire";
import {
  Action,
  NightChoiceAction,
  NominateAction,
  VoteAction,
  ExecuteAction,
  SlayerShootAction,
  StorytellerMayorRedirectAction,
  RavenkeeperChoiceAction,
  StorytellerChooseMinionAction,
  StorytellerDeliverInfoAction,
} from "./actions";

// ============================================================
// Entry point
// ============================================================

export function dispatch(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "start-game":
      return handleStartGame(state);
    case "resolve-night":
      return handleResolveNight(state);
    case "advance-to-night":
      return handleAdvanceToNight(state);
    case "night-choice":
      return handleNightChoice(state, action);
    case "nominate":
      return handleNominate(state, action);
    case "vote":
      return handleVote(state, action);
    case "execute":
      return handleExecute(state, action);
    case "skip-execution":
      return handleSkipExecution(state);
    case "slayer-shoot":
      return handleSlayerShoot(state, action);
    case "storyteller-mayor-redirect":
      return handleStorytellerMayorRedirect(state, action);
    case "ravenkeeper-choice":
      return handleRavenkeeperChoice(state, action);
    case "storyteller-choose-minion":
      return handleStorytellerChooseMinion(state, action);
    case "storyteller-deliver-info":
      return handleStorytellerDeliverInfo(state, action);
    default:
      throw new Error(`Unknown action type: ${(action as Action).type}`);
  }
}

// ============================================================
// Phase transitions
// ============================================================

function handleStartGame(state: GameState): GameState {
  if (state.phase !== "setup") {
    throw new Error(`start-game requires phase "setup", got "${state.phase}"`);
  }
  return { ...state, phase: "first-night" };
}

function handleAdvanceToNight(state: GameState): GameState {
  if (state.phase !== "day") {
    throw new Error(
      `advance-to-night requires phase "day", got "${state.phase}"`,
    );
  }

  // Poison expires at the start of each new night.
  // (Poisoner ability: "poisoned tonight and tomorrow day" — clears the next night.)
  const players = state.grimoire.players.map((p) => ({
    ...p,
    isPoisoned: false,
  }));

  return {
    ...state,
    grimoire: { ...state.grimoire, players },
    phase: "night",
    voting: null,
    executionCandidateId: null,
    executionCandidateVotes: 0,
    nominatorsUsed: [],
    nominatedToday: [],
    nightInfo: {},
  };
}

// ============================================================
// Night resolution
// ============================================================

function handleResolveNight(state: GameState): GameState {
  if (state.phase !== "first-night" && state.phase !== "night") {
    throw new Error(
      `resolve-night requires a night phase, got "${state.phase}"`,
    );
  }
  if (state.pendingRavenkeeperChoice) {
    throw new Error(
      `resolve-night cannot be called while pendingRavenkeeperChoice is true`,
    );
  }
  if (state.pendingMinionPromotion) {
    throw new Error(
      `resolve-night cannot be called while pendingMinionPromotion is true`,
    );
  }

  const { grimoire } = state;
  let currentState = state;

  // Apply Imp kill if a target was chosen
  if (grimoire.impTarget) {
    const impTargetId = grimoire.impTarget;
    const impPlayer = getPlayerByCharacter(grimoire, "imp");
    const isSelfKill = impPlayer?.id === impTargetId;

    // Resolve the effective kill target.
    // Mayor redirect: if impTarget is the Mayor (alive and healthy) and Storyteller
    // set a redirect, the kill goes to the redirect target instead.
    let effectiveKillTargetId = impTargetId;
    const impTargetPlayer = getPlayer(grimoire, impTargetId);
    const mayorRedirect = grimoire.mayorRedirectTarget;
    if (
      !isSelfKill &&
      impTargetPlayer.trueCharacter === "mayor" &&
      impTargetPlayer.isAlive &&
      !impTargetPlayer.isPoisoned &&
      !impTargetPlayer.isDrunk &&
      mayorRedirect !== null
    ) {
      effectiveKillTargetId = mayorRedirect;
    }

    const target = getPlayer(grimoire, effectiveKillTargetId);

    // Check if Monk protection is effective for the effective target
    const monkPlayer = getPlayerByCharacter(grimoire, "monk");
    const monkEffective =
      monkPlayer !== undefined &&
      monkPlayer.isAlive &&
      !monkPlayer.isPoisoned &&
      !monkPlayer.isDrunk;
    const targetIsProtected = target.isProtected && monkEffective;

    // Soldier: passively protected from Demon kill (only for their own person, not redirected kills)
    const soldierSelfProtected =
      !isSelfKill &&
      target.trueCharacter === "soldier" &&
      !target.isPoisoned &&
      !target.isDrunk;

    if (targetIsProtected || soldierSelfProtected) {
      // Kill is blocked — no death this night
    } else if (isSelfKill) {
      // Imp self-kill: try Scarlet Woman first
      const { grimoire: swGrimoire, activated } =
        tryActivateScarletWoman(grimoire);
      if (activated) {
        // Imp dies, Scarlet Woman becomes new Imp
        const { grimoire: deadGrimoire, log } = killPlayer(
          swGrimoire,
          impTargetId,
          currentState.log,
          currentState.phase,
          currentState.day,
          "imp-self-killed",
        );
        currentState = { ...currentState, grimoire: deadGrimoire, log };
      } else {
        // No eligible Scarlet Woman — check for living Minions
        const aliveMinions = getAlivePlayers(grimoire).filter(
          (p) => p.alignment === "Minion",
        );
        if (aliveMinions.length > 0) {
          // Kill the Imp, then pause for Storyteller to choose which Minion becomes Imp
          const { grimoire: deadGrimoire, log } = killPlayer(
            grimoire,
            impTargetId,
            currentState.log,
            currentState.phase,
            currentState.day,
            "imp-self-killed",
          );
          return {
            ...currentState,
            grimoire: deadGrimoire,
            log,
            pendingMinionPromotion: true,
          };
        } else {
          // No Minion to promote: Imp dies with no new Demon → good wins
          const { grimoire: deadGrimoire, log } = killPlayer(
            grimoire,
            impTargetId,
            currentState.log,
            currentState.phase,
            currentState.day,
            "imp-self-killed",
          );
          currentState = { ...currentState, grimoire: deadGrimoire, log };
        }
      }
    } else {
      // Normal Imp kill (possibly redirected via Mayor)
      const { grimoire: deadGrimoire, log } = killPlayer(
        grimoire,
        effectiveKillTargetId,
        currentState.log,
        currentState.phase,
        currentState.day,
      );
      currentState = { ...currentState, grimoire: deadGrimoire, log };

      // If the killed player was the Ravenkeeper, pause for their choice
      if (target.trueCharacter === "ravenkeeper") {
        return {
          ...currentState,
          pendingRavenkeeperChoice: true,
        };
      }
    }
  }

  return finaliseNightResolution(currentState);
}

/**
 * Shared tail: check win condition, clear night state, transition to day.
 * Called after all kills/pending actions are resolved.
 */
function finaliseNightResolution(state: GameState): GameState {
  const winner = checkWinCondition(state.grimoire);
  const clearedGrimoire = clearNightState(state.grimoire);
  return {
    ...state,
    grimoire: clearedGrimoire,
    winner: winner ?? state.winner,
    phase: winner ? "game-over" : "day",
    day: state.day + 1,
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
// Storyteller: Mayor night-redirect (set before resolve-night)
// ============================================================

function handleStorytellerMayorRedirect(
  state: GameState,
  action: StorytellerMayorRedirectAction,
): GameState {
  if (state.phase !== "first-night" && state.phase !== "night") {
    throw new Error(
      `storyteller-mayor-redirect requires a night phase, got "${state.phase}"`,
    );
  }
  return {
    ...state,
    grimoire: { ...state.grimoire, mayorRedirectTarget: action.targetId },
  };
}

// ============================================================
// Ravenkeeper: choose a player to learn their character
// ============================================================

function handleRavenkeeperChoice(
  state: GameState,
  action: RavenkeeperChoiceAction,
): GameState {
  if (!state.pendingRavenkeeperChoice) {
    throw new Error(
      `ravenkeeper-choice requires pendingRavenkeeperChoice to be true`,
    );
  }

  // Validate target exists (the Ravenkeeper learns this player's character;
  // the actual info delivery is Storyteller-side — we just record the pick and unblock).
  getPlayer(state.grimoire, action.targetId);

  const log = [
    ...state.log,
    {
      type: "ravenkeeper-fired" as const,
      night: state.day,
      phase: state.phase,
      payload: { ravenkeeperTarget: action.targetId },
    },
  ];

  return finaliseNightResolution({ ...state, log });
}

// ============================================================
// Storyteller: choose which Minion becomes Imp after self-kill
// ============================================================

function handleStorytellerChooseMinion(
  state: GameState,
  action: StorytellerChooseMinionAction,
): GameState {
  if (!state.pendingMinionPromotion) {
    throw new Error(
      `storyteller-choose-minion requires pendingMinionPromotion to be true`,
    );
  }

  const minion = getPlayer(state.grimoire, action.minionId);
  if (minion.alignment !== "Minion") {
    throw new Error(
      `Player ${action.minionId} is not a Minion (alignment: ${minion.alignment})`,
    );
  }
  if (!minion.isAlive) {
    throw new Error(`Player ${action.minionId} is dead and cannot become Imp`);
  }

  // Promote the chosen Minion to Imp
  const players = state.grimoire.players.map((p) =>
    p.id === action.minionId
      ? { ...p, trueCharacter: "imp" as const, alignment: "Demon" as const }
      : p,
  );

  const log = [
    ...state.log,
    {
      type: "imp-minion-promotion" as const,
      night: state.day,
      phase: state.phase,
      payload: { newImpId: action.minionId },
    },
  ];

  const updatedState = {
    ...state,
    grimoire: { ...state.grimoire, players },
    log,
    pendingMinionPromotion: false,
  };

  return finaliseNightResolution(updatedState);
}

// ============================================================
// Night choice (player selects target)
// ============================================================

function handleNightChoice(
  state: GameState,
  action: NightChoiceAction,
): GameState {
  if (state.phase !== "first-night" && state.phase !== "night") {
    throw new Error(
      `night-choice requires a night phase, got "${state.phase}"`,
    );
  }

  const player = getPlayer(state.grimoire, action.playerId);
  const char = player.trueCharacter;

  // Poisoned/drunk players: ability has no effect (but still accepted to avoid
  // revealing their status). For Butler the master is still recorded.
  let { grimoire } = state;

  if (char === "monk") {
    if (action.targetIds[0]) {
      grimoire = applyMonkProtection(grimoire, action.targetIds[0]);
    }
  } else if (char === "poisoner") {
    if (action.targetIds[0]) {
      grimoire = applyPoison(grimoire, action.targetIds[0]);
    }
  } else if (char === "imp") {
    grimoire = { ...grimoire, impTarget: action.targetIds[0] ?? null };
  } else if (char === "butler") {
    grimoire = { ...grimoire, butlerMaster: action.targetIds[0] ?? null };
  }
  // Other characters: Storyteller handles info delivery externally

  return { ...state, grimoire };
}

// ============================================================
// Day-phase nomination
// ============================================================

function handleNominate(state: GameState, action: NominateAction): GameState {
  if (state.phase !== "day") {
    throw new Error(`nominate requires phase "day", got "${state.phase}"`);
  }
  if (state.voting !== null) {
    throw new Error("A vote is already in progress");
  }

  const { nominatorId, targetId } = action;

  if (state.nominatorsUsed.includes(nominatorId)) {
    throw new Error(`Player ${nominatorId} has already nominated today`);
  }
  if (state.nominatedToday.includes(targetId)) {
    throw new Error(`Player ${targetId} has already been nominated today`);
  }

  const nominator = getPlayer(state.grimoire, nominatorId);
  const target = getPlayer(state.grimoire, targetId);

  if (!nominator.isAlive) {
    throw new Error("Dead players cannot nominate");
  }
  if (!target.isAlive) {
    throw new Error("Dead players cannot be nominated");
  }

  // --- Virgin ability check ---
  // Fires if: target is Virgin, Virgin is healthy, ability hasn't fired,
  // AND nominator is a true Townsfolk (not Spy/Recluse registering as good).
  const virginAbilityApplies =
    target.trueCharacter === "virgin" &&
    !target.isPoisoned &&
    !target.isDrunk &&
    !state.grimoire.virginAbilityFired &&
    nominator.alignment === "Townsfolk";

  if (virginAbilityApplies) {
    // Execute the nominator immediately; no vote happens
    const { state: afterExec, winner } = executePlayer(state, nominatorId);
    const updatedGrimoire = {
      ...afterExec.grimoire,
      virginAbilityFired: true,
    };
    const log = [
      ...afterExec.log,
      {
        type: "virgin-triggered" as const,
        night: state.day,
        phase: state.phase,
        payload: { nominatorId, targetId },
      },
    ];
    return {
      ...afterExec,
      grimoire: updatedGrimoire,
      log,
      winner: winner ?? afterExec.winner,
      phase: winner ? "game-over" : afterExec.phase,
      nominatorsUsed: [...state.nominatorsUsed, nominatorId],
      nominatedToday: [...state.nominatedToday, targetId],
    };
  }

  // --- Normal nomination: build VotingState ---
  // Voting order: clockwise from the player immediately left (clockwise) of
  // the nominated player; nominated player votes last.
  const alive = getAlivePlayers(state.grimoire);
  const dead = state.grimoire.players.filter(
    (p) => !p.isAlive && !p.ghostVoteUsed,
  );
  const allVoters = [...alive, ...dead];

  // Sort all voters in clockwise order starting from target's left
  const targetSeat = target.seatIndex;
  const totalSeats = state.grimoire.players.length;

  // Build ordered list: start from seat (targetSeat + 1), wrap around
  const ordered = allVoters.sort((a, b) => {
    const aDist = (a.seatIndex - targetSeat - 1 + totalSeats) % totalSeats;
    const bDist = (b.seatIndex - targetSeat - 1 + totalSeats) % totalSeats;
    return aDist - bDist;
  });

  // Nominated player votes last (they're at distance totalSeats-1 from themselves+1)
  const eligibleVoterIds = ordered.map((p) => p.id);

  const voting: VotingState = {
    nominatorId,
    targetId,
    eligibleVoterIds,
    votes: {},
  };

  return {
    ...state,
    voting,
    nominatorsUsed: [...state.nominatorsUsed, nominatorId],
    nominatedToday: [...state.nominatedToday, targetId],
  };
}

// ============================================================
// Voting
// ============================================================

function handleVote(state: GameState, action: VoteAction): GameState {
  if (!state.voting) {
    throw new Error("No vote in progress");
  }

  const { playerId, vote } = action;
  const voting = state.voting;

  if (!voting.eligibleVoterIds.includes(playerId)) {
    throw new Error(`Player ${playerId} is not eligible to vote`);
  }
  if (playerId in voting.votes) {
    throw new Error(`Player ${playerId} has already voted`);
  }

  // Butler constraint: Butler can only vote YES if master has already voted YES
  // or has their hand raised right now (master votes in same round).
  // In sequential digital voting: master must have voted YES before Butler's turn.
  const player = getPlayer(state.grimoire, playerId);
  let effectiveVote = vote;

  if (
    player.trueCharacter === "butler" &&
    !player.isPoisoned &&
    !player.isDrunk
  ) {
    const masterId = state.grimoire.butlerMaster;
    if (masterId) {
      const masterVote = voting.votes[masterId];
      // Master hasn't voted yet OR voted NO → Butler cannot vote YES
      if (masterVote !== true) {
        effectiveVote = false;
      }
    } else {
      effectiveVote = false;
    }
  }

  const updatedVotes: Partial<Record<PlayerId, boolean>> = {
    ...voting.votes,
    [playerId]: effectiveVote,
  };

  // Mark ghost vote used if this is a dead player voting YES
  const voter = state.grimoire.players.find((p) => p.id === playerId);
  let { grimoire } = state;
  if (voter && !voter.isAlive && effectiveVote) {
    grimoire = {
      ...grimoire,
      players: grimoire.players.map((p) =>
        p.id === playerId ? { ...p, ghostVoteUsed: true } : p,
      ),
    };
  }

  const allVoted = voting.eligibleVoterIds.every((id) => id in updatedVotes);

  if (!allVoted) {
    // Vote still in progress
    return {
      ...state,
      grimoire,
      voting: { ...voting, votes: updatedVotes },
    };
  }

  // --- All votes cast: resolve the nomination ---
  const yesCount = Object.values(updatedVotes).filter(Boolean).length;
  const aliveCount = getAlivePlayers(grimoire).length;
  const threshold = Math.ceil(aliveCount / 2);

  let { executionCandidateId, executionCandidateVotes } = state;

  if (yesCount >= threshold) {
    if (yesCount > executionCandidateVotes) {
      // New candidate with strictly more votes
      executionCandidateId = voting.targetId;
      executionCandidateVotes = yesCount;
    } else if (
      yesCount === executionCandidateVotes &&
      executionCandidateId !== null
    ) {
      // Tied for highest votes → no candidate (both cancel out)
      executionCandidateId = null;
      executionCandidateVotes = yesCount;
    }
    // If yesCount < executionCandidateVotes: current candidate unchanged
  }

  return {
    ...state,
    grimoire,
    voting: null,
    executionCandidateId,
    executionCandidateVotes,
  };
}

// ============================================================
// Execution
// ============================================================

function handleExecute(state: GameState, action: ExecuteAction): GameState {
  if (state.phase !== "day") {
    throw new Error(`execute requires phase "day", got "${state.phase}"`);
  }

  const target = getPlayer(state.grimoire, action.targetId);

  // Saint check: evil wins immediately when a healthy Saint is executed.
  // Must be checked BEFORE killing to avoid being cleared.
  if (
    target.trueCharacter === "saint" &&
    !target.isPoisoned &&
    !target.isDrunk
  ) {
    const { grimoire, log } = killPlayer(
      state.grimoire,
      action.targetId,
      state.log,
      state.phase,
      state.day,
      "player-executed",
    );
    return {
      ...state,
      grimoire: { ...grimoire, executedToday: target.trueCharacter },
      log,
      phase: "game-over",
      winner: "evil",
      executionCandidateId: null,
      executionCandidateVotes: 0,
    };
  }

  // Kill the player
  const { grimoire: killedGrimoire, log } = killPlayer(
    state.grimoire,
    action.targetId,
    state.log,
    state.phase,
    state.day,
    "player-executed",
  );
  const updatedGrimoire = {
    ...killedGrimoire,
    executedToday: target.trueCharacter,
  };
  const updatedState: GameState = {
    ...state,
    grimoire: updatedGrimoire,
    log,
    executionCandidateId: null,
    executionCandidateVotes: 0,
  };

  if (target.alignment === "Demon") {
    // Demon executed: check Scarlet Woman BEFORE finalising the win.
    // If SW activates, the game continues (SW becomes new Demon, good hasn't won).
    const { grimoire: swGrimoire, activated } =
      tryActivateScarletWoman(updatedGrimoire);
    if (activated) {
      const newWinner = checkWinCondition(swGrimoire);
      return {
        ...updatedState,
        grimoire: swGrimoire,
        winner: newWinner ?? null,
        phase: newWinner ? "game-over" : updatedState.phase,
      };
    }
    // No SW: Demon is truly dead, good wins
    return { ...updatedState, phase: "game-over", winner: "good" };
  }

  // Non-Demon, non-Saint: check standard win conditions
  const winner = checkWinCondition(updatedGrimoire);
  if (winner) {
    return { ...updatedState, phase: "game-over", winner };
  }

  return updatedState;
}

function handleSkipExecution(state: GameState): GameState {
  if (state.phase !== "day") {
    throw new Error(
      `skip-execution requires phase "day", got "${state.phase}"`,
    );
  }

  // Check Mayor 3-player win: Mayor alive + healthy + exactly 3 alive + no execution
  const alive = getAlivePlayers(state.grimoire);
  const mayor = getPlayerByCharacter(state.grimoire, "mayor");
  const mayorWin =
    mayor !== undefined &&
    mayor.isAlive &&
    !mayor.isPoisoned &&
    !mayor.isDrunk &&
    alive.length === 3;

  if (mayorWin) {
    return {
      ...state,
      winner: "good",
      phase: "game-over",
      executionCandidateId: null,
      executionCandidateVotes: 0,
    };
  }

  return {
    ...state,
    executionCandidateId: null,
    executionCandidateVotes: 0,
  };
}

// ============================================================
// Slayer ability (once-per-game day ability)
// ============================================================

function handleSlayerShoot(
  state: GameState,
  action: SlayerShootAction,
): GameState {
  if (state.phase !== "day") {
    throw new Error(`slayer-shoot requires phase "day", got "${state.phase}"`);
  }

  const slayer = getPlayer(state.grimoire, action.slayerId);

  if (!slayer.isAlive) {
    throw new Error("Dead players cannot use the Slayer ability");
  }
  if (slayer.trueCharacter !== "slayer") {
    throw new Error(`Player ${action.slayerId} is not the Slayer`);
  }
  if (state.grimoire.slayerUsed) {
    throw new Error("Slayer ability has already been used");
  }
  if (slayer.isPoisoned || slayer.isDrunk) {
    // Ability is used up but has no effect when poisoned/drunk
    return {
      ...state,
      grimoire: { ...state.grimoire, slayerUsed: true },
    };
  }

  const target = getPlayer(state.grimoire, action.targetId);
  const targetIsDemon = target.alignment === "Demon";

  // Mark ability used
  let updatedState: GameState = {
    ...state,
    grimoire: { ...state.grimoire, slayerUsed: true },
  };

  if (targetIsDemon) {
    // Kill the Demon — check Scarlet Woman, then win condition
    const { grimoire: deadGrimoire, log } = killPlayer(
      updatedState.grimoire,
      action.targetId,
      updatedState.log,
      updatedState.phase,
      updatedState.day,
      "player-died",
    );

    const { grimoire: swGrimoire, activated } =
      tryActivateScarletWoman(deadGrimoire);
    const finalGrimoire = activated ? swGrimoire : deadGrimoire;
    const winner = checkWinCondition(finalGrimoire);

    updatedState = {
      ...updatedState,
      grimoire: finalGrimoire,
      log: [
        ...log,
        {
          type: "slayer-fired" as const,
          night: state.day,
          phase: state.phase,
          payload: { slayerId: action.slayerId, targetId: action.targetId },
        },
      ],
      winner: winner ?? updatedState.winner,
      phase: winner ? "game-over" : updatedState.phase,
    };
  }
  // If target is not Demon: ability is wasted (no effect, just marked used)

  return updatedState;
}

// ============================================================
// Storyteller: deliver night information to a player
// ============================================================

function handleStorytellerDeliverInfo(
  state: GameState,
  action: StorytellerDeliverInfoAction,
): GameState {
  if (state.phase !== "first-night" && state.phase !== "night") {
    throw new Error(
      `storyteller-deliver-info requires a night phase, got "${state.phase}"`,
    );
  }
  return {
    ...state,
    nightInfo: { ...state.nightInfo, [action.playerId]: action.info },
  };
}
