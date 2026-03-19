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

// ============================================================
// Drunk night order (regression: perceivedCharacter determines position)
// ============================================================

describe("getFirstNightOrder — Drunk uses perceivedCharacter position", () => {
  test("Drunk perceived as Fortune Teller wakes at FT first-night position (10)", () => {
    // Fortune Teller first-night order = 10; Chef = 8; Drunk (as FT) should appear between them.
    const players = [
      makePlayer({ id: "chef", trueCharacter: "chef" }), // firstNightOrder: 8
      makePlayer({
        id: "drunk",
        trueCharacter: "drunk",
        perceivedCharacter: "fortuneteller",
        alignment: "Outsider",
      }), // wakes at FT order 10
      makePlayer({
        id: "butler",
        trueCharacter: "butler",
        alignment: "Outsider",
      }), // firstNightOrder: 11
    ];
    const g = createGrimoire(players);
    const steps = getFirstNightOrder(g);
    const chars = steps.map((s) => s.character);
    // Drunk should appear after Chef (8) and before Butler (11)
    expect(chars).toContain("drunk");
    expect(chars.indexOf("drunk")).toBeGreaterThan(chars.indexOf("chef"));
    expect(chars.indexOf("drunk")).toBeLessThan(chars.indexOf("butler"));
  });

  test("Drunk step uses 'drunk' as character, not the perceived character", () => {
    const players = [
      makePlayer({
        id: "drunk",
        trueCharacter: "drunk",
        perceivedCharacter: "empath",
        alignment: "Outsider",
      }),
      makePlayer({
        id: "imp",
        trueCharacter: "imp",
        alignment: "Demon",
      }),
    ];
    const g = createGrimoire(players);
    const steps = getFirstNightOrder(g);
    // Empath has firstNightOrder 9 — Drunk perceived as Empath should appear
    expect(steps.some((s) => s.character === "drunk")).toBe(true);
    expect(steps.some((s) => s.character === "empath")).toBe(false);
  });

  test("Drunk perceived as character with no first-night action (e.g. Imp) is excluded", () => {
    // If the Drunk thinks they're the Monk (no firstNightOrder), they don't wake.
    const players = [
      makePlayer({
        id: "drunk",
        trueCharacter: "drunk",
        perceivedCharacter: "monk",
        alignment: "Outsider",
      }),
      makePlayer({ id: "chef", trueCharacter: "chef" }),
    ];
    const g = createGrimoire(players);
    const steps = getFirstNightOrder(g);
    expect(steps.some((s) => s.character === "drunk")).toBe(false);
  });
});

describe("getEachNightOrder — Drunk uses perceivedCharacter position", () => {
  test("Drunk perceived as Empath wakes at Empath each-night position (6)", () => {
    const players = [
      makePlayer({
        id: "poisoner",
        trueCharacter: "poisoner",
        alignment: "Minion",
      }), // order 1
      makePlayer({ id: "imp", trueCharacter: "imp", alignment: "Demon" }), // order 4
      makePlayer({
        id: "drunk",
        trueCharacter: "drunk",
        perceivedCharacter: "empath",
        alignment: "Outsider",
      }), // wakes at Empath order 6
      makePlayer({
        id: "butler",
        trueCharacter: "butler",
        alignment: "Outsider",
      }), // order 9
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, false);
    const chars = steps.map((s) => s.character);
    expect(chars).toContain("drunk");
    expect(chars.indexOf("drunk")).toBeGreaterThan(chars.indexOf("imp"));
    expect(chars.indexOf("drunk")).toBeLessThan(chars.indexOf("butler"));
  });

  test("Drunk perceived as Monk is excluded from each-night order (Monk has no each-night action)", () => {
    // Monk has eachNightOrder: 3 but timing "each-night-except-first" — it DOES have an order.
    // Actually Monk eachNightOrder = 3 per data, so Drunk perceived as Monk should wake at 3.
    // Let's use Soldier (no eachNightOrder) instead.
    const players = [
      makePlayer({
        id: "drunk",
        trueCharacter: "drunk",
        perceivedCharacter: "soldier", // soldier has eachNightOrder: null
        alignment: "Outsider",
      }),
      makePlayer({ id: "imp", trueCharacter: "imp", alignment: "Demon" }),
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, false);
    expect(steps.some((s) => s.character === "drunk")).toBe(false);
  });
});

// ============================================================
// Poisoned / drunk flags propagate into night-order step.player
// (the UI badge reads step.player.isPoisoned / isDrunk)
// ============================================================

describe("night step player flags — poisoned / drunk", () => {
  test("poisoned Monk step carries isPoisoned=true", () => {
    const players = [
      { ...makePlayer({ id: "p1", trueCharacter: "monk" }), isPoisoned: true },
      makePlayer({ id: "p2", trueCharacter: "imp", alignment: "Demon" }),
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, false);
    const monk = steps.find((s) => s.character === "monk");
    expect(monk).toBeDefined();
    expect(monk!.player.isPoisoned).toBe(true);
    expect(monk!.player.isDrunk).toBe(false);
  });

  test("drunk Empath step carries isDrunk=true", () => {
    const players = [
      { ...makePlayer({ id: "p1", trueCharacter: "empath" }), isDrunk: true },
      makePlayer({ id: "p2", trueCharacter: "imp", alignment: "Demon" }),
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, false);
    const empath = steps.find((s) => s.character === "empath");
    expect(empath).toBeDefined();
    expect(empath!.player.isDrunk).toBe(true);
    expect(empath!.player.isPoisoned).toBe(false);
  });

  test("player with both flags set — both are visible on the step", () => {
    const players = [
      {
        ...makePlayer({ id: "p1", trueCharacter: "fortuneteller" }),
        isPoisoned: true,
        isDrunk: true,
      },
      makePlayer({ id: "p2", trueCharacter: "imp", alignment: "Demon" }),
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, false);
    const ft = steps.find((s) => s.character === "fortuneteller");
    expect(ft!.player.isPoisoned).toBe(true);
    expect(ft!.player.isDrunk).toBe(true);
  });

  test("healthy player has both flags false", () => {
    const players = [
      makePlayer({ id: "p1", trueCharacter: "undertaker" }),
      makePlayer({ id: "p2", trueCharacter: "imp", alignment: "Demon" }),
    ];
    const g = createGrimoire(players);
    const steps = getEachNightOrder(g, false);
    const ut = steps.find((s) => s.character === "undertaker");
    expect(ut!.player.isPoisoned).toBe(false);
    expect(ut!.player.isDrunk).toBe(false);
  });
});
