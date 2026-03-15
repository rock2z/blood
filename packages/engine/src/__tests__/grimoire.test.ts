import {
  createGrimoire,
  createGameState,
  applyPoison,
  applyMonkProtection,
  checkWinCondition,
  executePlayer,
  tryActivateScarletWoman,
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

  test("returns null when Demon is alive", () => {
    const players = [
      makePlayer({ id: "p1", alignment: "Townsfolk" }),
      makePlayer({ id: "p2", alignment: "Demon" }),
    ];
    const g = createGrimoire(players);
    expect(checkWinCondition(g)).toBeNull();
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
    const players = [
      makePlayer({
        id: "p1",
        alignment: "Outsider",
        trueCharacter: "saint",
        isPoisoned: true,
      }),
      makePlayer({ id: "p2", alignment: "Demon", trueCharacter: "imp" }),
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
