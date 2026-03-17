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
import { useTranslation } from "react-i18next";
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

function LanguageSwitcher(): React.ReactElement {
  const { i18n, t } = useTranslation();
  const current = i18n.language;

  const toggle = () => {
    i18n.changeLanguage(current === "en" ? "zh" : "en");
  };

  return (
    <button
      onClick={toggle}
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        padding: "4px 10px",
        fontSize: 13,
        cursor: "pointer",
        border: "1px solid #ccc",
        borderRadius: 4,
        background: "white",
        zIndex: 1000,
      }}
    >
      {current === "en" ? t("lang.zh") : t("lang.en")}
    </button>
  );
}

export function App(): React.ReactElement {
  const roomId = getRoomId();
  const role = getRole();
  const playerId = getPlayerId();
  const { state, send } = useGame(roomId, role, playerId);
  const { t } = useTranslation();

  if (!state) {
    return (
      <div
        style={{ fontFamily: "sans-serif", padding: 32, textAlign: "center" }}
      >
        <LanguageSwitcher />
        <p>{t("app.connecting", { room: roomId })}</p>
      </div>
    );
  }

  if (state.role === "storyteller") {
    return (
      <>
        <LanguageSwitcher />
        <StorytellerView state={state.state} send={send} />
      </>
    );
  }

  return (
    <>
      <LanguageSwitcher />
      <PlayerView state={state} send={send} playerId={playerId} />
    </>
  );
}
