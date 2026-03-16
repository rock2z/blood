// ============================================================
// dispatch() integration tests
// ============================================================

import { dispatch } from "../engine/dispatch";
import { createGameState } from "../engine/grimoire";
import { Player, GameState } from "../types";

// ============================================================
// Test helpers
// ============================================================

function makePlayer(overrides: Partial<Player> & { id: string }): Player {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    trueCharacter: overrides.trueCharacter ?? "washerwoman",
    perceivedCharacter:
      overrides.perceivedCharacter ?? overrides.trueCharacter ?? "washerwoman",
    alignment: overrides.alignment ?? "Townsfolk",
    isAlive: overrides.isAlive ?? true,
    ghostVoteUsed: overrides.ghostVoteUsed ?? false,
    isPoisoned: overrides.isPoisoned ?? false,
    isDrunk: overrides.isDrunk ?? false,
    isProtected: overrides.isProtected ?? false,
    seatIndex: overrides.seatIndex ?? 0,
  };
}

/** Build a minimal valid game state in first-night phase */
function firstNightState(players: Player[]): GameState {
  const state = createGameState(players);
  return dispatch(state, { type: "start-game" });
}

/**
 * Build a state in day phase (after first night resolves with no kill).
 * Requires at least 1 Demon in players, otherwise good wins immediately.
 */
function dayState(players: Player[]): GameState {
  return dispatch(firstNightState(players), { type: "resolve-night" });
}

/** Set isPoisoned on a specific player in current state (test utility) */
function poisonPlayer(state: GameState, playerId: string): GameState {
  return {
    ...state,
    grimoire: {
      ...state.grimoire,
      players: state.grimoire.players.map((p) =>
        p.id === playerId ? { ...p, isPoisoned: true } : p,
      ),
    },
  };
}

/** Cast a full round of YES votes for a nomination */
function castAllYes(state: GameState): GameState {
  let s = state;
  const voting = s.voting!;
  for (const voterId of voting.eligibleVoterIds) {
    s = dispatch(s, { type: "vote", playerId: voterId, vote: true });
  }
  return s;
}

/** Cast a full round of NO votes for a nomination */
function castAllNo(state: GameState): GameState {
  let s = state;
  const voting = s.voting!;
  for (const voterId of voting.eligibleVoterIds) {
    s = dispatch(s, { type: "vote", playerId: voterId, vote: false });
  }
  return s;
}

// ============================================================
// start-game
// ============================================================

describe("start-game", () => {
  test("transitions setup → first-night", () => {
    const state = createGameState([
      makePlayer({ id: "p1" }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ]);
    const next = dispatch(state, { type: "start-game" });
    expect(next.phase).toBe("first-night");
  });

  test("throws when not in setup phase", () => {
    const state = createGameState([
      makePlayer({ id: "p1" }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ]);
    const started = dispatch(state, { type: "start-game" });
    expect(() => dispatch(started, { type: "start-game" })).toThrow();
  });
});

// ============================================================
// resolve-night
// ============================================================

describe("resolve-night — phase transitions", () => {
  test("first-night with no kills → day phase, day increments to 1", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p2", seatIndex: 2 }),
    ];
    const s = dispatch(firstNightState(players), { type: "resolve-night" });
    expect(s.phase).toBe("day");
    expect(s.day).toBe(1);
  });

  test("throws when not in a night phase", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    const s = dayState(players);
    expect(() => dispatch(s, { type: "resolve-night" })).toThrow();
  });
});

describe("resolve-night — normal Imp kill", () => {
  function buildNightStateWithImpTarget(targetId: string): GameState {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", trueCharacter: "washerwoman", seatIndex: 1 }),
      makePlayer({ id: "p2", trueCharacter: "chef", seatIndex: 2 }),
      makePlayer({ id: "p3", trueCharacter: "empath", seatIndex: 3 }),
      makePlayer({
        id: "p4",
        trueCharacter: "poisoner",
        alignment: "Minion",
        seatIndex: 4,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: [targetId],
    });
    return s;
  }

  test("targeted player dies after resolve-night", () => {
    let s = buildNightStateWithImpTarget("p1");
    s = dispatch(s, { type: "resolve-night" });
    expect(s.grimoire.players.find((p) => p.id === "p1")!.isAlive).toBe(false);
    expect(s.phase).toBe("day");
  });

  test("impTarget is cleared after resolve", () => {
    let s = buildNightStateWithImpTarget("p1");
    s = dispatch(s, { type: "resolve-night" });
    expect(s.grimoire.impTarget).toBeNull();
  });
});

describe("resolve-night — Monk protection", () => {
  test("Monk-protected target survives Imp kill", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "monk", trueCharacter: "monk", seatIndex: 1 }),
      makePlayer({ id: "victim", trueCharacter: "empath", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "monk",
      targetIds: ["victim"],
    });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["victim"],
    });
    s = dispatch(s, { type: "resolve-night" });
    expect(s.grimoire.players.find((p) => p.id === "victim")!.isAlive).toBe(
      true,
    );
  });

  test("Poisoned Monk does NOT protect (target dies)", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "monk", trueCharacter: "monk", seatIndex: 1 }),
      makePlayer({ id: "victim", trueCharacter: "empath", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    // Manually poison the monk this night (simulating Poisoner action or prior state)
    s = poisonPlayer(s, "monk");
    s = dispatch(s, {
      type: "night-choice",
      playerId: "monk",
      targetIds: ["victim"],
    });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["victim"],
    });
    s = dispatch(s, { type: "resolve-night" });
    expect(s.grimoire.players.find((p) => p.id === "victim")!.isAlive).toBe(
      false,
    );
  });
});

describe("resolve-night — Soldier", () => {
  test("Soldier survives Imp kill", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "soldier", trueCharacter: "soldier", seatIndex: 1 }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["soldier"],
    });
    s = dispatch(s, { type: "resolve-night" });
    expect(s.grimoire.players.find((p) => p.id === "soldier")!.isAlive).toBe(
      true,
    );
  });

  test("Poisoned Soldier does NOT survive Imp kill", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "soldier", trueCharacter: "soldier", seatIndex: 1 }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    // Manually poison soldier this night
    s = poisonPlayer(s, "soldier");
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["soldier"],
    });
    s = dispatch(s, { type: "resolve-night" });
    expect(s.grimoire.players.find((p) => p.id === "soldier")!.isAlive).toBe(
      false,
    );
  });
});

describe("resolve-night — Imp self-kill (Scarlet Woman)", () => {
  // SW activates when 5+ alive AFTER Demon dies → need 6 players total
  const sixPlayers = () => [
    makePlayer({
      id: "imp",
      trueCharacter: "imp",
      alignment: "Demon",
      seatIndex: 0,
    }),
    makePlayer({
      id: "sw",
      trueCharacter: "scarletwoman",
      alignment: "Minion",
      seatIndex: 1,
    }),
    makePlayer({ id: "p1", seatIndex: 2 }),
    makePlayer({ id: "p2", seatIndex: 3 }),
    makePlayer({ id: "p3", seatIndex: 4 }),
    makePlayer({ id: "p4", seatIndex: 5 }),
  ];

  test("Scarlet Woman takes over when Imp self-kills with 5+ alive (after death)", () => {
    let s = dayState(sixPlayers());
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["imp"],
    });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.grimoire.players.find((p) => p.id === "imp")!.isAlive).toBe(false);
    expect(s.grimoire.players.find((p) => p.id === "sw")!.trueCharacter).toBe(
      "imp",
    );
    expect(s.grimoire.players.find((p) => p.id === "sw")!.alignment).toBe(
      "Demon",
    );
    expect(s.phase).toBe("day");
    expect(s.winner).toBeNull();
  });

  test("Scarlet Woman does NOT activate when fewer than 5 alive after death → pending minion promotion", () => {
    // 4 players: imp, sw, p1, p2 → after imp dies: 3 alive < 5, SW doesn't activate
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({
        id: "sw",
        trueCharacter: "scarletwoman",
        alignment: "Minion",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
      makePlayer({ id: "p2", seatIndex: 3 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["imp"],
    });
    s = dispatch(s, { type: "resolve-night" });

    // SW didn't activate (< 5 alive after death). SW is still a Minion → pendingMinionPromotion
    expect(s.pendingMinionPromotion).toBe(true);
    s = dispatch(s, { type: "storyteller-choose-minion", minionId: "sw" });
    expect(s.grimoire.players.find((p) => p.id === "sw")!.trueCharacter).toBe(
      "imp",
    );
    expect(s.phase).toBe("day");
  });
});

describe("resolve-night — Imp self-kill (Minion promotion)", () => {
  test("pendingMinionPromotion set when no eligible SW and minions exist", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({
        id: "poisoner",
        trueCharacter: "poisoner",
        alignment: "Minion",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["imp"],
    });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.pendingMinionPromotion).toBe(true);
    expect(s.grimoire.players.find((p) => p.id === "imp")!.isAlive).toBe(false);
    expect(s.phase).toBe("night"); // stays night until Storyteller resolves
  });

  test("storyteller-choose-minion promotes the chosen player to Imp and transitions to day", () => {
    // Need 4 players so after imp dies and poisoner is promoted, 3 remain alive
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({
        id: "poisoner",
        trueCharacter: "poisoner",
        alignment: "Minion",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
      makePlayer({ id: "p2", seatIndex: 3 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["imp"],
    });
    s = dispatch(s, { type: "resolve-night" });
    s = dispatch(s, {
      type: "storyteller-choose-minion",
      minionId: "poisoner",
    });

    expect(s.pendingMinionPromotion).toBe(false);
    expect(
      s.grimoire.players.find((p) => p.id === "poisoner")!.trueCharacter,
    ).toBe("imp");
    expect(s.grimoire.players.find((p) => p.id === "poisoner")!.alignment).toBe(
      "Demon",
    );
    expect(s.phase).toBe("day");
  });

  test("storyteller-choose-minion throws when no promotion pending", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    const s = dayState(players);
    expect(() =>
      dispatch(s, { type: "storyteller-choose-minion", minionId: "p1" }),
    ).toThrow();
  });

  test("storyteller-choose-minion throws when target is not a Minion", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({
        id: "poisoner",
        trueCharacter: "poisoner",
        alignment: "Minion",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["imp"],
    });
    s = dispatch(s, { type: "resolve-night" });
    expect(() =>
      dispatch(s, { type: "storyteller-choose-minion", minionId: "p1" }),
    ).toThrow();
  });

  test("good wins when Imp self-kills with no SW and no other Minions", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({ id: "p2", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["imp"],
    });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.winner).toBe("good");
    expect(s.phase).toBe("game-over");
  });
});

describe("resolve-night — Monk protecting Imp does not block self-kill", () => {
  test("Monk protecting Imp: self-kill still resolves via Imp self-kill logic", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "monk", trueCharacter: "monk", seatIndex: 1 }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    // Monk protects Imp; Imp self-targets
    s = dispatch(s, {
      type: "night-choice",
      playerId: "monk",
      targetIds: ["imp"],
    });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["imp"],
    });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.grimoire.players.find((p) => p.id === "imp")!.isAlive).toBe(false);
    expect(s.phase).toBe("game-over");
    expect(s.winner).toBe("good");
  });

  test("self-kill is not blocked by stale protection flag on current Imp", () => {
    const players = [
      makePlayer({
        id: "new-imp",
        trueCharacter: "imp",
        alignment: "Demon",
        isProtected: true,
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({ id: "p2", seatIndex: 2 }),
    ];

    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "new-imp",
      targetIds: ["new-imp"],
    });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.grimoire.players.find((p) => p.id === "new-imp")!.isAlive).toBe(
      false,
    );
    expect(s.winner).toBe("good");
  });
});

describe("resolve-night — Mayor redirect", () => {
  const mayorPlayers = () => [
    makePlayer({
      id: "imp",
      trueCharacter: "imp",
      alignment: "Demon",
      seatIndex: 0,
    }),
    makePlayer({ id: "mayor", trueCharacter: "mayor", seatIndex: 1 }),
    makePlayer({ id: "victim", trueCharacter: "empath", seatIndex: 2 }),
    makePlayer({ id: "p1", seatIndex: 3 }),
    makePlayer({ id: "p2", seatIndex: 4 }),
  ];

  test("Storyteller can redirect Imp kill away from Mayor", () => {
    let s = dayState(mayorPlayers());
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["mayor"],
    });
    s = dispatch(s, { type: "storyteller-mayor-redirect", targetId: "victim" });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.grimoire.players.find((p) => p.id === "mayor")!.isAlive).toBe(
      true,
    );
    expect(s.grimoire.players.find((p) => p.id === "victim")!.isAlive).toBe(
      false,
    );
  });

  test("no redirect set → Mayor dies normally", () => {
    let s = dayState(mayorPlayers());
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["mayor"],
    });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.grimoire.players.find((p) => p.id === "mayor")!.isAlive).toBe(
      false,
    );
  });

  test("mayorRedirectTarget is cleared after resolve", () => {
    let s = dayState(mayorPlayers());
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["mayor"],
    });
    s = dispatch(s, { type: "storyteller-mayor-redirect", targetId: "victim" });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.grimoire.mayorRedirectTarget).toBeNull();
  });

  test("storyteller-mayor-redirect throws outside night phase", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    const s = dayState(players);
    expect(() =>
      dispatch(s, { type: "storyteller-mayor-redirect", targetId: "p1" }),
    ).toThrow();
  });
});

describe("resolve-night — Ravenkeeper", () => {
  const rkPlayers = () => [
    makePlayer({
      id: "imp",
      trueCharacter: "imp",
      alignment: "Demon",
      seatIndex: 0,
    }),
    makePlayer({ id: "rk", trueCharacter: "ravenkeeper", seatIndex: 1 }),
    makePlayer({ id: "p1", seatIndex: 2 }),
    makePlayer({ id: "p2", seatIndex: 3 }),
  ];

  test("pendingRavenkeeperChoice set when Ravenkeeper is killed", () => {
    let s = dayState(rkPlayers());
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["rk"],
    });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.pendingRavenkeeperChoice).toBe(true);
    expect(s.grimoire.players.find((p) => p.id === "rk")!.isAlive).toBe(false);
    expect(s.phase).toBe("night");
  });

  test("ravenkeeper-choice unblocks night and transitions to day", () => {
    let s = dayState(rkPlayers());
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["rk"],
    });
    s = dispatch(s, { type: "resolve-night" });
    s = dispatch(s, { type: "ravenkeeper-choice", targetId: "p1" });

    expect(s.pendingRavenkeeperChoice).toBe(false);
    expect(s.phase).toBe("day");
  });

  test("ravenkeeper-choice throws when not pending", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    const s = dayState(players);
    expect(() =>
      dispatch(s, { type: "ravenkeeper-choice", targetId: "p1" }),
    ).toThrow();
  });

  test("resolve-night throws when pendingRavenkeeperChoice is true", () => {
    let s = dayState(rkPlayers());
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["rk"],
    });
    s = dispatch(s, { type: "resolve-night" });

    expect(() => dispatch(s, { type: "resolve-night" })).toThrow();
  });
});

describe("resolve-night — good wins when Demon dies", () => {
  test("Imp self-kills with no Minions → good wins immediately", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({ id: "p2", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["imp"],
    });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.winner).toBe("good");
    expect(s.phase).toBe("game-over");
  });
});

// ============================================================
// advance-to-night
// ============================================================

describe("advance-to-night", () => {
  test("transitions day → night and resets day-phase state", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p2", seatIndex: 2 }),
    ];
    const s = dispatch(dayState(players), { type: "advance-to-night" });
    expect(s.phase).toBe("night");
    expect(s.nominatorsUsed).toHaveLength(0);
    expect(s.nominatedToday).toHaveLength(0);
    expect(s.voting).toBeNull();
  });

  test("throws when not in day phase", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    const s = firstNightState(players);
    expect(() => dispatch(s, { type: "advance-to-night" })).toThrow();
  });

  test("clears isPoisoned flags at start of new night (poison expires)", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p2", seatIndex: 2 }),
    ];
    let s = dayState(players);
    // Manually simulate poison persisting from previous night
    s = poisonPlayer(s, "p1");
    expect(s.grimoire.players.find((p) => p.id === "p1")!.isPoisoned).toBe(
      true,
    );

    s = dispatch(s, { type: "advance-to-night" });
    expect(s.grimoire.players.find((p) => p.id === "p1")!.isPoisoned).toBe(
      false,
    );
  });

  test("isPoisoned persists through the day (does NOT clear at dawn)", () => {
    const players = [
      makePlayer({ id: "p1", isPoisoned: true, seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    // firstNight resolve (dawn) should NOT clear isPoisoned
    const s = dayState(players);
    expect(s.grimoire.players.find((p) => p.id === "p1")!.isPoisoned).toBe(
      true,
    );
  });
});

// ============================================================
// nominate
// ============================================================

describe("nominate", () => {
  const basicPlayers = () => [
    makePlayer({ id: "p1", seatIndex: 0 }),
    makePlayer({ id: "p2", seatIndex: 1 }),
    makePlayer({
      id: "imp",
      trueCharacter: "imp",
      alignment: "Demon",
      seatIndex: 2,
    }),
  ];

  test("creates a VotingState with correct nominator and target", () => {
    let s = dayState(basicPlayers());
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" });

    expect(s.voting).not.toBeNull();
    expect(s.voting!.nominatorId).toBe("p1");
    expect(s.voting!.targetId).toBe("p2");
  });

  test("nominator added to nominatorsUsed", () => {
    let s = dayState(basicPlayers());
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" });
    expect(s.nominatorsUsed).toContain("p1");
  });

  test("target added to nominatedToday", () => {
    let s = dayState(basicPlayers());
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" });
    expect(s.nominatedToday).toContain("p2");
  });

  test("throws when nominator already nominated today", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({ id: "p2", seatIndex: 1 }),
      makePlayer({ id: "p3", seatIndex: 2 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 3,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" });
    s = castAllNo(s);
    expect(() =>
      dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p3" }),
    ).toThrow();
  });

  test("throws when target already nominated today", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({ id: "p2", seatIndex: 1 }),
      makePlayer({ id: "p3", seatIndex: 2 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 3,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" });
    s = castAllNo(s);
    expect(() =>
      dispatch(s, { type: "nominate", nominatorId: "p3", targetId: "p2" }),
    ).toThrow();
  });

  test("throws when a vote is already in progress", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({ id: "p2", seatIndex: 1 }),
      makePlayer({ id: "p3", seatIndex: 2 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 3,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" });
    expect(() =>
      dispatch(s, { type: "nominate", nominatorId: "p3", targetId: "imp" }),
    ).toThrow();
  });

  test("throws when dead player nominates", () => {
    const players = [
      makePlayer({ id: "p1", isAlive: false, seatIndex: 0 }),
      makePlayer({ id: "p2", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    const s = dayState(players);
    expect(() =>
      dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" }),
    ).toThrow();
  });

  test("throws when dead player is nominated", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({ id: "p2", isAlive: false, seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    const s = dayState(players);
    expect(() =>
      dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" }),
    ).toThrow();
  });
});

describe("nominate — Virgin ability", () => {
  test("Townsfolk nominating Virgin executes the nominator immediately (no voting)", () => {
    const players = [
      makePlayer({
        id: "p1",
        trueCharacter: "empath",
        alignment: "Townsfolk",
        seatIndex: 0,
      }),
      makePlayer({
        id: "virgin",
        trueCharacter: "virgin",
        alignment: "Townsfolk",
        seatIndex: 1,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, {
      type: "nominate",
      nominatorId: "p1",
      targetId: "virgin",
    });

    expect(s.voting).toBeNull();
    expect(s.grimoire.players.find((p) => p.id === "p1")!.isAlive).toBe(false);
    expect(s.grimoire.virginAbilityFired).toBe(true);
  });

  test("Demon nominating Virgin does NOT trigger ability", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({
        id: "virgin",
        trueCharacter: "virgin",
        alignment: "Townsfolk",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, {
      type: "nominate",
      nominatorId: "imp",
      targetId: "virgin",
    });

    expect(s.voting).not.toBeNull();
    expect(s.grimoire.virginAbilityFired).toBe(false);
  });

  test("Minion nominating Virgin does NOT trigger ability", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({
        id: "spy",
        trueCharacter: "spy",
        alignment: "Minion",
        seatIndex: 1,
      }),
      makePlayer({
        id: "virgin",
        trueCharacter: "virgin",
        alignment: "Townsfolk",
        seatIndex: 2,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, {
      type: "nominate",
      nominatorId: "spy",
      targetId: "virgin",
    });

    expect(s.voting).not.toBeNull();
    expect(s.grimoire.virginAbilityFired).toBe(false);
  });

  test("Virgin ability does NOT fire a second time", () => {
    const players = [
      makePlayer({
        id: "p1",
        trueCharacter: "empath",
        alignment: "Townsfolk",
        seatIndex: 0,
      }),
      makePlayer({
        id: "p2",
        trueCharacter: "chef",
        alignment: "Townsfolk",
        seatIndex: 1,
      }),
      makePlayer({
        id: "virgin",
        trueCharacter: "virgin",
        alignment: "Townsfolk",
        seatIndex: 2,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 3,
      }),
    ];
    let s = dayState(players);
    // First nomination: fires ability
    s = dispatch(s, {
      type: "nominate",
      nominatorId: "p1",
      targetId: "virgin",
    });
    expect(s.grimoire.virginAbilityFired).toBe(true);
    // Next day
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["p1"],
    }); // p1 already dead, no effect
    s = dispatch(s, { type: "resolve-night" });
    // p2 nominates Virgin again — should result in normal vote
    s = dispatch(s, {
      type: "nominate",
      nominatorId: "p2",
      targetId: "virgin",
    });
    expect(s.voting).not.toBeNull();
  });

  test("Poisoned Virgin ability does NOT fire (creates normal vote)", () => {
    const players = [
      makePlayer({
        id: "p1",
        trueCharacter: "empath",
        alignment: "Townsfolk",
        seatIndex: 0,
      }),
      makePlayer({
        id: "virgin",
        trueCharacter: "virgin",
        alignment: "Townsfolk",
        isPoisoned: true,
        seatIndex: 1,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    // isPoisoned: true on virgin persists through dayState (not cleared at dawn)
    const s = dayState(players);
    const next = dispatch(s, {
      type: "nominate",
      nominatorId: "p1",
      targetId: "virgin",
    });
    expect(next.voting).not.toBeNull();
  });
});

// ============================================================
// vote
// ============================================================

describe("vote — basic mechanics", () => {
  function buildVotingState(playerCount: number): GameState {
    const players = Array.from({ length: playerCount }, (_, i) =>
      makePlayer({
        id: `p${i}`,
        trueCharacter: i === 0 ? "imp" : "washerwoman",
        alignment: i === 0 ? "Demon" : "Townsfolk",
        seatIndex: i,
      }),
    );
    let s = dayState(players);
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" });
    return s;
  }

  test("voting is still in progress until all voters cast", () => {
    let s = buildVotingState(5);
    const firstVoterId = s.voting!.eligibleVoterIds[0];
    s = dispatch(s, { type: "vote", playerId: firstVoterId, vote: true });
    expect(s.voting).not.toBeNull();
  });

  test("voting ends and candidate set when yes count >= threshold", () => {
    // 5 players → threshold = ceil(5/2) = 3
    let s = buildVotingState(5);
    s = castAllYes(s);
    expect(s.voting).toBeNull();
    expect(s.executionCandidateId).toBe("p2");
    expect(s.executionCandidateVotes).toBeGreaterThanOrEqual(3);
  });

  test("candidate not set when yes count < threshold", () => {
    let s = buildVotingState(5);
    s = castAllNo(s);
    expect(s.voting).toBeNull();
    expect(s.executionCandidateId).toBeNull();
  });

  test("threshold is ceil(aliveCount / 2)", () => {
    // 4 alive players → threshold = 2 (ceil(4/2))
    let s = buildVotingState(4);
    // Cast exactly 2 YES votes (threshold)
    const voterIds = s.voting!.eligibleVoterIds;
    s = dispatch(s, { type: "vote", playerId: voterIds[0], vote: true });
    s = dispatch(s, { type: "vote", playerId: voterIds[1], vote: true });
    s = dispatch(s, { type: "vote", playerId: voterIds[2], vote: false });
    s = dispatch(s, { type: "vote", playerId: voterIds[3], vote: false });
    expect(s.executionCandidateId).toBe("p2");
  });

  test("throws when player votes twice", () => {
    let s = buildVotingState(5);
    const firstVoterId = s.voting!.eligibleVoterIds[0];
    s = dispatch(s, { type: "vote", playerId: firstVoterId, vote: true });
    expect(() =>
      dispatch(s, { type: "vote", playerId: firstVoterId, vote: false }),
    ).toThrow();
  });

  test("throws when no vote in progress", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    const s = dayState(players);
    expect(() =>
      dispatch(s, { type: "vote", playerId: "p1", vote: true }),
    ).toThrow();
  });
});

describe("vote — tie handling", () => {
  test("tie vote cancels both candidates (neither executes)", () => {
    // 4 players: threshold = 2
    const players = [
      makePlayer({
        id: "p0",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({ id: "p2", seatIndex: 2 }),
      makePlayer({ id: "p3", seatIndex: 3 }),
    ];
    let s = dayState(players);

    // First nomination: p2 gets enough votes
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" });
    s = castAllYes(s);
    expect(s.executionCandidateId).toBe("p2");

    // Second nomination: p3 also gets same vote count → tie → no candidate
    s = dispatch(s, { type: "nominate", nominatorId: "p3", targetId: "p0" });
    s = castAllYes(s);
    expect(s.executionCandidateId).toBeNull();
  });
});

describe("vote — Butler constraint", () => {
  test("Butler forced to NO when master has not yet voted YES", () => {
    // Seat order: master(0), butler(1), target(2), imp(3)
    // target at seat 2 → voting starts from seat 3 (imp), then 0 (master), then 1 (butler), then 2 (target)
    const players = [
      makePlayer({ id: "master", trueCharacter: "empath", seatIndex: 0 }),
      makePlayer({
        id: "butler",
        trueCharacter: "butler",
        alignment: "Outsider",
        seatIndex: 1,
      }),
      makePlayer({ id: "target", trueCharacter: "chef", seatIndex: 2 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 3,
      }),
    ];
    let s = dayState(players);
    s = { ...s, grimoire: { ...s.grimoire, butlerMaster: "master" } };

    s = dispatch(s, {
      type: "nominate",
      nominatorId: "imp",
      targetId: "target",
    });
    // Order: imp → master → butler → target
    // imp votes (no constraint)
    s = dispatch(s, { type: "vote", playerId: "imp", vote: false });
    // master votes NO
    s = dispatch(s, { type: "vote", playerId: "master", vote: false });
    // Butler tries to vote YES, but master voted NO → forced to NO
    s = dispatch(s, { type: "vote", playerId: "butler", vote: true });

    // After all votes cast (target still needs to vote)
    s = dispatch(s, { type: "vote", playerId: "target", vote: false });

    expect(s.voting).toBeNull();
    // Butler's effective vote was forced to false
    // Total YES: 0 → no candidate
    expect(s.executionCandidateId).toBeNull();
  });

  test("Butler CAN vote YES when master has already voted YES", () => {
    const players = [
      makePlayer({ id: "master", trueCharacter: "empath", seatIndex: 0 }),
      makePlayer({
        id: "butler",
        trueCharacter: "butler",
        alignment: "Outsider",
        seatIndex: 1,
      }),
      makePlayer({ id: "target", trueCharacter: "chef", seatIndex: 2 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 3,
      }),
    ];
    let s = dayState(players);
    s = { ...s, grimoire: { ...s.grimoire, butlerMaster: "master" } };

    s = dispatch(s, {
      type: "nominate",
      nominatorId: "imp",
      targetId: "target",
    });
    // Order: imp → master (YES) → butler (YES, master already YES) → target
    s = dispatch(s, { type: "vote", playerId: "imp", vote: false });
    s = dispatch(s, { type: "vote", playerId: "master", vote: true });

    // At this point master has voted YES; butler should be able to vote YES
    const beforeButlerVote = s.voting!;
    expect(beforeButlerVote.votes["master"]).toBe(true);

    s = dispatch(s, { type: "vote", playerId: "butler", vote: true });
    s = dispatch(s, { type: "vote", playerId: "target", vote: false });

    // master YES + butler YES = 2 votes; threshold for 4 alive = ceil(4/2) = 2 → candidate set
    expect(s.executionCandidateId).toBe("target");
  });
});

describe("vote — ghost vote", () => {
  test("dead player voting YES marks ghostVoteUsed", () => {
    // Need 3 alive (p1, imp, p2) so dayState doesn't trigger evil 2-alive win
    const players = [
      makePlayer({
        id: "dead",
        isAlive: false,
        ghostVoteUsed: false,
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
      makePlayer({ id: "p2", seatIndex: 3 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "imp" });
    for (const vid of s.voting!.eligibleVoterIds) {
      s = dispatch(s, { type: "vote", playerId: vid, vote: true });
    }
    expect(s.grimoire.players.find((p) => p.id === "dead")!.ghostVoteUsed).toBe(
      true,
    );
  });

  test("dead player voting NO does NOT consume ghost vote", () => {
    const players = [
      makePlayer({
        id: "dead",
        isAlive: false,
        ghostVoteUsed: false,
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
      makePlayer({ id: "p2", seatIndex: 3 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "imp" });
    for (const vid of s.voting!.eligibleVoterIds) {
      s = dispatch(s, { type: "vote", playerId: vid, vote: false });
    }
    expect(s.grimoire.players.find((p) => p.id === "dead")!.ghostVoteUsed).toBe(
      false,
    );
  });
});

// ============================================================
// execute
// ============================================================

describe("execute", () => {
  test("non-Saint non-Demon execution kills the player; game continues", () => {
    // Need 4 players so executing p1 leaves 3 alive (no evil 2-alive win)
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p2", seatIndex: 2 }),
      makePlayer({ id: "p3", seatIndex: 3 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "execute", targetId: "p1" });
    expect(s.grimoire.players.find((p) => p.id === "p1")!.isAlive).toBe(false);
    expect(s.phase).toBe("day");
    expect(s.winner).toBeNull();
  });

  test("executing the Demon (no SW) → good wins", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p2", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "execute", targetId: "imp" });
    expect(s.winner).toBe("good");
    expect(s.phase).toBe("game-over");
  });

  test("executing the Demon with eligible Scarlet Woman — SW takes over, game continues", () => {
    // Need 5+ alive after Demon dies (6 players total)
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({ id: "p2", seatIndex: 1 }),
      makePlayer({ id: "p3", seatIndex: 2 }),
      makePlayer({ id: "p4", seatIndex: 3 }),
      makePlayer({
        id: "sw",
        trueCharacter: "scarletwoman",
        alignment: "Minion",
        seatIndex: 4,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 5,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "execute", targetId: "imp" });

    expect(s.winner).toBeNull();
    expect(s.phase).toBe("day");
    expect(s.grimoire.players.find((p) => p.id === "sw")!.trueCharacter).toBe(
      "imp",
    );
    expect(s.grimoire.players.find((p) => p.id === "sw")!.alignment).toBe(
      "Demon",
    );
  });

  test("executing the Saint (healthy) → evil wins", () => {
    const players = [
      makePlayer({
        id: "saint",
        trueCharacter: "saint",
        alignment: "Outsider",
        seatIndex: 0,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "execute", targetId: "saint" });
    expect(s.winner).toBe("evil");
    expect(s.phase).toBe("game-over");
  });

  test("executing the poisoned Saint does NOT trigger evil win", () => {
    // Need 4 players so executing the saint leaves 3 alive (no evil 2-alive win)
    const players = [
      makePlayer({
        id: "saint",
        trueCharacter: "saint",
        alignment: "Outsider",
        isPoisoned: true,
        seatIndex: 0,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
      makePlayer({ id: "p2", seatIndex: 3 }),
    ];
    // isPoisoned: true persists through dayState (not cleared at dawn)
    let s = dayState(players);
    s = dispatch(s, { type: "execute", targetId: "saint" });
    expect(s.winner).toBeNull();
    expect(s.phase).toBe("day");
  });

  test("execute clears executionCandidateId and votes", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({ id: "p2", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" });
    s = castAllYes(s);
    expect(s.executionCandidateId).toBe("p2");
    s = dispatch(s, { type: "execute", targetId: "p2" });
    expect(s.executionCandidateId).toBeNull();
    expect(s.executionCandidateVotes).toBe(0);
  });
});

// ============================================================
// skip-execution
// ============================================================

describe("skip-execution", () => {
  test("clears executionCandidateId without executing anyone", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({ id: "p2", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "nominate", nominatorId: "p1", targetId: "p2" });
    s = castAllYes(s);
    s = dispatch(s, { type: "skip-execution" });

    expect(s.executionCandidateId).toBeNull();
    expect(s.grimoire.players.every((p) => p.isAlive)).toBe(true);
  });

  test("Mayor 3-player win: Mayor alive + healthy + exactly 3 alive + no execution", () => {
    const players = [
      makePlayer({ id: "mayor", trueCharacter: "mayor", seatIndex: 0 }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    const s = dayState(players);
    const next = dispatch(s, { type: "skip-execution" });
    expect(next.winner).toBe("good");
    expect(next.phase).toBe("game-over");
  });

  test("Mayor does NOT win when poisoned", () => {
    const players = [
      makePlayer({
        id: "mayor",
        trueCharacter: "mayor",
        isPoisoned: true,
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    // isPoisoned: true persists through dayState (not cleared at dawn)
    const s = dayState(players);
    const next = dispatch(s, { type: "skip-execution" });
    expect(next.winner).toBeNull();
    expect(next.phase).toBe("day");
  });

  test("Mayor does NOT win with 4+ players alive", () => {
    const players = [
      makePlayer({ id: "mayor", trueCharacter: "mayor", seatIndex: 0 }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({ id: "p2", seatIndex: 2 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 3,
      }),
    ];
    const s = dayState(players);
    const next = dispatch(s, { type: "skip-execution" });
    expect(next.winner).toBeNull();
  });

  test("throws when not in day phase", () => {
    const players = [
      makePlayer({ id: "p1", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    const s = firstNightState(players);
    expect(() => dispatch(s, { type: "skip-execution" })).toThrow();
  });
});

// ============================================================
// evil win — 2 players alive
// ============================================================

describe("evil win — 2 players alive", () => {
  test("night kill leaving 2 alive triggers evil win", () => {
    // 3 players: imp, p1, p2. Imp kills p1 → 2 alive → evil wins.
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", trueCharacter: "washerwoman", seatIndex: 1 }),
      makePlayer({ id: "p2", trueCharacter: "chef", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["p1"],
    });
    s = dispatch(s, { type: "resolve-night" });

    expect(s.grimoire.players.find((p) => p.id === "p1")!.isAlive).toBe(false);
    expect(s.winner).toBe("evil");
    expect(s.phase).toBe("game-over");
  });

  test("execution leaving 2 alive triggers evil win", () => {
    // 3 players: imp, p1, p2. Execute p2 → 2 alive → evil wins.
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", trueCharacter: "washerwoman", seatIndex: 1 }),
      makePlayer({ id: "p2", trueCharacter: "chef", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, {
      type: "nominate",
      nominatorId: "p1",
      targetId: "p2",
    });
    s = castAllYes(s);
    s = dispatch(s, { type: "execute", targetId: "p2" });

    expect(s.grimoire.players.find((p) => p.id === "p2")!.isAlive).toBe(false);
    expect(s.winner).toBe("evil");
    expect(s.phase).toBe("game-over");
  });

  test("skip-execution with 2 alive triggers evil win", () => {
    // 2 alive (imp + p1) in day phase — reached e.g. after a night kill earlier.
    // Construct state directly since dayState would itself trigger evil win at night end.
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", trueCharacter: "washerwoman", seatIndex: 1 }),
    ];
    const s: GameState = { ...createGameState(players), phase: "day", day: 2 };
    const next = dispatch(s, { type: "skip-execution" });

    expect(next.winner).toBe("evil");
    expect(next.phase).toBe("game-over");
  });
});

// ============================================================
// slayer-shoot
// ============================================================

describe("slayer-shoot", () => {
  test("shooting the Demon (no SW eligible) kills them — good wins", () => {
    const players = [
      makePlayer({ id: "slayer", trueCharacter: "slayer", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, {
      type: "slayer-shoot",
      slayerId: "slayer",
      targetId: "imp",
    });

    expect(s.grimoire.players.find((p) => p.id === "imp")!.isAlive).toBe(false);
    expect(s.winner).toBe("good");
    expect(s.phase).toBe("game-over");
    expect(s.grimoire.slayerUsed).toBe(true);
  });

  test("shooting a non-Demon: ability used up, target lives, game continues", () => {
    const players = [
      makePlayer({ id: "slayer", trueCharacter: "slayer", seatIndex: 0 }),
      makePlayer({ id: "innocent", trueCharacter: "empath", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, {
      type: "slayer-shoot",
      slayerId: "slayer",
      targetId: "innocent",
    });

    expect(s.grimoire.players.find((p) => p.id === "innocent")!.isAlive).toBe(
      true,
    );
    expect(s.grimoire.slayerUsed).toBe(true);
    expect(s.winner).toBeNull();
  });

  test("poisoned Slayer: ability is spent but has no effect on Demon", () => {
    const players = [
      makePlayer({
        id: "slayer",
        trueCharacter: "slayer",
        isPoisoned: true,
        seatIndex: 0,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    // isPoisoned: true persists through dayState
    let s = dayState(players);
    s = dispatch(s, {
      type: "slayer-shoot",
      slayerId: "slayer",
      targetId: "imp",
    });

    expect(s.grimoire.players.find((p) => p.id === "imp")!.isAlive).toBe(true);
    expect(s.grimoire.slayerUsed).toBe(true);
    expect(s.winner).toBeNull();
  });

  test("throws when ability already used", () => {
    const players = [
      makePlayer({ id: "slayer", trueCharacter: "slayer", seatIndex: 0 }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, {
      type: "slayer-shoot",
      slayerId: "slayer",
      targetId: "p1",
    }); // wasted
    expect(() =>
      dispatch(s, {
        type: "slayer-shoot",
        slayerId: "slayer",
        targetId: "imp",
      }),
    ).toThrow();
  });

  test("throws when Slayer is dead", () => {
    const players = [
      makePlayer({
        id: "slayer",
        trueCharacter: "slayer",
        isAlive: false,
        seatIndex: 0,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    const s = dayState(players);
    expect(() =>
      dispatch(s, {
        type: "slayer-shoot",
        slayerId: "slayer",
        targetId: "imp",
      }),
    ).toThrow();
  });

  test("shooting Demon with eligible Scarlet Woman — SW takes over, game continues", () => {
    // Need 5+ alive after Demon dies → 6 players
    const players = [
      makePlayer({ id: "slayer", trueCharacter: "slayer", seatIndex: 0 }),
      makePlayer({ id: "p1", seatIndex: 1 }),
      makePlayer({ id: "p2", seatIndex: 2 }),
      makePlayer({ id: "p3", seatIndex: 3 }),
      makePlayer({
        id: "sw",
        trueCharacter: "scarletwoman",
        alignment: "Minion",
        seatIndex: 4,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 5,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, {
      type: "slayer-shoot",
      slayerId: "slayer",
      targetId: "imp",
    });

    expect(s.winner).toBeNull();
    expect(s.grimoire.players.find((p) => p.id === "sw")!.trueCharacter).toBe(
      "imp",
    );
  });

  test("throws when not in day phase", () => {
    const players = [
      makePlayer({ id: "slayer", trueCharacter: "slayer", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    const s = firstNightState(players);
    expect(() =>
      dispatch(s, {
        type: "slayer-shoot",
        slayerId: "slayer",
        targetId: "imp",
      }),
    ).toThrow();
  });
});

// ============================================================
// night-choice — Poisoner
// ============================================================

describe("night-choice — Poisoner", () => {
  test("Poisoner poisons the target", () => {
    const players = [
      makePlayer({
        id: "poisoner",
        trueCharacter: "poisoner",
        alignment: "Minion",
        seatIndex: 0,
      }),
      makePlayer({ id: "victim", trueCharacter: "empath", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    let s = firstNightState(players);
    s = dispatch(s, {
      type: "night-choice",
      playerId: "poisoner",
      targetIds: ["victim"],
    });
    expect(s.grimoire.players.find((p) => p.id === "victim")!.isPoisoned).toBe(
      true,
    );
    expect(s.grimoire.poisonerTarget).toBe("victim");
  });

  test("Poisoner applying new poison clears old target's poison", () => {
    const players = [
      makePlayer({
        id: "poisoner",
        trueCharacter: "poisoner",
        alignment: "Minion",
        seatIndex: 0,
      }),
      makePlayer({ id: "v1", trueCharacter: "empath", seatIndex: 1 }),
      makePlayer({ id: "v2", trueCharacter: "chef", seatIndex: 2 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 3,
      }),
    ];
    let s = firstNightState(players);
    s = dispatch(s, {
      type: "night-choice",
      playerId: "poisoner",
      targetIds: ["v1"],
    });
    s = dispatch(s, { type: "resolve-night" });
    s = dispatch(s, { type: "advance-to-night" }); // clears poison
    s = dispatch(s, {
      type: "night-choice",
      playerId: "poisoner",
      targetIds: ["v2"],
    });
    expect(s.grimoire.players.find((p) => p.id === "v1")!.isPoisoned).toBe(
      false,
    );
    expect(s.grimoire.players.find((p) => p.id === "v2")!.isPoisoned).toBe(
      true,
    );
  });
});

// ============================================================
// Voting order sanity check
// ============================================================

describe("voting order", () => {
  test("nominated player votes last", () => {
    // target is p1 (seatIndex 1); voting starts from seatIndex 2
    const players = [
      makePlayer({ id: "p0", seatIndex: 0 }),
      makePlayer({ id: "p1", seatIndex: 1 }), // target
      makePlayer({ id: "p2", seatIndex: 2 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 3,
      }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "nominate", nominatorId: "p0", targetId: "p1" });

    const voterIds = s.voting!.eligibleVoterIds;
    expect(voterIds[voterIds.length - 1]).toBe("p1");
  });
});

// ============================================================
// Additional coverage: missing branches
// ============================================================

describe("resolve-night — throws when pendingMinionPromotion is true", () => {
  test("calling resolve-night while pendingMinionPromotion throws", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({
        id: "poisoner",
        trueCharacter: "poisoner",
        alignment: "Minion",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["imp"],
    });
    s = dispatch(s, { type: "resolve-night" });
    expect(s.pendingMinionPromotion).toBe(true);
    expect(() => dispatch(s, { type: "resolve-night" })).toThrow(
      /pendingMinionPromotion/,
    );
  });
});

describe("storyteller-choose-minion — throws when target is dead", () => {
  test("cannot promote a dead Minion to Imp", () => {
    // Need 3 alive (imp + spy + p1) so dayState doesn't trigger evil 2-alive win
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({
        id: "poisoner",
        trueCharacter: "poisoner",
        alignment: "Minion",
        isAlive: false,
        seatIndex: 1,
      }),
      makePlayer({
        id: "spy",
        trueCharacter: "spy",
        alignment: "Minion",
        seatIndex: 2,
      }),
      makePlayer({ id: "p1", seatIndex: 3 }),
    ];
    let s = dayState(players);
    s = dispatch(s, { type: "advance-to-night" });
    s = dispatch(s, {
      type: "night-choice",
      playerId: "imp",
      targetIds: ["imp"],
    });
    s = dispatch(s, { type: "resolve-night" });
    expect(s.pendingMinionPromotion).toBe(true);
    expect(() =>
      dispatch(s, { type: "storyteller-choose-minion", minionId: "poisoner" }),
    ).toThrow(/dead/);
  });
});

describe("night-choice — throws outside night phase", () => {
  test("night-choice in day phase throws", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", seatIndex: 1 }),
    ];
    const s = dayState(players);
    expect(() =>
      dispatch(s, {
        type: "night-choice",
        playerId: "imp",
        targetIds: ["p1"],
      }),
    ).toThrow(/night phase/);
  });

  test("dead player cannot submit night-choice", () => {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({
        id: "poisoner",
        trueCharacter: "poisoner",
        alignment: "Minion",
        isAlive: false,
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
      makePlayer({ id: "p2", seatIndex: 3 }),
    ];
    const s = dispatch(dayState(players), { type: "advance-to-night" });

    expect(() =>
      dispatch(s, {
        type: "night-choice",
        playerId: "poisoner",
        targetIds: ["p1"],
      }),
    ).toThrow("Dead players cannot act at night");
  });
});

describe("night-choice — self-targeting validation", () => {
  test("Monk targeting themselves throws", () => {
    const players = [
      makePlayer({ id: "monk", trueCharacter: "monk", seatIndex: 0 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    const s = dayState(players);
    const night = dispatch(s, { type: "advance-to-night" });
    expect(() =>
      dispatch(night, {
        type: "night-choice",
        playerId: "monk",
        targetIds: ["monk"],
      }),
    ).toThrow("Monk cannot protect themselves");
  });

  test("Butler choosing themselves as master throws", () => {
    const players = [
      makePlayer({
        id: "butler",
        trueCharacter: "butler",
        alignment: "Outsider",
        seatIndex: 0,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
    ];
    const s = firstNightState(players);
    expect(() =>
      dispatch(s, {
        type: "night-choice",
        playerId: "butler",
        targetIds: ["butler"],
      }),
    ).toThrow("Butler cannot choose themselves as master");
  });
});

describe("night-choice — Butler sets butlerMaster", () => {
  test("Butler night-choice records the master in grimoire", () => {
    const players = [
      makePlayer({
        id: "butler",
        trueCharacter: "butler",
        alignment: "Outsider",
        seatIndex: 0,
      }),
      makePlayer({ id: "master", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    let s = firstNightState(players);
    s = dispatch(s, {
      type: "night-choice",
      playerId: "butler",
      targetIds: ["master"],
    });
    expect(s.grimoire.butlerMaster).toBe("master");
  });
});

describe("nominate — Virgin self-nomination", () => {
  test("Virgin nominates themselves: Virgin (as Townsfolk) is executed immediately", () => {
    const players = [
      makePlayer({
        id: "virgin",
        trueCharacter: "virgin",
        alignment: "Townsfolk",
        seatIndex: 0,
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 1,
      }),
      makePlayer({ id: "p1", seatIndex: 2 }),
    ];
    let s = dayState(players);
    s = dispatch(s, {
      type: "nominate",
      nominatorId: "virgin",
      targetId: "virgin",
    });
    // Virgin is the nominator and is Townsfolk → ability fires → Virgin executed
    expect(s.voting).toBeNull();
    expect(s.grimoire.players.find((p) => p.id === "virgin")!.isAlive).toBe(
      false,
    );
    expect(s.grimoire.virginAbilityFired).toBe(true);
  });
});

describe("vote — Butler with no master set", () => {
  test("Butler with no master forced to NO regardless of vote", () => {
    const players = [
      makePlayer({
        id: "butler",
        trueCharacter: "butler",
        alignment: "Outsider",
        seatIndex: 0,
      }),
      makePlayer({ id: "target", seatIndex: 1 }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 2,
      }),
    ];
    let s = dayState(players);
    // butlerMaster is null (never set)
    s = dispatch(s, {
      type: "nominate",
      nominatorId: "imp",
      targetId: "target",
    });
    // Vote order: butler, target, imp (target at seat 1 → voting starts from seat 2)
    // Butler has no master → forced to NO
    for (const vid of s.voting!.eligibleVoterIds) {
      s = dispatch(s, { type: "vote", playerId: vid, vote: true });
    }
    // Butler was forced NO; imp + target YES = 2 out of 3 alive = threshold met
    // But Butler was forced to NO so candidate depends on imp + target YES = 2/3 ≥ ceil(3/2)=2
    expect(s.voting).toBeNull();
    // 2 YES votes (imp + target); butler forced to NO
    expect(s.executionCandidateId).toBe("target");
  });
});
