/**
 * Room — one in-progress BotC game.
 * Holds the authoritative GameState and the set of connected clients.
 */

import { GameState, createGameState } from "@botc/engine";
import { ClientSocket } from "./handler";

export interface Room {
  id: string;
  state: GameState;
  clients: Set<ClientSocket>;
}

export function createRoom(id: string): Room {
  return {
    id,
    // Start with an empty player list — players are added via "setup-players" message
    state: createGameState([]),
    clients: new Set(),
  };
}

/** Broadcast a JSON message to every client in the room */
export function broadcast(room: Room, msg: unknown): void {
  const text = JSON.stringify(msg);
  for (const client of room.clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(text);
    }
  }
}
