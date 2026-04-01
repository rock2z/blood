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
  PlayerId,
  Alignment,
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

/**
 * One row of the Spy's Grimoire view — mirrors SpyGrimoirePlayer in
 * packages/server/src/stateFilter.ts.
 */
export interface SpyGrimoirePlayer {
  id: PlayerId;
  name: string;
  trueCharacter: CharacterId;
  alignment: Alignment;
  isAlive: boolean;
  isPoisoned: boolean;
  isDrunk: boolean;
  isProtected: boolean;
}

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
  myCharacter: CharacterId;
  /** Non-null only for the Imp player */
  myDemonBluffs: CharacterId[] | null;
  slayerUsed: boolean;
  virginAbilityFired: boolean;
  executedToday: CharacterId | null;
  /** Night information delivered by the Storyteller to this player tonight */
  myNightInfo: string | null;
  /**
   * Spy-only: full character/alignment data for every player, visible each
   * night.  Null for all other characters.
   */
  mySpyGrimoire: SpyGrimoirePlayer[] | null;
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
  /** Only true for the Ravenkeeper player when they must submit their choice */
  pendingRavenkeeperChoice: boolean;
  /** True when night resolution is paused waiting for the Storyteller to choose a Minion */
  pendingMinionPromotion: boolean;
  /** True for the Imp player when it's a non-first night and they haven't submitted their kill choice yet */
  pendingImpChoice: boolean;
  /** True for the Monk player (each-night-except-first) when they haven't submitted their protection choice yet */
  pendingMonkChoice: boolean;
  /** True for the Poisoner player when they haven't submitted their poison choice yet */
  pendingPoisonerChoice: boolean;
  /** True for the Butler player when they haven't submitted their master choice yet */
  pendingButlerChoice: boolean;
  /** True for the Fortune Teller player when they haven't submitted their two targets yet */
  pendingFortuneTellerChoice: boolean;
  grimoire: PlayerGrimoire;
  /** Announcements from the previous night shown to all players at the start of each day */
  dayAnnouncements: string[];
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
    const wsBase = import.meta.env.VITE_WS_URL ?? `ws://${location.host}`;
    const wsUrl = `${wsBase}/ws?room=${encodeURIComponent(roomId)}`;
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
