import {
  getSetupCounts,
  buildTokenBag,
  selectDemonBluffs,
} from "../engine/setup";
import { TB_BY_ALIGNMENT } from "../data/troubleBrewing";

describe("getSetupCounts", () => {
  test.each([
    [5, { townsfolk: 3, outsiders: 0, minions: 1, demons: 1 }],
    [6, { townsfolk: 3, outsiders: 1, minions: 1, demons: 1 }],
    [7, { townsfolk: 5, outsiders: 0, minions: 1, demons: 1 }],
    [8, { townsfolk: 5, outsiders: 1, minions: 1, demons: 1 }],
    [9, { townsfolk: 5, outsiders: 2, minions: 1, demons: 1 }],
    [10, { townsfolk: 7, outsiders: 0, minions: 2, demons: 1 }],
    [11, { townsfolk: 7, outsiders: 1, minions: 2, demons: 1 }],
    [12, { townsfolk: 7, outsiders: 2, minions: 2, demons: 1 }],
    [13, { townsfolk: 9, outsiders: 0, minions: 3, demons: 1 }],
    [14, { townsfolk: 9, outsiders: 1, minions: 3, demons: 1 }],
    [15, { townsfolk: 9, outsiders: 2, minions: 3, demons: 1 }],
  ])("%i players (no Baron)", (playerCount, expected) => {
    const counts = getSetupCounts({ playerCount, baronInPlay: false });
    expect(counts).toEqual(expected);
    expect(
      counts.townsfolk + counts.outsiders + counts.minions + counts.demons,
    ).toBe(playerCount);
  });

  test("Baron adds 2 outsiders, removes 2 townsfolk", () => {
    const base = getSetupCounts({ playerCount: 10, baronInPlay: false });
    const baron = getSetupCounts({ playerCount: 10, baronInPlay: true });
    expect(baron.townsfolk).toBe(base.townsfolk - 2);
    expect(baron.outsiders).toBe(base.outsiders + 2);
    expect(baron.minions).toBe(base.minions);
    expect(baron.demons).toBe(base.demons);
  });

  test("total with Baron still equals player count", () => {
    for (let n = 5; n <= 15; n++) {
      const counts = getSetupCounts({ playerCount: n, baronInPlay: true });
      expect(
        counts.townsfolk + counts.outsiders + counts.minions + counts.demons,
      ).toBe(n);
    }
  });

  test("throws for out-of-range player counts", () => {
    expect(() =>
      getSetupCounts({ playerCount: 4, baronInPlay: false }),
    ).toThrow();
    expect(() =>
      getSetupCounts({ playerCount: 16, baronInPlay: false }),
    ).toThrow();
  });

  test("townsfolk count is always odd (no Baron)", () => {
    for (let n = 5; n <= 15; n++) {
      const counts = getSetupCounts({ playerCount: n, baronInPlay: false });
      expect(counts.townsfolk % 2).toBe(1);
    }
  });
});

describe("buildTokenBag", () => {
  test("bag length equals player count", () => {
    for (let n = 5; n <= 15; n++) {
      const bag = buildTokenBag({ playerCount: n, baronInPlay: false }, 42);
      expect(bag).toHaveLength(n);
    }
  });

  test("always contains exactly 1 Imp (Demon)", () => {
    const bag = buildTokenBag({ playerCount: 10, baronInPlay: false }, 1);
    expect(bag.filter((id) => id === "imp")).toHaveLength(1);
  });

  test("Baron is included when baronInPlay is true", () => {
    const bag = buildTokenBag({ playerCount: 10, baronInPlay: true }, 1);
    expect(bag).toContain("baron");
  });

  test("all characters in bag are valid TB characters", () => {
    const allIds = [
      ...TB_BY_ALIGNMENT.townsfolk,
      ...TB_BY_ALIGNMENT.outsiders,
      ...TB_BY_ALIGNMENT.minions,
      ...TB_BY_ALIGNMENT.demons,
    ];
    const bag = buildTokenBag({ playerCount: 12, baronInPlay: false }, 99);
    for (const id of bag) {
      expect(allIds).toContain(id);
    }
  });
});

describe("selectDemonBluffs", () => {
  test("returns exactly 3 bluffs", () => {
    const bluffs = selectDemonBluffs(
      ["imp", "poisoner", "spy"] as import("../types").CharacterId[],
      1,
    );
    expect(bluffs).toHaveLength(3);
  });

  test("bluffs are not in the in-play list", () => {
    const inPlay = [
      "imp",
      "poisoner",
      "spy",
      "washerwoman",
      "empath",
    ] as import("../types").CharacterId[];
    const bluffs = selectDemonBluffs(inPlay, 1);
    for (const bluff of bluffs) {
      expect(inPlay).not.toContain(bluff);
    }
  });

  test("bluffs are only good characters (Townsfolk or Outsider)", () => {
    const bluffs = selectDemonBluffs([], 42);
    for (const bluff of bluffs) {
      expect([
        ...TB_BY_ALIGNMENT.townsfolk,
        ...TB_BY_ALIGNMENT.outsiders,
      ]).toContain(bluff);
    }
  });
});
