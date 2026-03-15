/**
 * App — top-level component.
 *
 * URL params:
 *   ?room=<id>          Room to join (default: "default")
 *   ?role=storyteller   Show Storyteller view (default: player view)
 *   ?playerId=<id>      Player identity; required for the player view to show
 *                       private character info (e.g. ?playerId=player-3)
 */

import React from "react";
import { useGame } from "./useGame";
import { StorytellerView } from "./views/StorytellerView";
import { PlayerView } from "./views/PlayerView";

function getRoomId(): string {
  return new URLSearchParams(location.search).get("room") ?? "default";
}

function getRole(): "storyteller" | "player" {
  return new URLSearchParams(location.search).get("role") === "storyteller"
    ? "storyteller"
    : "player";
}

function getPlayerId(): string | undefined {
  return new URLSearchParams(location.search).get("playerId") ?? undefined;
}

export function App(): React.ReactElement {
  const roomId = getRoomId();
  const role = getRole();
  const playerId = getPlayerId();
  const { state, send } = useGame(roomId, role, playerId);

  if (!state) {
    return (
      <div
        style={{ fontFamily: "sans-serif", padding: 32, textAlign: "center" }}
      >
        <p>
          Connecting to room <strong>{roomId}</strong>…
        </p>
      </div>
    );
  }

  if (state.role === "storyteller") {
    return <StorytellerView state={state.state} send={send} />;
  }

  return <PlayerView state={state} />;
}
