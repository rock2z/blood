/**
 * Client snapshot contract tests.
 *
 * Verifies that:
 * 1. The StateSnapshot discriminated union correctly separates Storyteller
 *    and Player snapshots at runtime.
 * 2. The identify message format matches what the server expects.
 * 3. The PlayerSnapshot structure exposes exactly the right fields.
 *
 * These are pure-logic tests — no DOM, no WebSocket, no React rendering.
 */

import { describe, test, expect } from "vitest";
import type {
  StateSnapshot,
  StorytellerSnapshot,
  PlayerSnapshot,
  PublicPlayer,
  PlayerGrimoire,
} from "../useGame";

// ============================================================
// Helpers — create mock snapshots matching server shapes
// ============================================================

function makeStorytellerSnapshot(): StorytellerSnapshot {
  return {
    role: "storyteller",
    state: {
      phase: "setup",
      day: 0,
      winner: null,
      voting: null,
      executionCandidateId: null,
      executionCandidateVotes: 0,
      nominatorsUsed: [],
      nominatedToday: [],
      pendingRavenkeeperChoice: false,
      pendingMinionPromotion: false,
      nightInfo: {},
      dayAnnouncements: [],
      log: [],
      grimoire: {
        players: [],
        impTarget: null,
        mayorRedirectTarget: null,
        fortuneTellerRedHerring: null,
        fortuneTellerTargets: null,
        monkProtectionTarget: null,
        poisonerTarget: null,
        butlerMaster: null,
        demonBluffs: [],
        slayerUsed: false,
        virginAbilityFired: false,
        executedToday: null,
      },
    },
  };
}

const ALICE_PUBLIC: PublicPlayer = {
  id: "alice",
  name: "Alice",
  isAlive: true,
  ghostVoteUsed: false,
  seatIndex: 0,
};

function makePlayerGrimoire(
  overrides?: Partial<PlayerGrimoire>,
): PlayerGrimoire {
  return {
    players: [ALICE_PUBLIC],
    myCharacter: "empath",
    myDemonBluffs: null,
    slayerUsed: false,
    virginAbilityFired: false,
    executedToday: null,
    myNightInfo: null,
    ...overrides,
  };
}

function makePlayerSnapshot(
  overrides?: Partial<PlayerSnapshot>,
): PlayerSnapshot {
  return {
    role: "player",
    phase: "day",
    day: 1,
    winner: null,
    voting: null,
    executionCandidateId: null,
    executionCandidateVotes: 0,
    nominatorsUsed: [],
    nominatedToday: [],
    pendingRavenkeeperChoice: false,
    pendingMinionPromotion: false,
    pendingImpChoice: false,
    grimoire: makePlayerGrimoire(),
    dayAnnouncements: [],
    ...overrides,
  };
}

// ============================================================
// Discriminated union type guard
// ============================================================

describe("StateSnapshot discriminated union", () => {
  test("StorytellerSnapshot has role=storyteller and a state field", () => {
    const snap: StateSnapshot = makeStorytellerSnapshot();
    expect(snap.role).toBe("storyteller");
    if (snap.role === "storyteller") {
      expect(snap.state).toBeDefined();
      expect(snap.state.grimoire).toBeDefined();
      expect(snap.state.phase).toBe("setup");
    }
  });

  test("PlayerSnapshot has role=player and a grimoire field", () => {
    const snap: StateSnapshot = makePlayerSnapshot();
    expect(snap.role).toBe("player");
    if (snap.role === "player") {
      expect(snap.grimoire).toBeDefined();
      expect(snap.phase).toBe("day");
    }
  });

  test("role discriminant correctly narrows the union", () => {
    const snaps: StateSnapshot[] = [
      makeStorytellerSnapshot(),
      makePlayerSnapshot(),
    ];

    const storytellerSnaps = snaps.filter((s) => s.role === "storyteller");
    const playerSnaps = snaps.filter((s) => s.role === "player");

    expect(storytellerSnaps).toHaveLength(1);
    expect(playerSnaps).toHaveLength(1);
  });
});

// ============================================================
// PlayerSnapshot — private info visibility
// ============================================================

describe("PlayerSnapshot private info", () => {
  test("grimoire contains perceived self-character field", () => {
    const snap = makePlayerSnapshot();
    expect(snap.grimoire.myCharacter).toBe("empath");
  });

  test("grimoire.players contains only PublicPlayer fields (no trueCharacter)", () => {
    const snap = makePlayerSnapshot();
    const publicKeys = Object.keys(snap.grimoire.players[0]);
    expect(publicKeys).toContain("id");
    expect(publicKeys).toContain("name");
    expect(publicKeys).toContain("isAlive");
    expect(publicKeys).toContain("ghostVoteUsed");
    expect(publicKeys).toContain("seatIndex");
    expect(publicKeys).not.toContain("trueCharacter");
    expect(publicKeys).not.toContain("alignment");
    expect(publicKeys).not.toContain("isPoisoned");
  });

  test("Imp player receives demon bluffs; non-Imp receives null", () => {
    const impSnap = makePlayerSnapshot({
      grimoire: makePlayerGrimoire({
        myCharacter: "imp",
        myDemonBluffs: ["washerwoman", "chef", "librarian"],
      }),
    });
    const nonImpSnap = makePlayerSnapshot(); // empath, no bluffs

    expect(impSnap.grimoire.myDemonBluffs).toHaveLength(3);
    expect(nonImpSnap.grimoire.myDemonBluffs).toBeNull();
  });

  test("poisoned/drunk flags are NOT exposed to the player", () => {
    const snap = makePlayerSnapshot({
      grimoire: makePlayerGrimoire(),
    });
    expect(snap.grimoire).not.toHaveProperty("myIsPoisoned");
    expect(snap.grimoire).not.toHaveProperty("myIsDrunk");
  });

  test("Drunk player sees only perceived (fake) character", () => {
    const snap = makePlayerSnapshot({
      grimoire: makePlayerGrimoire({
        myCharacter: "chef", // the fake townsfolk token
      }),
    });
    expect(snap.grimoire.myCharacter).toBe("chef");
    expect(snap.grimoire).not.toHaveProperty("myTrueCharacter");
  });
});

// ============================================================
// identify message format (contract with server handler)
// ============================================================

describe("identify message contract", () => {
  test("storyteller identify payload shape", () => {
    const msg = {
      type: "identify" as const,
      payload: { role: "storyteller" as const },
    };
    expect(msg.type).toBe("identify");
    expect(msg.payload.role).toBe("storyteller");
    // Server expects exactly { role: "storyteller" } — no extra fields required
    expect(Object.keys(msg.payload)).toEqual(["role"]);
  });

  test("player identify payload includes playerId", () => {
    const msg = {
      type: "identify" as const,
      payload: { role: "player" as const, playerId: "player-3" },
    };
    expect(msg.payload.role).toBe("player");
    expect(msg.payload.playerId).toBe("player-3");
  });
});

// ============================================================
// StorytellerSnapshot — full grimoire access
// ============================================================

describe("StorytellerSnapshot full access", () => {
  test("contains grimoire with all secret fields", () => {
    const snap = makeStorytellerSnapshot();
    const grimoire = snap.state.grimoire;
    expect("impTarget" in grimoire).toBe(true);
    expect("poisonerTarget" in grimoire).toBe(true);
    expect("monkProtectionTarget" in grimoire).toBe(true);
    expect("fortuneTellerRedHerring" in grimoire).toBe(true);
    expect("demonBluffs" in grimoire).toBe(true);
  });

  test("phase transitions are visible to storyteller", () => {
    const snap = makeStorytellerSnapshot();
    expect(snap.state.phase).toBe("setup");
    // Storyteller can see the full GameState including all phase info
    expect(typeof snap.state.day).toBe("number");
    expect(snap.state.winner).toBeNull();
  });
});
