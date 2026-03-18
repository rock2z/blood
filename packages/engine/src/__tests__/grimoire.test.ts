import {
  createGrimoire,
  createGameState,
  applyPoison,
  applyMonkProtection,
  checkWinCondition,
  executePlayer,
  tryActivateScarletWoman,
  getDeadPlayers,
  getPlayersByAlignment,
  calcChefNumber,
  calcEmpathNumber,
  calcFortuneTellerResult,
} from "../engine/grimoire";
import { Player } from "../types";

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

describe("createGrimoire", () => {
  test("initialises with correct defaults", () => {
    const players = [makePlayer({ id: "p1" })];
    const g = createGrimoire(players);
    expect(g.players).toHaveLength(1);
    expect(g.impTarget).toBeNull();
    expect(g.slayerUsed).toBe(false);
    expect(g.virginAbilityFired).toBe(false);
  });
});

describe("applyPoison", () => {
  test("marks target as poisoned and clears others", () => {
    const players = [
      makePlayer({ id: "p1", isPoisoned: true }),
      makePlayer({ id: "p2" }),
    ];
    const g = createGrimoire(players);
    const updated = applyPoison(g, "p2");

    expect(updated.players.find((p) => p.id === "p1")!.isPoisoned).toBe(false);
    expect(updated.players.find((p) => p.id === "p2")!.isPoisoned).toBe(true);
    expect(updated.poisonerTarget).toBe("p2");
  });
});

describe("applyMonkProtection", () => {
  test("marks target as protected and clears others", () => {
    const players = [
      makePlayer({ id: "p1", isProtected: true }),
      makePlayer({ id: "p2" }),
    ];
    const g = createGrimoire(players);
    const updated = applyMonkProtection(g, "p2");

    expect(updated.players.find((p) => p.id === "p1")!.isProtected).toBe(false);
    expect(updated.players.find((p) => p.id === "p2")!.isProtected).toBe(true);
  });
});

describe("checkWinCondition", () => {
  test("good wins when no Demon is alive", () => {
    const players = [
      makePlayer({ id: "p1", alignment: "Townsfolk" }),
      makePlayer({ id: "p2", alignment: "Demon", isAlive: false }),
    ];
    const g = createGrimoire(players);
    expect(checkWinCondition(g)).toBe("good");
  });

  test("returns null when Demon is alive and 3+ players alive", () => {
    const players = [
      makePlayer({ id: "p1", alignment: "Townsfolk" }),
      makePlayer({ id: "p2", alignment: "Townsfolk" }),
      makePlayer({ id: "p3", alignment: "Demon" }),
    ];
    const g = createGrimoire(players);
    expect(checkWinCondition(g)).toBeNull();
  });

  test("evil wins when exactly 2 players are alive (Demon + 1 good)", () => {
    const players = [
      makePlayer({ id: "p1", alignment: "Townsfolk" }),
      makePlayer({ id: "p2", alignment: "Demon" }),
    ];
    const g = createGrimoire(players);
    expect(checkWinCondition(g)).toBe("evil");
  });

  test("evil wins when only 1 player alive (Demon alone)", () => {
    const players = [
      makePlayer({ id: "p1", alignment: "Townsfolk", isAlive: false }),
      makePlayer({ id: "p2", alignment: "Demon" }),
    ];
    const g = createGrimoire(players);
    expect(checkWinCondition(g)).toBe("evil");
  });

  test("good win (no Demon) takes priority over evil 2-alive check", () => {
    // Both Demon dead and only 2 alive — good wins because Demon is dead
    const players = [
      makePlayer({ id: "p1", alignment: "Townsfolk" }),
      makePlayer({ id: "p2", alignment: "Demon", isAlive: false }),
    ];
    const g = createGrimoire(players);
    expect(checkWinCondition(g)).toBe("good");
  });

  // Mayor 3-player win is a day-end condition checked in handleSkipExecution,
  // not in checkWinCondition. Those cases are covered in dispatch.test.ts.
});

describe("executePlayer", () => {
  test("killing the Saint gives evil the win", () => {
    const players = [
      makePlayer({ id: "p1", alignment: "Outsider", trueCharacter: "saint" }),
      makePlayer({ id: "p2", alignment: "Demon", trueCharacter: "imp" }),
    ];
    const state = createGameState(players);
    const { winner } = executePlayer(state, "p1");
    expect(winner).toBe("evil");
  });

  test("poisoned Saint execution does NOT end the game", () => {
    // Need 4 players so executing the saint leaves 3 alive (not triggering evil 2-alive win)
    const players = [
      makePlayer({
        id: "p1",
        alignment: "Outsider",
        trueCharacter: "saint",
        isPoisoned: true,
      }),
      makePlayer({ id: "p2", alignment: "Demon", trueCharacter: "imp" }),
      makePlayer({
        id: "p3",
        alignment: "Townsfolk",
        trueCharacter: "washerwoman",
      }),
      makePlayer({ id: "p4", alignment: "Townsfolk", trueCharacter: "chef" }),
    ];
    const state = createGameState(players);
    const { winner } = executePlayer(state, "p1");
    expect(winner).toBeNull();
  });

  test("executing the Demon ends the game (good wins)", () => {
    const players = [
      makePlayer({ id: "p1", alignment: "Townsfolk" }),
      makePlayer({ id: "p2", alignment: "Demon", trueCharacter: "imp" }),
    ];
    const state = createGameState(players);
    const { winner } = executePlayer(state, "p2");
    expect(winner).toBe("good");
  });
});

describe("calcChefNumber", () => {
  test("zero when no evil pairs are adjacent", () => {
    // Seats: Townsfolk(0), Demon(1), Townsfolk(2)
    const players = [
      makePlayer({ id: "p0", alignment: "Townsfolk", seatIndex: 0 }),
      makePlayer({
        id: "p1",
        alignment: "Demon",
        trueCharacter: "imp",
        seatIndex: 1,
      }),
      makePlayer({ id: "p2", alignment: "Townsfolk", seatIndex: 2 }),
    ];
    expect(calcChefNumber(createGrimoire(players))).toBe(0);
  });

  test("one evil pair when two evil players are adjacent", () => {
    // Seats: Townsfolk(0), Demon(1), Minion(2), Townsfolk(3)
    const players = [
      makePlayer({ id: "p0", alignment: "Townsfolk", seatIndex: 0 }),
      makePlayer({
        id: "p1",
        alignment: "Demon",
        trueCharacter: "imp",
        seatIndex: 1,
      }),
      makePlayer({
        id: "p2",
        alignment: "Minion",
        trueCharacter: "poisoner",
        seatIndex: 2,
      }),
      makePlayer({ id: "p3", alignment: "Townsfolk", seatIndex: 3 }),
    ];
    expect(calcChefNumber(createGrimoire(players))).toBe(1);
  });

  test("counts wrap-around evil pair (last seat adjacent to first seat)", () => {
    // Seats: Minion(0), Townsfolk(1), Demon(2) → pair wraps: seat2-seat0
    const players = [
      makePlayer({
        id: "p0",
        alignment: "Minion",
        trueCharacter: "poisoner",
        seatIndex: 0,
      }),
      makePlayer({ id: "p1", alignment: "Townsfolk", seatIndex: 1 }),
      makePlayer({
        id: "p2",
        alignment: "Demon",
        trueCharacter: "imp",
        seatIndex: 2,
      }),
    ];
    expect(calcChefNumber(createGrimoire(players))).toBe(1);
  });

  test("counts multiple disjoint evil pairs", () => {
    // Seats: Demon(0), Minion(1), Townsfolk(2), Minion(3), Townsfolk(4), Minion(5)
    // Pairs: 0-1=evil, 3-4=no, 4-5=no, 5-0=evil(wrap)
    const players = [
      makePlayer({
        id: "p0",
        alignment: "Demon",
        trueCharacter: "imp",
        seatIndex: 0,
      }),
      makePlayer({
        id: "p1",
        alignment: "Minion",
        trueCharacter: "poisoner",
        seatIndex: 1,
      }),
      makePlayer({ id: "p2", alignment: "Townsfolk", seatIndex: 2 }),
      makePlayer({
        id: "p3",
        alignment: "Minion",
        trueCharacter: "spy",
        seatIndex: 3,
      }),
      makePlayer({ id: "p4", alignment: "Townsfolk", seatIndex: 4 }),
      makePlayer({
        id: "p5",
        alignment: "Minion",
        trueCharacter: "scarletwoman",
        seatIndex: 5,
      }),
    ];
    // Adjacent evil: (0,1)=yes, (1,2)=no, (2,3)=no, (3,4)=no, (4,5)=no, (5,0)=yes → 2
    expect(calcChefNumber(createGrimoire(players))).toBe(2);
  });

  test("three-in-a-row evil counts as two pairs", () => {
    // Seats: Demon(0), Minion(1), Minion(2), Townsfolk(3)
    // Pairs: (0,1)=yes, (1,2)=yes, (2,3)=no, (3,0)=no → 2
    const players = [
      makePlayer({
        id: "p0",
        alignment: "Demon",
        trueCharacter: "imp",
        seatIndex: 0,
      }),
      makePlayer({
        id: "p1",
        alignment: "Minion",
        trueCharacter: "poisoner",
        seatIndex: 1,
      }),
      makePlayer({
        id: "p2",
        alignment: "Minion",
        trueCharacter: "spy",
        seatIndex: 2,
      }),
      makePlayer({ id: "p3", alignment: "Townsfolk", seatIndex: 3 }),
    ];
    expect(calcChefNumber(createGrimoire(players))).toBe(2);
  });
});

describe("calcEmpathNumber", () => {
  test("returns 0 when both living neighbours are good", () => {
    // Seats: Townsfolk(0), Empath(1), Townsfolk(2)
    const players = [
      makePlayer({ id: "left", alignment: "Townsfolk", seatIndex: 0 }),
      makePlayer({
        id: "empath",
        alignment: "Townsfolk",
        trueCharacter: "empath",
        seatIndex: 1,
      }),
      makePlayer({ id: "right", alignment: "Townsfolk", seatIndex: 2 }),
    ];
    expect(calcEmpathNumber(createGrimoire(players), "empath")).toBe(0);
  });

  test("returns 1 when one living neighbour is evil", () => {
    const players = [
      makePlayer({
        id: "left",
        alignment: "Demon",
        trueCharacter: "imp",
        seatIndex: 0,
      }),
      makePlayer({
        id: "empath",
        alignment: "Townsfolk",
        trueCharacter: "empath",
        seatIndex: 1,
      }),
      makePlayer({ id: "right", alignment: "Townsfolk", seatIndex: 2 }),
    ];
    expect(calcEmpathNumber(createGrimoire(players), "empath")).toBe(1);
  });

  test("returns 2 when both living neighbours are evil", () => {
    const players = [
      makePlayer({
        id: "left",
        alignment: "Demon",
        trueCharacter: "imp",
        seatIndex: 0,
      }),
      makePlayer({
        id: "empath",
        alignment: "Townsfolk",
        trueCharacter: "empath",
        seatIndex: 1,
      }),
      makePlayer({
        id: "right",
        alignment: "Minion",
        trueCharacter: "poisoner",
        seatIndex: 2,
      }),
    ];
    expect(calcEmpathNumber(createGrimoire(players), "empath")).toBe(2);
  });

  test("skips dead players when finding living neighbours", () => {
    // Seats: Evil(0, dead), Empath(1), Evil(2, dead), Good(3)
    // Left living neighbour = seat3 (good, wrapping), right living neighbour = seat3 (good)
    const players = [
      makePlayer({
        id: "dead-evil-left",
        alignment: "Minion",
        trueCharacter: "poisoner",
        seatIndex: 0,
        isAlive: false,
      }),
      makePlayer({
        id: "empath",
        alignment: "Townsfolk",
        trueCharacter: "empath",
        seatIndex: 1,
      }),
      makePlayer({
        id: "dead-evil-right",
        alignment: "Demon",
        trueCharacter: "imp",
        seatIndex: 2,
        isAlive: false,
      }),
      makePlayer({ id: "alive-good", alignment: "Townsfolk", seatIndex: 3 }),
    ];
    // Both living neighbours from empath's perspective are seat3 (only alive non-empath)
    expect(calcEmpathNumber(createGrimoire(players), "empath")).toBe(0);
  });

  test("wraps around the circle correctly", () => {
    // Seats: Empath(0), Townsfolk(1), Evil(2)
    // Left living neighbour (wrapping) = seat2 (evil)
    const players = [
      makePlayer({
        id: "empath",
        alignment: "Townsfolk",
        trueCharacter: "empath",
        seatIndex: 0,
      }),
      makePlayer({ id: "good", alignment: "Townsfolk", seatIndex: 1 }),
      makePlayer({
        id: "evil",
        alignment: "Demon",
        trueCharacter: "imp",
        seatIndex: 2,
      }),
    ];
    expect(calcEmpathNumber(createGrimoire(players), "empath")).toBe(1);
  });

  test("returns 0 for unknown player id", () => {
    const players = [
      makePlayer({ id: "p1", alignment: "Townsfolk", seatIndex: 0 }),
    ];
    expect(calcEmpathNumber(createGrimoire(players), "nonexistent")).toBe(0);
  });

  test("returns 0 when all neighbours are dead (findLivingNeighbor returns undefined)", () => {
    // Only the empath is alive; left and right are both dead
    const players = [
      makePlayer({
        id: "left",
        alignment: "Demon",
        trueCharacter: "imp",
        seatIndex: 0,
        isAlive: false,
      }),
      makePlayer({
        id: "empath",
        alignment: "Townsfolk",
        trueCharacter: "empath",
        seatIndex: 1,
      }),
      makePlayer({
        id: "right",
        alignment: "Minion",
        trueCharacter: "poisoner",
        seatIndex: 2,
        isAlive: false,
      }),
    ];
    expect(calcEmpathNumber(createGrimoire(players), "empath")).toBe(0);
  });
});

describe("calcFortuneTellerResult", () => {
  function makeGrimoireWithRedHerring(redHerringId: string | null) {
    const players = [
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
        seatIndex: 0,
      }),
      makePlayer({
        id: "tf1",
        trueCharacter: "washerwoman",
        alignment: "Townsfolk",
        seatIndex: 1,
      }),
      makePlayer({
        id: "tf2",
        trueCharacter: "empath",
        alignment: "Townsfolk",
        seatIndex: 2,
      }),
      makePlayer({
        id: "rh",
        trueCharacter: "chef",
        alignment: "Townsfolk",
        seatIndex: 3,
      }),
    ];
    const g = createGrimoire(players);
    return { ...g, fortuneTellerRedHerring: redHerringId };
  }

  test("returns true when target1 is the Demon", () => {
    const g = makeGrimoireWithRedHerring(null);
    expect(calcFortuneTellerResult(g, "imp", "tf1")).toBe(true);
  });

  test("returns true when target2 is the Demon", () => {
    const g = makeGrimoireWithRedHerring(null);
    expect(calcFortuneTellerResult(g, "tf1", "imp")).toBe(true);
  });

  test("returns true when target1 is the red herring (not Demon)", () => {
    const g = makeGrimoireWithRedHerring("rh");
    expect(calcFortuneTellerResult(g, "rh", "tf1")).toBe(true);
  });

  test("returns true when target2 is the red herring", () => {
    const g = makeGrimoireWithRedHerring("rh");
    expect(calcFortuneTellerResult(g, "tf1", "rh")).toBe(true);
  });

  test("returns false when neither target is Demon or red herring", () => {
    const g = makeGrimoireWithRedHerring("rh");
    expect(calcFortuneTellerResult(g, "tf1", "tf2")).toBe(false);
  });

  test("returns false when red herring is null and no Demon targeted", () => {
    const g = makeGrimoireWithRedHerring(null);
    expect(calcFortuneTellerResult(g, "tf1", "tf2")).toBe(false);
  });

  test("returns true when both Demon and red herring are targeted", () => {
    const g = makeGrimoireWithRedHerring("rh");
    expect(calcFortuneTellerResult(g, "imp", "rh")).toBe(true);
  });
});

describe("tryActivateScarletWoman", () => {
  test("activates when 5+ alive and Scarlet Woman is alive", () => {
    const players = Array.from({ length: 5 }, (_, i) =>
      makePlayer({
        id: `p${i}`,
        alignment: i === 0 ? "Minion" : "Townsfolk",
        trueCharacter: i === 0 ? "scarletwoman" : "washerwoman",
      }),
    );
    const g = createGrimoire(players);
    const { activated, grimoire } = tryActivateScarletWoman(g);
    expect(activated).toBe(true);
    expect(grimoire.players.find((p) => p.id === "p0")!.trueCharacter).toBe(
      "imp",
    );
    expect(grimoire.players.find((p) => p.id === "p0")!.alignment).toBe(
      "Demon",
    );
  });

  test("does NOT activate when fewer than 5 alive", () => {
    const players = Array.from({ length: 4 }, (_, i) =>
      makePlayer({
        id: `p${i}`,
        alignment: i === 0 ? "Minion" : "Townsfolk",
        trueCharacter: i === 0 ? "scarletwoman" : "washerwoman",
      }),
    );
    const g = createGrimoire(players);
    const { activated } = tryActivateScarletWoman(g);
    expect(activated).toBe(false);
  });

  test("does NOT activate when Scarlet Woman is poisoned", () => {
    const players = Array.from({ length: 6 }, (_, i) =>
      makePlayer({
        id: `p${i}`,
        alignment: i === 0 ? "Minion" : "Townsfolk",
        trueCharacter: i === 0 ? "scarletwoman" : "washerwoman",
        isPoisoned: i === 0,
      }),
    );
    const g = createGrimoire(players);
    const { activated } = tryActivateScarletWoman(g);
    expect(activated).toBe(false);
  });
});

describe("getDeadPlayers", () => {
  test("returns only dead players", () => {
    const players = [
      makePlayer({ id: "alive", isAlive: true }),
      makePlayer({ id: "dead", isAlive: false }),
    ];
    const g = createGrimoire(players);
    const dead = getDeadPlayers(g);
    expect(dead).toHaveLength(1);
    expect(dead[0].id).toBe("dead");
  });
});

describe("getPlayersByAlignment", () => {
  test("returns players matching the given alignment", () => {
    const players = [
      makePlayer({ id: "tf", alignment: "Townsfolk" }),
      makePlayer({ id: "demon", alignment: "Demon", trueCharacter: "imp" }),
    ];
    const g = createGrimoire(players);
    expect(getPlayersByAlignment(g, "Demon")).toHaveLength(1);
    expect(getPlayersByAlignment(g, "Demon")[0].id).toBe("demon");
    expect(getPlayersByAlignment(g, "Townsfolk")).toHaveLength(1);
  });
});
