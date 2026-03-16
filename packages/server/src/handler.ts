/**
 * Message handler — routes incoming WebSocket messages to engine dispatch calls.
 *
 * Message protocol (client → server):
 *   { type: "identify", payload: { role: "storyteller" } | { role: "player", playerId: string } }
 *                                — declare who this connection is
 *   { type: "action", payload: Action }          — dispatch an engine Action
 *   { type: "setup-players", payload: Player[] } — (re)initialize player list (Storyteller only)
 *   { type: "ping" }                             — keepalive
 *
 * Message protocol (server → client):
 *   { type: "snapshot", payload: StorytellerSnapshot | PlayerSnapshot }
 *                                — state visible to this client
 *   { type: "error",    payload: string }        — error description
 *   { type: "pong" }                             — keepalive response
 */

import type WebSocket from "ws";
import {
  dispatch,
  Action,
  Player,
  createGameState,
  selectDemonBluffs,
  selectFortuneTellerRedHerring,
  findDrunkFakeCharacter,
  TB_BY_ALIGNMENT,
} from "@botc/engine";
import { Room } from "./room";
import {
  buildSnapshot,
  filterForStoryteller,
  filterForPlayer,
  ClientIdentity,
} from "./stateFilter";

/** WebSocket with our extra fields attached */
export interface ClientSocket extends WebSocket {
  roomId: string;
  identity: ClientIdentity;
}

export function handleMessage(
  client: ClientSocket,
  room: Room,
  msg: unknown,
): void {
  if (!msg || typeof msg !== "object") {
    client.send(
      JSON.stringify({ type: "error", payload: "Message must be an object" }),
    );
    return;
  }

  const { type, payload } = msg as { type: string; payload: unknown };

  switch (type) {
    case "ping":
      client.send(JSON.stringify({ type: "pong" }));
      return;

    case "identify": {
      // Client declares their role; re-send current state with appropriate filter
      const id = payload as {
        role: "storyteller" | "player";
        playerId?: string;
      };
      client.identity = { role: id.role, playerId: id.playerId };
      sendSnapshot(client, room);
      return;
    }

    case "setup-players": {
      if (client.identity?.role !== "storyteller") {
        client.send(
          JSON.stringify({
            type: "error",
            payload: `Message "setup-players" is restricted to the Storyteller`,
          }),
        );
        return;
      }

      // Reinitialize the room's game state with a new player list
      const players = payload as Player[];

      // If the Drunk is in play, assign them a fake Townsfolk perceivedCharacter
      const inPlayIds = players.map((p) => p.trueCharacter);
      const drunkFakeCharacter = findDrunkFakeCharacter(
        inPlayIds,
        TB_BY_ALIGNMENT.townsfolk,
      );
      const patchedPlayers = drunkFakeCharacter
        ? players.map((p) =>
            p.trueCharacter === "drunk"
              ? { ...p, perceivedCharacter: drunkFakeCharacter }
              : p,
          )
        : players;

      const baseState = createGameState(patchedPlayers);

      // Derive game-start values that depend on the full player set
      const demonBluffs =
        players.length >= 7 ? selectDemonBluffs(inPlayIds) : [];
      const fortuneTellerRedHerring =
        selectFortuneTellerRedHerring(patchedPlayers);

      room.state = {
        ...baseState,
        grimoire: {
          ...baseState.grimoire,
          demonBluffs,
          fortuneTellerRedHerring,
        },
      };
      broadcastSnapshots(room);
      return;
    }

    case "action": {
      const action = payload as Action;

      // Guard Storyteller-only actions so regular players cannot dispatch them.
      const storytellerOnlyActions = new Set([
        "start-game",
        "resolve-night",
        "advance-to-night",
        "execute",
        "skip-execution",
        "storyteller-mayor-redirect",
        "storyteller-choose-minion",
        "storyteller-deliver-info",
      ]);
      if (
        storytellerOnlyActions.has(action.type) &&
        client.identity?.role !== "storyteller"
      ) {
        client.send(
          JSON.stringify({
            type: "error",
            payload: `Action "${action.type}" is restricted to the Storyteller`,
          }),
        );
        return;
      }

      try {
        room.state = dispatch(room.state, action);
        broadcastSnapshots(room);
      } catch (err) {
        client.send(JSON.stringify({ type: "error", payload: String(err) }));
      }
      return;
    }

    default:
      client.send(
        JSON.stringify({
          type: "error",
          payload: `Unknown message type: ${type}`,
        }),
      );
  }
}

/**
 * Send the appropriate state snapshot to a single client based on their identity.
 */
export function sendSnapshot(client: ClientSocket, room: Room): void {
  if (client.readyState !== 1 /* OPEN */) return;

  const { role, playerId } = client.identity ?? { role: "player" };
  const snapshot = buildSnapshot(room.state, role, playerId);
  client.send(JSON.stringify({ type: "snapshot", payload: snapshot }));
}

/**
 * Broadcast state snapshots to all connected clients.
 * Each client receives only the information they are authorised to see:
 * - Storyteller: full GameState including Grimoire, night targets, evil identities
 * - Players: public state + their own private character info only
 */
export function broadcastSnapshots(room: Room): void {
  const storytellerSnapshot = filterForStoryteller(room.state);

  for (const client of room.clients) {
    if (client.readyState !== 1 /* OPEN */) continue;

    const { role, playerId } = client.identity ?? { role: "player" };

    if (role === "storyteller") {
      client.send(
        JSON.stringify({ type: "snapshot", payload: storytellerSnapshot }),
      );
    } else {
      const playerSnapshot = filterForPlayer(room.state, playerId ?? "");
      client.send(
        JSON.stringify({ type: "snapshot", payload: playerSnapshot }),
      );
    }
  }
}
