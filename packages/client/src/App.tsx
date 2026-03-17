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
      className="fixed top-3 right-3 px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors z-50 cursor-pointer"
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LanguageSwitcher />
        <div className="text-center">
          <div className="text-5xl mb-5">🕰️</div>
          <p className="text-slate-400 text-base">
            {t("app.connecting", { room: roomId })}
          </p>
        </div>
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
