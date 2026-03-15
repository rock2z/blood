import {
  TROUBLE_BREWING_CHARACTERS,
  TROUBLE_BREWING_CHARACTER_IDS,
  TB_BY_ALIGNMENT,
} from "../data/troubleBrewing";

describe("Trouble Brewing character registry", () => {
  test("has exactly 22 characters", () => {
    // TB: 13 Townsfolk + 4 Outsiders + 4 Minions + 1 Demon = 22
    expect(TROUBLE_BREWING_CHARACTER_IDS).toHaveLength(22);
  });

  test("has 13 Townsfolk", () => {
    expect(TB_BY_ALIGNMENT.townsfolk).toHaveLength(13);
  });

  test("has 4 Outsiders", () => {
    expect(TB_BY_ALIGNMENT.outsiders).toHaveLength(4);
  });

  test("has 4 Minions", () => {
    expect(TB_BY_ALIGNMENT.minions).toHaveLength(4);
  });

  test("has 1 Demon", () => {
    expect(TB_BY_ALIGNMENT.demons).toHaveLength(1);
    expect(TB_BY_ALIGNMENT.demons[0]).toBe("imp");
  });

  test("every character has required fields", () => {
    for (const id of TROUBLE_BREWING_CHARACTER_IDS) {
      const char = TROUBLE_BREWING_CHARACTERS[id];
      expect(char.id).toBe(id);
      expect(char.name).toBeTruthy();
      expect(char.alignment).toMatch(/^(Townsfolk|Outsider|Minion|Demon)$/);
      expect(char.abilityText).toBeTruthy();
      expect(char.timing).toBeTruthy();
    }
  });

  test("first-night characters have firstNightOrder set", () => {
    const firstNightChars = [
      "poisoner",
      "spy",
      "washerwoman",
      "librarian",
      "investigator",
      "chef",
      "empath",
      "fortuneteller",
      "butler",
    ];
    for (const id of firstNightChars) {
      expect(
        TROUBLE_BREWING_CHARACTERS[
          id as keyof typeof TROUBLE_BREWING_CHARACTERS
        ].firstNightOrder,
      ).not.toBeNull();
    }
  });

  test("each-night characters have eachNightOrder set", () => {
    const eachNightChars = [
      "poisoner",
      "spy",
      "monk",
      "imp",
      "ravenkeeper",
      "empath",
      "fortuneteller",
      "undertaker",
      "butler",
    ];
    for (const id of eachNightChars) {
      expect(
        TROUBLE_BREWING_CHARACTERS[
          id as keyof typeof TROUBLE_BREWING_CHARACTERS
        ].eachNightOrder,
      ).not.toBeNull();
    }
  });

  test("no-night characters have null for both night orders", () => {
    const noNightChars = [
      "virgin",
      "slayer",
      "soldier",
      "mayor",
      "drunk",
      "recluse",
      "saint",
      "scarletwoman",
      "baron",
    ];
    for (const id of noNightChars) {
      const char =
        TROUBLE_BREWING_CHARACTERS[
          id as keyof typeof TROUBLE_BREWING_CHARACTERS
        ];
      expect(char.firstNightOrder).toBeNull();
      expect(char.eachNightOrder).toBeNull();
    }
  });

  test("Poisoner is first in each-night order", () => {
    const poisoner = TROUBLE_BREWING_CHARACTERS.poisoner;
    expect(poisoner.eachNightOrder).toBe(1);
  });

  test("Spy is second in each-night order", () => {
    const spy = TROUBLE_BREWING_CHARACTERS.spy;
    expect(spy.eachNightOrder).toBe(2);
  });

  test("Imp is after Monk in each-night order", () => {
    const monk = TROUBLE_BREWING_CHARACTERS.monk;
    const imp = TROUBLE_BREWING_CHARACTERS.imp;
    expect(monk.eachNightOrder!).toBeLessThan(imp.eachNightOrder!);
  });
});
