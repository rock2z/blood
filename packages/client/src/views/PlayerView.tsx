/**
 * PlayerView — player's perspective.
 *
 * Shows the player's own private character token, alignment, and any special
 * status (poisoned, drunk, demon bluffs), plus public information about all
 * seats (alive/dead, vote state).
 *
 * Receives a PlayerSnapshot from the server — only public info + the
 * connected player's own private data.  No other player's role is visible.
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Action,
  TB_BY_ALIGNMENT,
  TROUBLE_BREWING_CHARACTERS,
} from "@botc/engine";
import { PlayerSnapshot, PublicPlayer, SendFn } from "../useGame";

// Keep in sync with engine character data by deriving from TB_BY_ALIGNMENT
// (packages/engine/src/data/troubleBrewing.ts) rather than hardcoding IDs.
const EVIL_CHARACTERS = new Set([
  ...TB_BY_ALIGNMENT.minions,
  ...TB_BY_ALIGNMENT.demons,
]);

const cx = (...classes: (string | false | undefined | null)[]) =>
  classes.filter(Boolean).join(" ");

interface Props {
  state: PlayerSnapshot;
  send: SendFn;
  playerId: string | undefined;
}

export function PlayerView({
  state,
  send,
  playerId,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const { phase, day, winner, grimoire, voting, executionCandidateId } = state;
  const dispatch = (action: Action) =>
    send({ type: "action", payload: action });

  return (
    <div className="min-h-screen text-slate-100">
      <div className="max-w-md mx-auto px-4 py-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pr-16">
          <h1 className="text-sm font-bold whitespace-nowrap">
            <span className="text-rose-400">Blood</span>
            <span className="text-white"> on the Clocktower</span>
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cx(
                phase === "first-night" || phase === "night"
                  ? "badge-night"
                  : "badge-day",
                "capitalize",
              )}
            >
              {phase}
            </span>
            <span className="text-xs text-zinc-600 font-mono tabular-nums">
              D{day}
            </span>
          </div>
        </div>

        {/* Winner banner */}
        {winner && (
          <div
            className={cx(
              "mb-6 p-4 rounded-2xl text-center text-base font-bold",
              winner === "good"
                ? "bg-sky-950 ring-1 ring-inset ring-sky-500/40 text-sky-300"
                : "bg-rose-950 ring-1 ring-inset ring-rose-500/40 text-rose-300",
            )}
          >
            🏆 {t("player.wins", { winner: winner.toUpperCase() })}
          </div>
        )}

        <DayAnnouncementsPanel state={state} />
        <NightInfoPanel grimoire={grimoire} />
        {state.pendingMinionPromotion && (
          <div className="mb-4 p-4 panel-night text-center text-sm text-indigo-300">
            {t("player.waiting_storyteller")}
          </div>
        )}
        <MyCharacterCard grimoire={grimoire} />
        <AlivePlayersPanel players={grimoire.players} />
        <PlayerList
          players={grimoire.players}
          executionCandidateId={executionCandidateId}
        />
        {voting && <ActiveVote state={state} />}

        <div className="mt-4 space-y-3">
          <ImpNightPanel
            state={state}
            playerId={playerId}
            dispatch={dispatch}
          />
          <MonkNightPanel
            state={state}
            playerId={playerId}
            dispatch={dispatch}
          />
          <PoisonerNightPanel
            state={state}
            playerId={playerId}
            dispatch={dispatch}
          />
          <ButlerNightPanel
            state={state}
            playerId={playerId}
            dispatch={dispatch}
          />
          <FortuneTellerNightPanel
            state={state}
            playerId={playerId}
            dispatch={dispatch}
          />
          <VoteButtons state={state} playerId={playerId} dispatch={dispatch} />
          <NominatePanel
            state={state}
            playerId={playerId}
            dispatch={dispatch}
          />
          <SlayerPanel state={state} playerId={playerId} dispatch={dispatch} />
          <RavenkeeperPanel
            state={state}
            playerId={playerId}
            dispatch={dispatch}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Own character card
// ============================================================

function MyCharacterCard({
  grimoire,
}: {
  grimoire: PlayerSnapshot["grimoire"];
}): React.ReactElement {
  const { t } = useTranslation();
  const { myCharacter, myDemonBluffs } = grimoire;

  const isEvil = EVIL_CHARACTERS.has(myCharacter);
  const abilityText = TROUBLE_BREWING_CHARACTERS[myCharacter]?.abilityText;

  return (
    <div
      className={cx(
        "rounded-2xl p-5 mb-5",
        isEvil
          ? "bg-rose-950 ring-1 ring-inset ring-rose-500/30 shadow-[0_0_40px_rgba(244,63,94,0.18)]"
          : "bg-sky-950 ring-1 ring-inset ring-sky-500/30 shadow-[0_0_40px_rgba(56,189,248,0.18)]",
      )}
    >
      <div className="section-label mb-3">{t("player.your_character")}</div>
      <div className="text-3xl font-black text-white capitalize tracking-tight leading-tight mb-3">
        {t(`characters.${myCharacter}`, { defaultValue: myCharacter })}
      </div>
      <span className={isEvil ? "badge-evil" : "badge-good"}>
        {isEvil ? t("player.evil") : t("player.good")}
      </span>
      {TROUBLE_BREWING_CHARACTERS[myCharacter]?.abilityText && (
        <p className="mt-3 text-xs text-slate-300 leading-snug italic">
          {TROUBLE_BREWING_CHARACTERS[myCharacter].abilityText}
        </p>
      )}

      {abilityText && (
        <div
          className={cx(
            "mt-4 pt-4 border-t text-sm leading-relaxed",
            isEvil
              ? "border-rose-500/20 text-rose-200"
              : "border-sky-500/20 text-sky-200",
          )}
        >
          <div className="section-label mb-1">{t("player.ability")}</div>
          <div className="italic">{abilityText}</div>
        </div>
      )}

      {myDemonBluffs && myDemonBluffs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-rose-500/20">
          <div className="section-label mb-2">{t("player.demon_bluffs")}</div>
          <div className="text-sm text-rose-300 font-medium">
            {myDemonBluffs
              .map((id) => t(`characters.${id}`, { defaultValue: id }))
              .join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Player list (public info only)
// ============================================================

function PlayerList({
  players,
  executionCandidateId,
}: {
  players: PublicPlayer[];
  executionCandidateId: string | null;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="mb-5">
      <h2 className="section-label mb-2">{t("player.players_title")}</h2>
      <div className="card overflow-hidden">
        {players.map((p) => {
          const isCandidate = p.id === executionCandidateId;
          return (
            <div
              key={p.id}
              className={cx(
                "flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] last:border-0 transition-colors hover:bg-white/[0.03]",
                !p.isAlive && "opacity-35",
                isCandidate && "bg-rose-950/40",
              )}
            >
              <span className="text-xs w-5 h-5 rounded-full bg-white/[0.05] text-zinc-500 flex items-center justify-center shrink-0 font-mono tabular-nums">
                {p.seatIndex + 1}
              </span>
              <span
                className={cx(
                  "flex-1 font-medium text-sm",
                  isCandidate ? "text-red-400 font-bold" : "text-slate-200",
                )}
              >
                {p.name}
              </span>
              {!p.isAlive && (
                <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full ring-1 ring-inset ring-white/[0.06]">
                  {p.ghostVoteUsed
                    ? t("player.dead_vote_used")
                    : t("player.dead")}
                </span>
              )}
              {isCandidate && (
                <span className="text-xs text-red-400 font-medium shrink-0">
                  {t("player.on_the_block")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Active vote display
// ============================================================

function ActiveVote({ state }: { state: PlayerSnapshot }): React.ReactElement {
  const { t } = useTranslation();
  const { voting, grimoire } = state;
  if (!voting) return <></>;

  const targetName =
    grimoire.players.find((p) => p.id === voting.targetId)?.name ??
    voting.targetId;

  const aliveCount = grimoire.players.filter((p) => p.isAlive).length;
  const threshold = Math.ceil(aliveCount / 2);
  const yesCount = Object.values(voting.votes).filter(Boolean).length;

  return (
    <div className="mb-5 p-4 card">
      <div className="font-semibold text-slate-100 text-sm">
        {t("player.vote_execute", { name: targetName })}
      </div>
      <div className="text-xs text-slate-400 mt-1.5">
        {t("player.need_votes", { threshold })} &nbsp;·&nbsp;{" "}
        {t("player.yes_count", { count: yesCount })}
      </div>
    </div>
  );
}

// ============================================================
// Day announcements panel — shows what happened last night
// ============================================================

function DayAnnouncementsPanel({
  state,
}: {
  state: PlayerSnapshot;
}): React.ReactElement {
  const { t } = useTranslation();

  if (
    (state.phase !== "day" && state.phase !== "game-over") ||
    state.dayAnnouncements.length === 0
  ) {
    return <></>;
  }

  return (
    <div className="mb-4 p-4 rounded-2xl bg-amber-950 ring-1 ring-inset ring-amber-500/30">
      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
        {t("player.day_announcement_title")}
      </div>
      <ul className="space-y-1">
        {state.dayAnnouncements.map((msg, i) => (
          <li key={i} className="text-slate-200 text-sm leading-relaxed">
            {msg}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// Alive players panel — quick summary of surviving players
// ============================================================

function AlivePlayersPanel({
  players,
}: {
  players: PublicPlayer[];
}): React.ReactElement {
  const { t } = useTranslation();

  const alive = players.filter((p) => p.isAlive);

  return (
    <div className="mb-4 p-4 rounded-2xl bg-emerald-950 ring-1 ring-inset ring-emerald-500/30">
      <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
        {t("player.alive_title", { count: alive.length })}
      </div>
      {alive.length === 0 ? (
        <div className="text-sm text-slate-400">{t("player.no_alive")}</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {alive.map((p) => (
            <span
              key={p.id}
              className="text-xs font-medium text-emerald-200 bg-emerald-900/60 px-2 py-1 rounded-full ring-1 ring-inset ring-emerald-500/20"
            >
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Night info panel — shows info delivered by the Storyteller
// ============================================================

function NightInfoPanel({
  grimoire,
}: {
  grimoire: PlayerSnapshot["grimoire"];
}): React.ReactElement {
  const { t } = useTranslation();

  if (grimoire.myNightInfo === null) {
    return <></>;
  }
  return (
    <div className="mb-4 p-4 panel-night">
      <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
        {t("player.night_info_title")}
      </div>
      <div className="text-slate-200 text-sm leading-relaxed">
        {grimoire.myNightInfo}
      </div>
    </div>
  );
}

// ============================================================
// Vote buttons — shown when it's this player's turn to vote
// ============================================================

function VoteButtons({
  state,
  playerId,
  dispatch,
}: {
  state: PlayerSnapshot;
  playerId: string | undefined;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();

  if (!playerId) return <></>;
  if (state.winner) return <></>;
  const { voting } = state;
  if (!voting) return <></>;

  const pendingVoter = voting.eligibleVoterIds.find(
    (id) => !(id in voting.votes),
  );
  if (pendingVoter !== playerId) {
    if (pendingVoter) {
      const voterName =
        state.grimoire.players.find((p) => p.id === pendingVoter)?.name ??
        pendingVoter;
      return (
        <div className="text-sm text-slate-400 text-center py-2">
          {t("player.waiting_for", { name: voterName })}
        </div>
      );
    }
    return <></>;
  }

  const targetName =
    state.grimoire.players.find((p) => p.id === voting.targetId)?.name ??
    voting.targetId;

  return (
    <div className="p-4 panel-day border-2">
      <div className="font-semibold text-slate-100 mb-3 text-sm">
        {t("player.your_vote_execute", { name: targetName })}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => dispatch({ type: "vote", playerId, vote: true })}
          className="btn-success flex-1 py-2.5 text-base"
        >
          {t("player.yes")}
        </button>
        <button
          onClick={() => dispatch({ type: "vote", playerId, vote: false })}
          className="btn-danger flex-1 py-2.5 text-base"
        >
          {t("player.no")}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Nominate panel — shown during day when player hasn't nominated
// ============================================================

function NominatePanel({
  state,
  playerId,
  dispatch,
}: {
  state: PlayerSnapshot;
  playerId: string | undefined;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState<string>("");

  if (!playerId) return <></>;
  if (state.phase !== "day") return <></>;
  if (state.winner) return <></>;

  const me = state.grimoire.players.find((p) => p.id === playerId);
  if (!me?.isAlive) return <></>;
  if (state.nominatorsUsed.includes(playerId)) return <></>;
  if (state.voting) return <></>;

  const eligibleTargets = state.grimoire.players.filter(
    (p) => p.isAlive && !state.nominatedToday.includes(p.id),
  );
  if (eligibleTargets.length === 0) return <></>;

  const resolvedTarget = targetId || eligibleTargets[0]?.id;

  return (
    <div className="p-4 card">
      <div className="font-semibold text-slate-100 mb-3 text-sm">
        {t("player.nominate")}
      </div>
      <div className="flex gap-2 items-center">
        <select
          value={resolvedTarget}
          onChange={(e) => setTargetId(e.target.value)}
          className="form-select flex-1"
        >
          {eligibleTargets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            dispatch({
              type: "nominate",
              nominatorId: playerId,
              targetId: resolvedTarget,
            })
          }
          className="btn-default"
        >
          {t("player.nominate")}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Slayer panel — once-per-game day ability
// ============================================================

function SlayerPanel({
  state,
  playerId,
  dispatch,
}: {
  state: PlayerSnapshot;
  playerId: string | undefined;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState<string>("");

  if (!playerId) return <></>;
  if (state.phase !== "day") return <></>;
  if (state.winner) return <></>;
  if (state.grimoire.myCharacter !== "slayer") return <></>;
  if (state.grimoire.slayerUsed) return <></>;

  const me = state.grimoire.players.find((p) => p.id === playerId);
  if (!me?.isAlive) return <></>;

  const targets = state.grimoire.players.filter((p) => p.isAlive);
  const resolvedTarget = targetId || targets[0]?.id;

  return (
    <div className="p-4 panel-purple">
      <div className="font-semibold text-slate-100 mb-3 text-sm">
        {t("player.slayer_ability")}
      </div>
      <div className="flex gap-2 items-center">
        <select
          value={resolvedTarget}
          onChange={(e) => setTargetId(e.target.value)}
          className="form-select flex-1"
        >
          {targets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            dispatch({
              type: "slayer-shoot",
              slayerId: playerId,
              targetId: resolvedTarget,
            })
          }
          className="btn-purple"
        >
          {t("player.shoot")}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Imp night panel — choose who to kill tonight
// ============================================================

function ImpNightPanel({
  state,
  playerId,
  dispatch,
}: {
  state: PlayerSnapshot;
  playerId: string | undefined;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState<string>("");

  if (!playerId) return <></>;
  if (!state.pendingImpChoice) return <></>;

  const allPlayers = state.grimoire.players;
  const resolvedTarget = targetId || allPlayers[0]?.id;

  return (
    <div className="p-4 panel-evil border-2">
      <div className="font-semibold text-slate-100 mb-1 text-sm">
        {t("player.imp_kill_title")}
      </div>
      <div className="text-xs text-slate-400 mb-3">
        {t("player.imp_kill_desc")}
      </div>
      <div className="flex gap-2 items-center">
        <select
          value={resolvedTarget}
          onChange={(e) => setTargetId(e.target.value)}
          className="form-select flex-1"
        >
          {allPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {!p.isAlive ? ` ${t("player.dead_suffix")}` : ""}
              {p.id === playerId ? ` ${t("player.imp_self_label")}` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            dispatch({
              type: "night-choice",
              playerId,
              targetIds: [resolvedTarget],
            })
          }
          className="btn-danger"
        >
          {t("player.imp_confirm")}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Monk night panel — choose a player to protect
// ============================================================

function MonkNightPanel({
  state,
  playerId,
  dispatch,
}: {
  state: PlayerSnapshot;
  playerId: string | undefined;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState<string>("");

  if (!playerId) return <></>;
  if (!state.pendingMonkChoice) return <></>;

  const targets = state.grimoire.players.filter(
    (p) => p.isAlive && p.id !== playerId,
  );
  const resolvedTarget = targetId || targets[0]?.id;

  return (
    <div className="p-4 panel-good border-2">
      <div className="font-semibold text-slate-100 mb-1 text-sm">
        {t("player.monk_protect_title")}
      </div>
      <div className="text-xs text-slate-400 mb-3">
        {t("player.monk_protect_desc")}
      </div>
      <div className="flex gap-2 items-center">
        <select
          value={resolvedTarget}
          onChange={(e) => setTargetId(e.target.value)}
          className="form-select flex-1"
        >
          {targets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            dispatch({
              type: "night-choice",
              playerId,
              targetIds: [resolvedTarget],
            })
          }
          className="btn-primary"
        >
          {t("player.monk_confirm")}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Poisoner night panel — choose a player to poison
// ============================================================

function PoisonerNightPanel({
  state,
  playerId,
  dispatch,
}: {
  state: PlayerSnapshot;
  playerId: string | undefined;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState<string>("");

  if (!playerId) return <></>;
  if (!state.pendingPoisonerChoice) return <></>;

  const targets = state.grimoire.players.filter((p) => p.isAlive);
  const resolvedTarget = targetId || targets[0]?.id;

  return (
    <div className="p-4 panel-evil border-2">
      <div className="font-semibold text-slate-100 mb-1 text-sm">
        {t("player.poisoner_title")}
      </div>
      <div className="text-xs text-slate-400 mb-3">
        {t("player.poisoner_desc")}
      </div>
      <div className="flex gap-2 items-center">
        <select
          value={resolvedTarget}
          onChange={(e) => setTargetId(e.target.value)}
          className="form-select flex-1"
        >
          {targets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            dispatch({
              type: "night-choice",
              playerId,
              targetIds: [resolvedTarget],
            })
          }
          className="btn-danger"
        >
          {t("player.poisoner_confirm")}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Butler night panel — choose a master player
// ============================================================

function ButlerNightPanel({
  state,
  playerId,
  dispatch,
}: {
  state: PlayerSnapshot;
  playerId: string | undefined;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState<string>("");

  if (!playerId) return <></>;
  if (!state.pendingButlerChoice) return <></>;

  const targets = state.grimoire.players.filter(
    (p) => p.isAlive && p.id !== playerId,
  );
  const resolvedTarget = targetId || targets[0]?.id;

  return (
    <div className="p-4 card border-2 border-purple-500/30">
      <div className="font-semibold text-slate-100 mb-1 text-sm">
        {t("player.butler_title")}
      </div>
      <div className="text-xs text-slate-400 mb-3">
        {t("player.butler_desc")}
      </div>
      <div className="flex gap-2 items-center">
        <select
          value={resolvedTarget}
          onChange={(e) => setTargetId(e.target.value)}
          className="form-select flex-1"
        >
          {targets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            dispatch({
              type: "night-choice",
              playerId,
              targetIds: [resolvedTarget],
            })
          }
          className="btn-default"
        >
          {t("player.butler_confirm")}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Fortune Teller night panel — choose 2 players to check
// ============================================================

function FortuneTellerNightPanel({
  state,
  playerId,
  dispatch,
}: {
  state: PlayerSnapshot;
  playerId: string | undefined;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const allPlayers = state.grimoire.players.filter((p) => p.isAlive);
  const [pick1, setPick1] = useState<string>(allPlayers[0]?.id ?? "");
  const [pick2, setPick2] = useState<string>(allPlayers[1]?.id ?? "");

  if (!playerId) return <></>;
  if (!state.pendingFortuneTellerChoice) return <></>;

  const resolved1 = pick1 || (allPlayers[0]?.id ?? "");
  const resolved2 = pick2 || (allPlayers[1]?.id ?? "");

  const canConfirm = resolved1 && resolved2 && resolved1 !== resolved2;

  return (
    <div className="p-4 panel-good border-2">
      <div className="font-semibold text-slate-100 mb-1 text-sm">
        {t("player.ft_title")}
      </div>
      <div className="text-xs text-slate-400 mb-3">{t("player.ft_desc")}</div>
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={resolved1}
          onChange={(e) => setPick1(e.target.value)}
          className="form-select flex-1"
        >
          {allPlayers
            .filter((p) => p.id !== resolved2)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <span className="text-slate-500 text-xs">&amp;</span>
        <select
          value={resolved2}
          onChange={(e) => setPick2(e.target.value)}
          className="form-select flex-1"
        >
          {allPlayers
            .filter((p) => p.id !== resolved1)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <button
          disabled={!canConfirm}
          onClick={() =>
            dispatch({
              type: "night-choice",
              playerId,
              targetIds: [resolved1, resolved2],
            })
          }
          className="btn-primary"
        >
          {t("player.ft_confirm")}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Ravenkeeper panel — choose a player to learn their character
// ============================================================

function RavenkeeperPanel({
  state,
  playerId,
  dispatch,
}: {
  state: PlayerSnapshot;
  playerId: string | undefined;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState<string>("");

  if (!playerId) return <></>;
  if (!state.pendingRavenkeeperChoice) return <></>;
  if (state.grimoire.myCharacter !== "ravenkeeper") return <></>;

  const allPlayers = state.grimoire.players;
  const resolvedTarget = targetId || allPlayers[0]?.id;

  return (
    <div className="p-4 panel-good border-2">
      <div className="font-semibold text-slate-100 mb-3 text-sm">
        {t("player.ravenkeeper_title")}
      </div>
      <div className="flex gap-2 items-center">
        <select
          value={resolvedTarget}
          onChange={(e) => setTargetId(e.target.value)}
          className="form-select flex-1"
        >
          {allPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.isAlive ? "" : t("player.dead_suffix")}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            dispatch({ type: "ravenkeeper-choice", targetId: resolvedTarget })
          }
          className="btn-primary"
        >
          {t("player.choose")}
        </button>
      </div>
    </div>
  );
}
