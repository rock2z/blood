import {
  getFirstNightOrder,
  getEachNightOrder,
  getFirstNightPreSteps,
} from "../engine/nightOrder";
import { createGrimoire } from "../engine/grimoire";
import { Player } from "../types";

function makePlayer(overrides: Partial<Player> & { id: string }): Player {
  return {
    id: overrides.id,
    name: overrides.id,
    trueCharacter: overrides.trueCharacter ?? "washerwoman",
    perceivedCharacter:
      overrides.perceivedCharacter ?? overrides.trueCharacter ?? "washerwoman",
    alignment: overrides.alignment ?? "Townsfolk",
    isAlive: overrides.isAlive ?? true,
    ghostVoteUsed: false,
    isPoisoned: false,
    isDrunk: false,
    isProtected: false,
    seatIndex: overrides.seatIndex ?? 0,
  };
}

describe("getFirstNightOrder", () => {
  test("returns steps sorted by firstNightOrder", () => {
    const players = [
      makePlayer({ id: "p1", trueCharacter: "chef" }), // order 8
      makePlayer({ id: "p2", trueCharacter: "poisoner", alignment: "Minion" }), // order 3
      makePlayer({ id: "p3", trueCharacter: "empath" }), // order 9
    ];
    const g = createGrimoire(players);
    const steps = getFirstNightOrder(g);
    expect(steps.map((s) => s.character)).toEqual([
      "poisoner",
      "chef",
      "empath",
    ]);
  });

  test("excludes characters without firstNightOrder (e.g. Imp, Monk)", () => {
    const players = [
      makePlayer({ id: "p1", trueCharacter: "imp", alignment: "Demon" }),
      makePlayer({ id: "p2", trueCharacter: "monk" }),
      makePlayer({ id: "p3", trueCharacter: "empath" }),
    ];
    const g = createGrimoire(players);
    const steps = getFirstNightOrder(g);
    const chars = steps.map((s) => s.character);
    expect(chars).not.toContain("imp");
    expect(chars).not.toContain("monk");
    expect(chars).toContain("empath");
  });

  test("excludes dead players", () => {
    const players = [
      makePlayer({ id: "p1", trueCharacter: "washerwoman", isAlive: false }),
      makePlayer({ id: "p2", trueCharacter: "chef" }),
    ];
    const g = createGrimoire(players);
    const steps = getFirstNightOrder(g);
    const chars = steps.map((s) => s.character);
    expect(chars).not.toContain("washerwoman");
  });
});

describe("getEachNightOrder", () => {
  test("correct order: Poisoner → Spy → Monk → Imp → Empath → Fortune Teller → Undertaker → Butler", () => {
    const players = [
      makePlayer({ id: "p1", trueCharacter: "poisoner", alignment: "Minion" }),
      makePlayer({ id: "p2", trueCharacter: "spy", alignment: "Minion" }),
      makePlayer({ id: "p3", trueCharacter: "monk" }),
      makePlayer({ id: "p4", trueCharacter: "imp", alignment: "Demon" }),
      makePlayer({ id: "p5", trueCharacter: "empath" }),
      makePlayer({ id: "p6", trueCharacter: "fortuneteller" }),
      makePlayer({ id: "p7", trueCharacter: "undertaker" }),
      makePlayer({ id: "p8", trueCharacter: "butler", alignment: "Outsider" }),
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, false);
    expect(steps.map((s) => s.character)).toEqual([
      "poisoner",
      "spy",
      "monk",
      "imp",
      "empath",
      "fortuneteller",
      "undertaker",
      "butler",
    ]);
  });

  test("Ravenkeeper included when killed this night (already dead — realistic scenario)", () => {
    // Ravenkeeper is dead (killed by Imp this night) — isAlive: false
    const players = [
      makePlayer({ id: "p1", trueCharacter: "imp", alignment: "Demon" }),
      makePlayer({ id: "p2", trueCharacter: "ravenkeeper", isAlive: false }),
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, true);
    const chars = steps.map((s) => s.character);
    expect(chars).toContain("ravenkeeper");
  });

  test("Ravenkeeper excluded when NOT killed this night", () => {
    const players = [
      makePlayer({ id: "p1", trueCharacter: "imp", alignment: "Demon" }),
      makePlayer({ id: "p2", trueCharacter: "ravenkeeper" }),
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, false);
    const chars = steps.map((s) => s.character);
    expect(chars).not.toContain("ravenkeeper");
  });

  test("dead Ravenkeeper is sorted to position 5 (between Imp at 4 and Empath at 6)", () => {
    const players = [
      makePlayer({ id: "p1", trueCharacter: "poisoner", alignment: "Minion" }), // order 1
      makePlayer({ id: "p2", trueCharacter: "monk" }), // order 3
      makePlayer({ id: "p3", trueCharacter: "imp", alignment: "Demon" }), // order 4
      makePlayer({ id: "p4", trueCharacter: "ravenkeeper", isAlive: false }), // order 5 (dead, re-inserted)
      makePlayer({ id: "p5", trueCharacter: "empath" }), // order 6
      makePlayer({ id: "p6", trueCharacter: "butler", alignment: "Outsider" }), // order 9
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, true);
    expect(steps.map((s) => s.character)).toEqual([
      "poisoner",
      "monk",
      "imp",
      "ravenkeeper",
      "empath",
      "butler",
    ]);
  });

  test("alive Ravenkeeper with ravenkeeperKilledThisNight=true is not double-inserted", () => {
    // Edge case: Ravenkeeper is alive but ravenkeeperKilledThisNight flag is true.
    // The guard at line 68 (!steps.some(s => s.character === "ravenkeeper"))
    // prevents double-insertion since buildSteps already added the alive Ravenkeeper.
    const players = [
      makePlayer({ id: "p1", trueCharacter: "imp", alignment: "Demon" }),
      makePlayer({ id: "p2", trueCharacter: "ravenkeeper", isAlive: true }),
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, true);
    const rkSteps = steps.filter((s) => s.character === "ravenkeeper");
    expect(rkSteps).toHaveLength(1);
  });
});

describe("getFirstNightPreSteps", () => {
  test("7+ players get Minion Info and Demon Info steps", () => {
    const steps = getFirstNightPreSteps(7);
    expect(steps).toHaveLength(2);
    expect(steps[0].label).toBe("Minion Info");
    expect(steps[1].label).toBe("Demon Info");
  });

  test("fewer than 7 players get skipped steps", () => {
    const steps = getFirstNightPreSteps(5);
    expect(steps).toHaveLength(2);
    expect(steps[0].label).toContain("skipped");
  });
});
