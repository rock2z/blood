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
      className="fixed top-4 right-4 px-3 py-1.5 text-xs font-semibold bg-zinc-800 text-zinc-300 ring-1 ring-inset ring-white/[0.1] rounded-xl hover:bg-zinc-700 hover:text-white transition-colors duration-150 z-50 cursor-pointer"
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
        <div className="text-center space-y-4">
          <div className="text-5xl">🕰️</div>
          <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
          <p className="text-zinc-600 text-xs tracking-widest uppercase font-medium">
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
