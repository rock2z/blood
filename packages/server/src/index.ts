/**
 * @botc/server — Blood on the Clocktower WebSocket game server
 *
 * Architecture:
 *   - One WebSocket server, multiple rooms (one game per room).
 *   - Each client identifies itself as either the Storyteller or a named player.
 *   - The engine state is authoritative; clients receive the subset of state
 *     they are allowed to see.
 *   - Messages are JSON. Protocol defined in ./protocol.ts.
 */

import { WebSocketServer } from "ws";
import { Room, createRoom } from "./room";
import { handleMessage, ClientSocket, sendSnapshot } from "./handler";

const PORT = Number(process.env.PORT ?? 8080);

const wss = new WebSocketServer({ port: PORT });

/** Map from roomId → Room */
const rooms = new Map<string, Room>();

/** Find or create a room by ID */
function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = createRoom(roomId);
    rooms.set(roomId, room);
    console.log(`[room] created ${roomId}`);
  }
  return room;
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const roomId = url.searchParams.get("room") ?? "default";

  const room = getOrCreateRoom(roomId);

  const client = ws as ClientSocket;
  room.clients.add(client);
  client.roomId = roomId;
  // Default identity until the client sends "identify"; treated as anonymous player
  client.identity = { role: "player" };

  console.log(
    `[ws] client connected  room=${roomId}  total=${room.clients.size}`,
  );

  // Send current snapshot with default (player) filtering until client identifies
  sendSnapshot(client, room);

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(client, room, msg);
    } catch (err) {
      console.error("[ws] bad message", err);
      client.send(JSON.stringify({ type: "error", payload: String(err) }));
    }
  });

  ws.on("close", () => {
    room.clients.delete(client);
    console.log(
      `[ws] client disconnected  room=${roomId}  remaining=${room.clients.size}`,
    );
    // Clean up empty rooms
    if (room.clients.size === 0) {
      rooms.delete(roomId);
      console.log(`[room] removed ${roomId} (empty)`);
    }
  });

  ws.on("error", (err) => {
    console.error(`[ws] error  room=${roomId}`, err);
  });
});

console.log(
  `[server] BotC WebSocket server listening on ws://localhost:${PORT}`,
);
