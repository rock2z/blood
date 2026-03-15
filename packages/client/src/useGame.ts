/**
 * useGame — React hook for connecting to the BotC WebSocket server.
 *
 * Returns the latest StateSnapshot (or null while connecting) and a `send`
 * function for dispatching engine Actions or setup messages to the server.
 *
 * Usage:
 *   const { state, send } = useGame(roomId, "storyteller");
 *   const { state, send } = useGame(roomId, "player", "player-3");
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GameState,
  Action,
  CharacterId,
  Alignment,
  PlayerId,
} from "@botc/engine";

export type SendFn = (msg: ClientMessage) => void;

export type ClientMessage =
  | { type: "action"; payload: Action }
  | { type: "setup-players"; payload: import("@botc/engine").Player[] }
  | {
      type: "identify";
      payload: { role: "storyteller" } | { role: "player"; playerId: string };
    }
  | { type: "ping" };

// ============================================================
// Snapshot types — mirrors packages/server/src/stateFilter.ts
// ============================================================

/** Public information other players can see about any player */
export interface PublicPlayer {
  id: PlayerId;
  name: string;
  isAlive: boolean;
  ghostVoteUsed: boolean;
  seatIndex: number;
}

/** Private + public grimoire data sent to a regular player */
export interface PlayerGrimoire {
  players: PublicPlayer[];
  myTrueCharacter: CharacterId;
  myPerceivedCharacter: CharacterId;
  myAlignment: Alignment;
  myIsPoisoned: boolean;
  myIsDrunk: boolean;
  /** Non-null only for the Imp player */
  myDemonBluffs: CharacterId[] | null;
  slayerUsed: boolean;
  virginAbilityFired: boolean;
  executedToday: CharacterId | null;
}

/** Full state snapshot sent to the Storyteller */
export interface StorytellerSnapshot {
  role: "storyteller";
  state: GameState;
}

/** Filtered state snapshot sent to a regular player */
export interface PlayerSnapshot {
  role: "player";
  phase: GameState["phase"];
  day: GameState["day"];
  winner: GameState["winner"];
  voting: GameState["voting"];
  executionCandidateId: GameState["executionCandidateId"];
  executionCandidateVotes: GameState["executionCandidateVotes"];
  nominatorsUsed: GameState["nominatorsUsed"];
  nominatedToday: GameState["nominatedToday"];
  pendingRavenkeeperChoice: boolean;
  pendingMinionPromotion: boolean;
  grimoire: PlayerGrimoire;
}

export type StateSnapshot = StorytellerSnapshot | PlayerSnapshot;

export type ClientRole = "storyteller" | "player";

// ============================================================
// Hook
// ============================================================

export function useGame(
  roomId: string,
  role: ClientRole,
  playerId?: string,
): { state: StateSnapshot | null; send: SendFn } {
  const [state, setState] = useState<StateSnapshot | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const send = useCallback<SendFn>((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    const wsUrl = `ws://${location.host}/ws?room=${encodeURIComponent(roomId)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Declare identity immediately so server sends the right snapshot filter
      const payload =
        role === "storyteller"
          ? { role: "storyteller" as const }
          : { role: "player" as const, playerId: playerId ?? "" };
      ws.send(JSON.stringify({ type: "identify", payload }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          payload: unknown;
        };
        if (msg.type === "snapshot") {
          setState(msg.payload as StateSnapshot);
        } else if (msg.type === "error") {
          console.error("[server error]", msg.payload);
        }
      } catch {
        console.error("[ws] failed to parse message", event.data);
      }
    };

    ws.onerror = (err) => console.error("[ws] error", err);

    // Keepalive ping every 20 s
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 20_000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [roomId, role, playerId]);

  return { state, send };
}
