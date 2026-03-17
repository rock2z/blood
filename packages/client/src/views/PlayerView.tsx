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
import { Action, TB_BY_ALIGNMENT } from "@botc/engine";
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-md mx-auto px-4 py-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pr-16">
          <h1 className="text-xl font-bold text-slate-100">
            {t("player.title")}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 rounded-md capitalize">
              {phase}
            </span>
            <span className="text-xs text-slate-500">
              {t("player.day")} {day}
            </span>
          </div>
        </div>

        {/* Winner banner */}
        {winner && (
          <div
            className={cx(
              "mb-6 p-4 rounded-xl text-center text-lg font-bold",
              winner === "good"
                ? "bg-blue-900/50 border-2 border-blue-500 text-blue-300"
                : "bg-red-900/50 border-2 border-red-500 text-red-300",
            )}
          >
            🏆 {t("player.wins", { winner: winner.toUpperCase() })}
          </div>
        )}

        <NightInfoPanel grimoire={grimoire} phase={phase} />
        <MyCharacterCard grimoire={grimoire} />
        <PlayerList
          players={grimoire.players}
          executionCandidateId={executionCandidateId}
        />
        {voting && <ActiveVote state={state} />}

        <div className="mt-4 space-y-3">
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

  return (
    <div
      className={cx(
        "border-2 rounded-2xl p-5 mb-5",
        isEvil
          ? "border-red-500 bg-gradient-to-br from-red-950/50 to-slate-900"
          : "border-blue-500 bg-gradient-to-br from-blue-950/50 to-slate-900",
      )}
    >
      <div className="section-label mb-1">{t("player.your_character")}</div>
      <div className="text-3xl font-bold text-slate-100 capitalize mt-1 mb-1">
        {t(`characters.${myCharacter}`, { defaultValue: myCharacter })}
      </div>
      <div
        className={cx(
          "text-sm font-semibold",
          isEvil ? "text-red-400" : "text-blue-400",
        )}
      >
        {isEvil ? t("player.evil") : t("player.good")}
      </div>

      {myDemonBluffs && myDemonBluffs.length > 0 && (
        <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-lg">
          <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">
            {t("player.demon_bluffs")}
          </div>
          <div className="text-sm text-red-300">
            {myDemonBluffs
              .map((id) => t(`characters.${id}`, { defaultValue: id }))
              .join(", ")}
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
                "flex items-center gap-3 px-4 py-3 border-b border-slate-800 last:border-0 transition-colors",
                !p.isAlive && "opacity-40",
                isCandidate && "bg-red-950/30",
              )}
            >
              <span className="text-slate-600 text-xs w-5 text-right shrink-0">
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
                <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-md">
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
// Night info panel — shows info delivered by the Storyteller
// ============================================================

function NightInfoPanel({
  grimoire,
  phase,
}: {
  grimoire: PlayerSnapshot["grimoire"];
  phase: PlayerSnapshot["phase"];
}): React.ReactElement {
  const { t } = useTranslation();

  if (
    (phase !== "first-night" && phase !== "night") ||
    grimoire.myNightInfo === null
  ) {
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
    <div className="p-4 bg-amber-950/30 border-2 border-amber-600/70 rounded-xl">
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
