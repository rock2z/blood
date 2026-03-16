/**
 * Integration tests for handler.ts + stateFilter.ts
 *
 * Tests the full message-routing and per-client state-filtering pipeline
 * using mock ClientSocket objects (no real network required).
 *
 * Coverage target: PR test-plan item 5
 *   "Connect as Storyteller and Player WebSocket clients — confirm each
 *    receives only the information they are authorised to see."
 */

import { handleMessage, sendSnapshot, ClientSocket } from "../handler";
import { createRoom, broadcast } from "../room";
import {
  StorytellerSnapshot,
  PlayerSnapshot,
  buildSnapshot,
} from "../stateFilter";
import { Player } from "@botc/engine";

// ============================================================
// Helpers
// ============================================================

type MockClient = ClientSocket & { received: unknown[] };

function makeMockClient(
  roomId = "test",
  role: "storyteller" | "player" = "player",
  playerId?: string,
): MockClient {
  const received: unknown[] = [];
  const client = {
    roomId,
    identity: { role, playerId },
    readyState: 1 /* OPEN */,
    send(msg: string) {
      received.push(JSON.parse(msg));
    },
    received,
  } as unknown as MockClient;
  return client;
}

function lastMsg(client: MockClient): { type: string; payload: unknown } {
  return client.received[client.received.length - 1] as {
    type: string;
    payload: unknown;
  };
}

function lastSnapshot(
  client: MockClient,
): StorytellerSnapshot | PlayerSnapshot {
  const msg = lastMsg(client);
  expect(msg.type).toBe("snapshot");
  return msg.payload as StorytellerSnapshot | PlayerSnapshot;
}

/** Minimal valid player list for a 5-player game */
function makePlayers(): Player[] {
  return [
    {
      id: "alice",
      name: "Alice",
      seatIndex: 0,
      trueCharacter: "imp",
      perceivedCharacter: "imp",
      alignment: "Demon",
      isAlive: true,
      isPoisoned: false,
      isDrunk: false,
      isProtected: false,
      ghostVoteUsed: false,
    },
    {
      id: "bob",
      name: "Bob",
      seatIndex: 1,
      trueCharacter: "empath",
      perceivedCharacter: "empath",
      alignment: "Townsfolk",
      isAlive: true,
      isPoisoned: false,
      isDrunk: false,
      isProtected: false,
      ghostVoteUsed: false,
    },
    {
      id: "carol",
      name: "Carol",
      seatIndex: 2,
      trueCharacter: "poisoner",
      perceivedCharacter: "poisoner",
      alignment: "Minion",
      isAlive: true,
      isPoisoned: false,
      isDrunk: false,
      isProtected: false,
      ghostVoteUsed: false,
    },
    {
      id: "dave",
      name: "Dave",
      seatIndex: 3,
      trueCharacter: "soldier",
      perceivedCharacter: "soldier",
      alignment: "Townsfolk",
      isAlive: true,
      isPoisoned: false,
      isDrunk: false,
      isProtected: false,
      ghostVoteUsed: false,
    },
    {
      id: "eve",
      name: "Eve",
      seatIndex: 4,
      trueCharacter: "mayor",
      perceivedCharacter: "mayor",
      alignment: "Townsfolk",
      isAlive: true,
      isPoisoned: false,
      isDrunk: false,
      isProtected: false,
      ghostVoteUsed: false,
    },
  ];
}

// ============================================================
// ping / pong
// ============================================================

describe("ping → pong", () => {
  test("server responds with pong", () => {
    const room = createRoom("test");
    const client = makeMockClient();
    room.clients.add(client);

    handleMessage(client, room, { type: "ping" });

    expect(lastMsg(client)).toEqual({ type: "pong" });
  });
});

// ============================================================
// identify
// ============================================================

describe("identify", () => {
  test("client identified as storyteller receives StorytellerSnapshot", () => {
    const room = createRoom("test");
    const client = makeMockClient("test", "player");
    room.clients.add(client);

    handleMessage(client, room, {
      type: "identify",
      payload: { role: "storyteller" },
    });

    const snap = lastSnapshot(client) as StorytellerSnapshot;
    expect(snap.role).toBe("storyteller");
    expect(snap.state).toBeDefined();
    expect(snap.state.grimoire).toBeDefined();
  });

  test("client identified as player receives PlayerSnapshot", () => {
    const room = createRoom("test");
    const players = makePlayers();
    room.state = { ...room.state };
    handleMessage(
      {
        ...makeMockClient("test", "storyteller"),
        received: [],
      } as unknown as MockClient,
      room,
      { type: "setup-players", payload: players },
    );

    const client = makeMockClient("test", "player", "bob");
    room.clients.add(client);

    handleMessage(client, room, {
      type: "identify",
      payload: { role: "player", playerId: "bob" },
    });

    const snap = lastSnapshot(client) as PlayerSnapshot;
    expect(snap.role).toBe("player");
    expect(snap.grimoire).toBeDefined();
    expect(snap.grimoire.myCharacter).toBe("empath");
  });

  test("identity is updated on the socket after identify", () => {
    const room = createRoom("test");
    const client = makeMockClient("test", "player");
    room.clients.add(client);

    handleMessage(client, room, {
      type: "identify",
      payload: { role: "storyteller" },
    });

    expect(client.identity.role).toBe("storyteller");
  });
});

// ============================================================
// setup-players
// ============================================================

describe("setup-players", () => {
  test("storyteller can reinitialize players; all clients receive broadcast", () => {
    const room = createRoom("test");

    const storyteller = makeMockClient("test", "storyteller");
    const playerClient = makeMockClient("test", "player", "bob");
    room.clients.add(storyteller);
    room.clients.add(playerClient);

    handleMessage(storyteller, room, {
      type: "setup-players",
      payload: makePlayers(),
    });

    // Storyteller gets full snapshot
    const stSnap = lastSnapshot(storyteller) as StorytellerSnapshot;
    expect(stSnap.role).toBe("storyteller");
    expect(stSnap.state.grimoire.players).toHaveLength(5);

    // Player gets filtered snapshot
    const plSnap = lastSnapshot(playerClient) as PlayerSnapshot;
    expect(plSnap.role).toBe("player");
  });

  test("room game state is replaced after setup-players", () => {
    const room = createRoom("test");
    const client = makeMockClient("test", "storyteller");
    room.clients.add(client);

    expect(room.state.grimoire.players).toHaveLength(0);

    handleMessage(client, room, {
      type: "setup-players",
      payload: makePlayers(),
    });

    expect(room.state.grimoire.players).toHaveLength(5);
  });

  test("setup-players with 5 players produces no demon bluffs (< 7 players)", () => {
    const room = createRoom("test");
    const client = makeMockClient("test", "storyteller");
    room.clients.add(client);

    handleMessage(client, room, {
      type: "setup-players",
      payload: makePlayers(), // 5 players
    });

    expect(room.state.grimoire.demonBluffs).toHaveLength(0);
  });

  test("setup-players with 7 players produces 3 demon bluffs", () => {
    const room = createRoom("test");
    const client = makeMockClient("test", "storyteller");
    room.clients.add(client);

    const sevenPlayers: Player[] = [
      ...makePlayers(),
      {
        id: "frank",
        name: "Frank",
        seatIndex: 5,
        trueCharacter: "chef",
        perceivedCharacter: "chef",
        alignment: "Townsfolk",
        isAlive: true,
        isPoisoned: false,
        isDrunk: false,
        isProtected: false,
        ghostVoteUsed: false,
      },
      {
        id: "grace",
        name: "Grace",
        seatIndex: 6,
        trueCharacter: "washerwoman",
        perceivedCharacter: "washerwoman",
        alignment: "Townsfolk",
        isAlive: true,
        isPoisoned: false,
        isDrunk: false,
        isProtected: false,
        ghostVoteUsed: false,
      },
    ];

    handleMessage(client, room, {
      type: "setup-players",
      payload: sevenPlayers,
    });

    expect(room.state.grimoire.demonBluffs).toHaveLength(3);
    // All bluffs must be good characters not in play
    const inPlay = sevenPlayers.map((p) => p.trueCharacter);
    for (const bluff of room.state.grimoire.demonBluffs) {
      expect(inPlay).not.toContain(bluff);
    }
  });

  test("setup-players sets fortuneTellerRedHerring when FT is in play", () => {
    const room = createRoom("test");
    const client = makeMockClient("test", "storyteller");
    room.clients.add(client);

    const playersWithFT: Player[] = [
      ...makePlayers().slice(0, 4),
      {
        id: "ft",
        name: "FT",
        seatIndex: 4,
        trueCharacter: "fortuneteller",
        perceivedCharacter: "fortuneteller",
        alignment: "Townsfolk",
        isAlive: true,
        isPoisoned: false,
        isDrunk: false,
        isProtected: false,
        ghostVoteUsed: false,
      },
    ];

    handleMessage(client, room, {
      type: "setup-players",
      payload: playersWithFT,
    });

    // Red herring is set to one of the good players
    const redHerring = room.state.grimoire.fortuneTellerRedHerring;
    expect(redHerring).not.toBeNull();
    const goodPlayerIds = playersWithFT
      .filter((p) => p.alignment === "Townsfolk" || p.alignment === "Outsider")
      .map((p) => p.id);
    expect(goodPlayerIds).toContain(redHerring);
  });

  test("non-storyteller cannot run setup-players", () => {
    const room = createRoom("test");
    const playerClient = makeMockClient("test", "player", "bob");
    room.clients.add(playerClient);

    handleMessage(playerClient, room, {
      type: "setup-players",
      payload: makePlayers(),
    });

    expect(lastMsg(playerClient)).toEqual({
      type: "error",
      payload: 'Message "setup-players" is restricted to the Storyteller',
    });
    expect(room.state.grimoire.players).toHaveLength(0);
  });
});

// ============================================================
// Storyteller state filtering — sees everything
// ============================================================

describe("Storyteller receives full state", () => {
  test("Storyteller snapshot includes all players with their true characters", () => {
    const room = createRoom("test");
    const storyteller = makeMockClient("test", "storyteller");
    room.clients.add(storyteller);

    handleMessage(storyteller, room, {
      type: "setup-players",
      payload: makePlayers(),
    });

    const snap = lastSnapshot(storyteller) as StorytellerSnapshot;
    const characters = snap.state.grimoire.players.map((p) => p.trueCharacter);
    expect(characters).toContain("imp");
    expect(characters).toContain("poisoner");
    expect(characters).toContain("empath");
  });

  test("Storyteller snapshot includes grimoire secrets (impTarget, etc.)", () => {
    const room = createRoom("test");
    const storyteller = makeMockClient("test", "storyteller");
    room.clients.add(storyteller);

    handleMessage(storyteller, room, {
      type: "setup-players",
      payload: makePlayers(),
    });

    const snap = lastSnapshot(storyteller) as StorytellerSnapshot;
    // impTarget exists in grimoire (null initially, but field is present)
    expect("impTarget" in snap.state.grimoire).toBe(true);
    expect("poisonerTarget" in snap.state.grimoire).toBe(true);
    expect("demonBluffs" in snap.state.grimoire).toBe(true);
  });
});

// ============================================================
// Player state filtering — sees only public info + own character
// ============================================================

describe("Player receives filtered state", () => {
  function setupRoom() {
    const room = createRoom("test");
    handleMessage(
      makeMockClient("test", "storyteller") as unknown as MockClient,
      room,
      { type: "setup-players", payload: makePlayers() },
    );
    return room;
  }

  test("player snapshot does NOT include other players' trueCharacter", () => {
    const room = setupRoom();
    const bobClient = makeMockClient("test", "player", "bob");
    room.clients.add(bobClient);

    sendSnapshot(bobClient, room);

    const snap = lastSnapshot(bobClient) as PlayerSnapshot;
    // PublicPlayer only has id, name, isAlive, ghostVoteUsed, seatIndex — no trueCharacter
    const publicPlayerKeys = Object.keys(snap.grimoire.players[0]);
    expect(publicPlayerKeys).not.toContain("trueCharacter");
    expect(publicPlayerKeys).not.toContain("alignment");
    expect(publicPlayerKeys).not.toContain("isPoisoned");
  });

  test("player snapshot includes only perceived self-character", () => {
    const room = setupRoom();
    const bobClient = makeMockClient("test", "player", "bob");
    room.clients.add(bobClient);

    sendSnapshot(bobClient, room);

    const snap = lastSnapshot(bobClient) as PlayerSnapshot;
    expect(snap.grimoire.myCharacter).toBe("empath");
    expect(snap.grimoire).not.toHaveProperty("myTrueCharacter");
    expect(snap.grimoire).not.toHaveProperty("myIsPoisoned");
    expect(snap.grimoire).not.toHaveProperty("myIsDrunk");
  });

  test("Imp player receives demonBluffs", () => {
    const room = setupRoom();
    // Add demon bluffs to state
    room.state = {
      ...room.state,
      grimoire: {
        ...room.state.grimoire,
        demonBluffs: ["washerwoman", "chef"],
      },
    };

    const aliceClient = makeMockClient("test", "player", "alice"); // alice is Imp
    room.clients.add(aliceClient);

    sendSnapshot(aliceClient, room);

    const snap = lastSnapshot(aliceClient) as PlayerSnapshot;
    expect(snap.grimoire.myDemonBluffs).toEqual(["washerwoman", "chef"]);
  });

  test("non-Imp player does NOT receive demonBluffs", () => {
    const room = setupRoom();
    room.state = {
      ...room.state,
      grimoire: {
        ...room.state.grimoire,
        demonBluffs: ["washerwoman", "chef"],
      },
    };

    const bobClient = makeMockClient("test", "player", "bob"); // bob is Empath
    room.clients.add(bobClient);

    sendSnapshot(bobClient, room);

    const snap = lastSnapshot(bobClient) as PlayerSnapshot;
    expect(snap.grimoire.myDemonBluffs).toBeNull();
  });

  test("player snapshot includes public game state fields", () => {
    const room = setupRoom();
    const bobClient = makeMockClient("test", "player", "bob");
    room.clients.add(bobClient);

    sendSnapshot(bobClient, room);

    const snap = lastSnapshot(bobClient) as PlayerSnapshot;
    expect(snap).toHaveProperty("phase");
    expect(snap).toHaveProperty("day");
    expect(snap).toHaveProperty("winner");
    expect(snap).toHaveProperty("voting");
    expect(snap).toHaveProperty("nominatorsUsed");
  });

  test("player snapshot does NOT expose impTarget or poisonerTarget", () => {
    const room = setupRoom();
    const bobClient = makeMockClient("test", "player", "bob");
    room.clients.add(bobClient);

    sendSnapshot(bobClient, room);

    const snap = lastSnapshot(bobClient) as PlayerSnapshot;
    expect(snap.grimoire).not.toHaveProperty("impTarget");
    expect(snap.grimoire).not.toHaveProperty("poisonerTarget");
    expect(snap.grimoire).not.toHaveProperty("monkProtectionTarget");
  });
});

// ============================================================
// broadcastSnapshots — each client gets their own view
// ============================================================

describe("broadcastSnapshots", () => {
  test("storyteller and player in same room receive different snapshot types", () => {
    const room = createRoom("test");
    const stClient = makeMockClient("test", "storyteller");
    const plClient = makeMockClient("test", "player", "bob");
    room.clients.add(stClient);
    room.clients.add(plClient);

    handleMessage(stClient, room, {
      type: "setup-players",
      payload: makePlayers(),
    });

    const stSnap = lastSnapshot(stClient) as StorytellerSnapshot;
    const plSnap = lastSnapshot(plClient) as PlayerSnapshot;

    expect(stSnap.role).toBe("storyteller");
    expect(plSnap.role).toBe("player");
  });

  test("two players in the same room each see only their own character", () => {
    const room = createRoom("test");
    const stClient = makeMockClient("test", "storyteller");
    const bobClient = makeMockClient("test", "player", "bob");
    const eveClient = makeMockClient("test", "player", "eve");
    room.clients.add(stClient);
    room.clients.add(bobClient);
    room.clients.add(eveClient);

    handleMessage(stClient, room, {
      type: "setup-players",
      payload: makePlayers(),
    });

    const bobSnap = lastSnapshot(bobClient) as PlayerSnapshot;
    const eveSnap = lastSnapshot(eveClient) as PlayerSnapshot;

    expect(bobSnap.grimoire.myCharacter).toBe("empath");
    expect(eveSnap.grimoire.myCharacter).toBe("mayor");
  });

  test("disconnected clients (readyState !== OPEN) are skipped", () => {
    const room = createRoom("test");
    const stClient = makeMockClient("test", "storyteller");
    const closedClient = makeMockClient("test", "player", "bob");
    (closedClient as unknown as { readyState: number }).readyState = 3; // CLOSED
    room.clients.add(stClient);
    room.clients.add(closedClient);

    handleMessage(stClient, room, {
      type: "setup-players",
      payload: makePlayers(),
    });

    // closedClient should receive nothing from the broadcast
    expect(closedClient.received).toHaveLength(0);
  });
});

// ============================================================
// action dispatch — state update is broadcast correctly
// ============================================================

describe("action → broadcast", () => {
  test("after start-game action, storyteller sees updated phase", () => {
    const room = createRoom("test");
    const stClient = makeMockClient("test", "storyteller");
    room.clients.add(stClient);

    handleMessage(stClient, room, {
      type: "setup-players",
      payload: makePlayers(),
    });
    stClient.received.length = 0; // clear

    handleMessage(stClient, room, {
      type: "action",
      payload: { type: "start-game" },
    });

    const snap = lastSnapshot(stClient) as StorytellerSnapshot;
    expect(snap.state.phase).toBe("first-night");
    expect(snap.state.day).toBe(0);
  });

  test("invalid action sends error only to the sender", () => {
    const room = createRoom("test");
    const stClient = makeMockClient("test", "storyteller");
    const plClient = makeMockClient("test", "player", "bob");
    room.clients.add(stClient);
    room.clients.add(plClient);

    handleMessage(stClient, room, {
      type: "setup-players",
      payload: makePlayers(),
    });
    stClient.received.length = 0;
    plClient.received.length = 0;

    // Dispatch an action that throws (wrong phase)
    handleMessage(stClient, room, {
      type: "action",
      payload: { type: "resolve-night" }, // can't resolve-night in "setup" phase
    });

    const stLast = lastMsg(stClient);
    expect(stLast.type).toBe("error");
    // Player should not have received anything
    expect(plClient.received).toHaveLength(0);
  });

  test.each([
    "start-game",
    "resolve-night",
    "advance-to-night",
    "execute",
    "skip-execution",
  ])("non-storyteller is blocked from storyteller action %s", (actionType) => {
    const room = createRoom("test");
    const stClient = makeMockClient("test", "storyteller");
    const plClient = makeMockClient("test", "player", "bob");
    room.clients.add(stClient);
    room.clients.add(plClient);

    handleMessage(stClient, room, {
      type: "setup-players",
      payload: makePlayers(),
    });
    plClient.received.length = 0;

    const action =
      actionType === "execute"
        ? ({ type: "execute", targetId: "eve" } as const)
        : ({ type: actionType } as { type: string });

    handleMessage(plClient, room, {
      type: "action",
      payload: action,
    });

    const msg = lastMsg(plClient);
    expect(msg.type).toBe("error");
    expect(String(msg.payload)).toContain(
      `Action "${actionType}" is restricted to the Storyteller`,
    );
  });

  test("player nominate action is identity-bound (forged nominatorId is ignored)", () => {
    const room = createRoom("test");
    const stClient = makeMockClient("test", "storyteller");
    const bobClient = makeMockClient("test", "player", "bob");
    room.clients.add(stClient);
    room.clients.add(bobClient);

    handleMessage(stClient, room, {
      type: "setup-players",
      payload: makePlayers(),
    });
    handleMessage(stClient, room, {
      type: "action",
      payload: { type: "start-game" },
    });
    handleMessage(stClient, room, {
      type: "action",
      payload: { type: "resolve-night" },
    });

    handleMessage(bobClient, room, {
      type: "action",
      payload: { type: "nominate", nominatorId: "eve", targetId: "alice" },
    });

    expect(room.state.voting?.nominatorId).toBe("bob");
  });

  test("player night-choice action is identity-bound (forged playerId is ignored)", () => {
    const room = createRoom("test");
    const stClient = makeMockClient("test", "storyteller");
    const bobClient = makeMockClient("test", "player", "bob");
    room.clients.add(stClient);
    room.clients.add(bobClient);

    handleMessage(stClient, room, {
      type: "setup-players",
      payload: makePlayers(),
    });
    handleMessage(stClient, room, {
      type: "action",
      payload: { type: "start-game" },
    });
    handleMessage(stClient, room, {
      type: "action",
      payload: { type: "resolve-night" },
    });
    handleMessage(stClient, room, {
      type: "action",
      payload: { type: "advance-to-night" },
    });

    // bob (Empath) attempts to spoof Imp action as alice
    handleMessage(bobClient, room, {
      type: "action",
      payload: { type: "night-choice", playerId: "alice", targetIds: ["eve"] },
    });

    expect(room.state.grimoire.impTarget).toBeNull();
  });

  test("player slayer-shoot action is identity-bound", () => {
    const room = createRoom("test");
    const stClient = makeMockClient("test", "storyteller");
    const bobClient = makeMockClient("test", "player", "bob");
    room.clients.add(stClient);
    room.clients.add(bobClient);

    handleMessage(stClient, room, {
      type: "setup-players",
      payload: makePlayers(),
    });
    handleMessage(stClient, room, {
      type: "action",
      payload: { type: "start-game" },
    });
    handleMessage(stClient, room, {
      type: "action",
      payload: { type: "resolve-night" },
    });

    handleMessage(bobClient, room, {
      type: "action",
      payload: { type: "slayer-shoot", slayerId: "eve", targetId: "alice" },
    });

    const msg = lastMsg(bobClient);
    expect(msg.type).toBe("error");
    expect(String(msg.payload)).toContain("Player bob is not the Slayer");
  });
});

// ============================================================
// unknown message type
// ============================================================

describe("unknown message type", () => {
  test("returns error with unknown type message", () => {
    const room = createRoom("test");
    const client = makeMockClient();
    room.clients.add(client);

    handleMessage(client, room, { type: "foobar", payload: null });

    expect(lastMsg(client)).toEqual({
      type: "error",
      payload: "Unknown message type: foobar",
    });
  });
});

// ============================================================
// malformed message
// ============================================================

describe("malformed message", () => {
  test("non-object message returns error", () => {
    const room = createRoom("test");
    const client = makeMockClient();
    room.clients.add(client);

    handleMessage(client, room, "not-an-object");

    expect(lastMsg(client)).toEqual({
      type: "error",
      payload: "Message must be an object",
    });
  });
});

// ============================================================
// broadcast utility (room.ts)
// ============================================================

describe("broadcast utility", () => {
  test("message reaches all open clients in the room", () => {
    const room = createRoom("test");
    const c1 = makeMockClient("test", "player", "p1");
    const c2 = makeMockClient("test", "player", "p2");
    const c3 = makeMockClient("test", "storyteller");
    room.clients.add(c1);
    room.clients.add(c2);
    room.clients.add(c3);

    broadcast(room, { type: "hello", payload: 42 });

    expect(lastMsg(c1)).toEqual({ type: "hello", payload: 42 });
    expect(lastMsg(c2)).toEqual({ type: "hello", payload: 42 });
    expect(lastMsg(c3)).toEqual({ type: "hello", payload: 42 });
  });

  test("closed client (readyState !== OPEN) does not receive the broadcast", () => {
    const room = createRoom("test");
    const openClient = makeMockClient("test", "player", "p1");
    const closedClient = makeMockClient("test", "player", "p2");
    (closedClient as unknown as { readyState: number }).readyState = 3; // CLOSED
    room.clients.add(openClient);
    room.clients.add(closedClient);

    broadcast(room, { type: "hello", payload: 99 });

    expect(lastMsg(openClient)).toEqual({ type: "hello", payload: 99 });
    expect(closedClient.received).toHaveLength(0);
  });
});

// ============================================================
// stateFilter fallback — unknown playerId (lines 92–97)
// ============================================================

describe("filterForPlayer fallback", () => {
  test("unknown playerId falls back to washerwoman defaults", () => {
    const room = createRoom("test");
    handleMessage(
      makeMockClient("test", "storyteller") as unknown as MockClient,
      room,
      { type: "setup-players", payload: makePlayers() },
    );

    const ghostClient = makeMockClient("test", "player", "nobody");
    room.clients.add(ghostClient);

    sendSnapshot(ghostClient, room);

    const snap = lastSnapshot(ghostClient) as PlayerSnapshot;
    expect(snap.role).toBe("player");
    expect(snap.grimoire.myCharacter).toBe("washerwoman");
    expect(snap.grimoire.myDemonBluffs).toBeNull();
  });
});

// ============================================================
// buildSnapshot — undefined playerId (line 151)
// ============================================================

describe("buildSnapshot with undefined playerId", () => {
  test("role=player with no playerId returns a PlayerSnapshot with fallback defaults", () => {
    const room = createRoom("test");
    handleMessage(
      makeMockClient("test", "storyteller") as unknown as MockClient,
      room,
      { type: "setup-players", payload: makePlayers() },
    );

    const snap = buildSnapshot(room.state, "player", undefined);
    expect(snap.role).toBe("player");
    const playerSnap = snap as PlayerSnapshot;
    expect(playerSnap.grimoire.myCharacter).toBe("washerwoman");
  });
});
