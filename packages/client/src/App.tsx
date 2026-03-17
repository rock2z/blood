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
      className="fixed top-4 right-4 px-3 py-1.5 text-xs font-semibold bg-white/[0.06] backdrop-blur-md text-slate-300 border border-white/[0.1] rounded-xl hover:bg-white/[0.12] hover:border-white/[0.22] hover:text-white transition-all duration-200 z-50 cursor-pointer"
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
      <div className="min-h-screen flex items-center justify-center">
        <LanguageSwitcher />
        <div className="text-center space-y-5 animate-glow-in">
          <div className="text-6xl animate-pulse-slow">🕰️</div>
          <div className="h-px w-28 mx-auto bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent" />
          <p className="text-slate-500 text-xs tracking-widest uppercase">
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
