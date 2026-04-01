/**
 * HomePage — lobby showing all active rooms with quick-join links.
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface RoomPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  seatIndex: number;
}

interface RoomInfo {
  id: string;
  phase: string;
  players: RoomPlayer[];
}

interface RoomsResponse {
  rooms: RoomInfo[];
}

function phaseLabel(phase: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    setup: t("home.phase_setup"),
    "first-night": t("home.phase_first_night"),
    day: t("home.phase_day"),
    night: t("home.phase_night"),
    "game-over": t("home.phase_game_over"),
  };
  return map[phase] ?? phase;
}

// In dev (VITE_API_BASE_URL unset) fetch("/api/rooms") uses the Vite proxy.
// In production set VITE_API_BASE_URL=https://blood-64o1.onrender.com.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function playerLink(roomId: string, player: RoomPlayer): string {
  return `/?room=${encodeURIComponent(roomId)}&playerId=${encodeURIComponent(player.id)}`;
}

function storytellerLink(roomId: string): string {
  return `/?room=${encodeURIComponent(roomId)}&role=storyteller`;
}

export function HomePage(): React.ReactElement {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newRoomId, setNewRoomId] = useState("");

  const fetchRooms = () => {
    fetch(`${API_BASE}/api/rooms`)
      .then((r) => r.json() as Promise<RoomsResponse>)
      .then((data) => {
        setRooms(data.rooms);
        setError(null);
      })
      .catch(() => setError(t("home.fetch_error")));
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinNew = () => {
    const id = newRoomId.trim() || "default";
    window.location.href = storytellerLink(id);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-4xl">🕰️</div>
          <h1 className="text-2xl font-bold tracking-wide text-zinc-100">
            {t("app.title")}
          </h1>
          <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
          <p className="text-zinc-500 text-sm">{t("home.subtitle")}</p>
        </div>

        {/* Create / join a room */}
        <div className="bg-zinc-900 border border-white/[0.06] rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">
            {t("home.new_room")}
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoomId}
              onChange={(e) => setNewRoomId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinNew()}
              placeholder={t("home.room_id_placeholder")}
              className="flex-1 bg-zinc-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500/50"
            />
            <button
              onClick={handleJoinNew}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {t("home.open_as_storyteller")}
            </button>
          </div>
        </div>

        {/* Room list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">
            {rooms !== null
              ? t("home.active_rooms", { count: rooms.length })
              : !error
                ? t("home.loading")
                : null}
          </h2>

          {error && <p className="text-rose-400 text-sm">{error}</p>}

          {rooms !== null && rooms.length === 0 && (
            <p className="text-zinc-600 text-sm">{t("home.no_rooms")}</p>
          )}

          {rooms?.map((room) => (
            <div
              key={room.id}
              className="bg-zinc-900 border border-white/[0.06] rounded-xl p-5 space-y-4"
            >
              {/* Room header */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold text-zinc-100">{room.id}</span>
                  <div className="text-xs text-zinc-500">
                    {phaseLabel(room.phase, t)} &middot;{" "}
                    {t("home.player_count", { count: room.players.length })}
                  </div>
                </div>
                <a
                  href={storytellerLink(room.id)}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-900/60 hover:bg-amber-800/70 text-amber-300 ring-1 ring-inset ring-amber-500/20 rounded-lg transition-colors"
                >
                  {t("home.storyteller")}
                </a>
              </div>

              {/* Player list */}
              {room.players.length === 0 ? (
                <p className="text-zinc-600 text-xs">{t("home.no_players")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {room.players
                    .slice()
                    .sort((a, b) => a.seatIndex - b.seatIndex)
                    .map((player) => (
                      <a
                        key={player.id}
                        href={playerLink(room.id, player)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg ring-1 ring-inset transition-colors ${
                          player.isAlive
                            ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 ring-white/[0.08]"
                            : "bg-zinc-900 hover:bg-zinc-800 text-zinc-500 ring-white/[0.04] line-through"
                        }`}
                      >
                        {player.name || player.id}
                      </a>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
