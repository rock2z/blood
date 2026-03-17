/**
 * StorytellerView — Storyteller-only UI.
 *
 * Shows the full Grimoire (all roles, alive/dead status, night state),
 * phase controls, night-order walk-through, and action buttons for every
 * game event.  Every point where the rules say "Storyteller may/might"
 * is a UI prompt here.
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  GameState,
  Player,
  Action,
  CharacterId,
  buildTokenBag,
  findDrunkFakeCharacter,
  getFirstNightOrder,
  getEachNightOrder,
  getFirstNightPreSteps,
  TROUBLE_BREWING_CHARACTERS,
  TB_BY_ALIGNMENT,
} from "@botc/engine";
import { SendFn } from "../useGame";

const cx = (...classes: (string | false | undefined | null)[]) =>
  classes.filter(Boolean).join(" ");

interface Props {
  state: GameState;
  send: SendFn;
}

export function StorytellerView({ state, send }: Props): React.ReactElement {
  const { t } = useTranslation();
  const dispatch = (action: Action) =>
    send({ type: "action", payload: action });

  const hasPlayers = state.grimoire.players.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 font-sans">
      <h1 className="text-2xl font-bold mb-6 pr-16">
        {t("app.title")}{" "}
        <span className="text-amber-400 font-normal">— Storyteller</span>
      </h1>

      {!hasPlayers ? (
        <SetupPlayers send={send} />
      ) : (
        <>
          <PhaseBar state={state} dispatch={dispatch} />
          <div className="my-6 border-t border-slate-800" />
          <GrimoireTable state={state} dispatch={dispatch} />
          <div className="my-6 border-t border-slate-800" />
          {(state.phase === "first-night" || state.phase === "night") && (
            <NightPanel state={state} dispatch={dispatch} />
          )}
          {state.phase === "day" && (
            <DayControls state={state} dispatch={dispatch} />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Setup: add players (Storyteller only, pre-game)
// ============================================================

const DEFAULT_NAMES = [
  "Alice",
  "Bob",
  "Carol",
  "Dave",
  "Eve",
  "Frank",
  "Grace",
];

function buildRandomBag(names: string[]): CharacterId[] {
  const n = names.length;
  if (n < 5 || n > 15) return [];
  const baronInPlay = false; // Storyteller can toggle later
  return buildTokenBag({ playerCount: n, baronInPlay });
}

function buildPlayers(names: string[], bag: CharacterId[]): Player[] {
  const drunkFake = findDrunkFakeCharacter(bag, [...TB_BY_ALIGNMENT.townsfolk]);

  return names.map((rawName, i) => {
    const charId = bag[i];
    const char = TROUBLE_BREWING_CHARACTERS[charId];
    const isDrunk = charId === "drunk";

    return {
      id: `player-${i + 1}`,
      name: rawName.trim() || `Player ${i + 1}`,
      trueCharacter: charId,
      perceivedCharacter: isDrunk && drunkFake ? drunkFake : charId,
      alignment: char.alignment,
      isAlive: true,
      ghostVoteUsed: false,
      isPoisoned: false,
      isDrunk,
      isProtected: false,
      seatIndex: i,
    };
  });
}

function SetupPlayers({ send }: { send: SendFn }): React.ReactElement {
  const { t } = useTranslation();
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [bag, setBag] = useState<CharacterId[]>(() =>
    buildRandomBag(DEFAULT_NAMES),
  );

  const reroll = () => setBag(buildRandomBag(names));

  const updateName = (i: number, value: string) => {
    const next = [...names];
    next[i] = value;
    setNames(next);
  };

  const addPlayer = () => {
    if (names.length < 15) {
      const next = [...names, `Player ${names.length + 1}`];
      setNames(next);
      setBag(buildRandomBag(next));
    }
  };

  const removePlayer = (i: number) => {
    if (names.length > 5) {
      const next = names.filter((_, idx) => idx !== i);
      setNames(next);
      setBag(buildRandomBag(next));
    }
  };

  const handleStart = () => {
    if (bag.length !== names.length) return;
    const players = buildPlayers(names, bag);
    send({ type: "setup-players", payload: players });
    send({ type: "action", payload: { type: "start-game" } });
  };

  const valid = names.length >= 5 && names.length <= 15;

  const players =
    valid && bag.length === names.length ? buildPlayers(names, bag) : [];

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-slate-100 mb-2">
        {t("setup.title", { count: names.length })}
      </h2>
      <p className="text-sm text-slate-400 mb-5">
        {t("setup.instructions_1")}{" "}
        <strong className="text-slate-300">
          {t("setup.instructions_roll")}
        </strong>{" "}
        {t("setup.instructions_2")}{" "}
        <strong className="text-slate-300">
          {t("setup.instructions_start")}
        </strong>{" "}
        {t("setup.instructions_3")}
      </p>

      <div className="card overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {[
                t("setup.seat"),
                t("setup.name"),
                t("setup.character"),
                t("setup.align"),
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((name, i) => {
              const p = players[i];
              const charId = p?.trueCharacter;
              const charName = charId
                ? t(`characters.${charId}`, { defaultValue: charId })
                : "—";
              const isEvil =
                p?.alignment === "Minion" || p?.alignment === "Demon";
              return (
                <tr
                  key={i}
                  className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-3 py-2 text-center text-slate-500 w-10">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={name}
                      onChange={(e) => updateName(i, e.target.value)}
                      className="form-input w-32"
                    />
                  </td>
                  <td
                    className={cx(
                      "px-3 py-2 font-medium",
                      isEvil ? "text-red-400" : "text-blue-400",
                    )}
                  >
                    {charName}
                    {p?.isDrunk && (
                      <span className="text-amber-500 ml-2 text-xs">
                        (
                        {t("setup.believes", {
                          character: t(`characters.${p.perceivedCharacter}`, {
                            defaultValue: p.perceivedCharacter,
                          }),
                        })}
                        )
                      </span>
                    )}
                  </td>
                  <td
                    className={cx(
                      "px-3 py-2 text-sm font-medium",
                      isEvil ? "text-red-400" : "text-blue-400",
                    )}
                  >
                    {p?.alignment ?? "—"}
                  </td>
                  <td className="px-3 py-2 w-10">
                    <button
                      onClick={() => removePlayer(i)}
                      disabled={names.length <= 5}
                      className="btn-default btn-sm text-slate-400 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={addPlayer}
          disabled={names.length >= 15}
          className="btn-default"
        >
          {t("setup.add_player")}
        </button>
        <button onClick={reroll} className="btn-default">
          {t("setup.reroll")}
        </button>
        <button
          onClick={handleStart}
          disabled={!valid}
          className="btn-success px-5"
        >
          {t("setup.start_game")}
        </button>
      </div>

      {!valid && (
        <p className="text-red-400 text-sm mt-3">
          {t("setup.player_count_error")}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Phase bar
// ============================================================

function PhaseBar({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { phase, day, winner } = state;

  const phaseColors: Record<string, string> = {
    "first-night": "bg-indigo-800 text-indigo-200",
    night: "bg-indigo-800 text-indigo-200",
    day: "bg-amber-700 text-amber-100",
  };
  const phaseClass = phaseColors[phase] ?? "bg-slate-700 text-slate-200";

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span
          className={cx(
            "px-3 py-1 rounded-lg text-sm font-semibold capitalize",
            phaseClass,
          )}
        >
          {phase}
        </span>
        <span className="text-slate-400 text-sm">
          {t("phase_bar.day")} {day}
        </span>
      </div>

      {winner && (
        <span
          className={cx(
            "px-4 py-1.5 rounded-lg font-bold text-sm",
            winner === "good"
              ? "bg-blue-700 text-white"
              : "bg-red-700 text-white",
          )}
        >
          🏆 {t("phase_bar.wins", { winner: winner.toUpperCase() })}
        </span>
      )}

      {!winner && (
        <div className="flex gap-2 flex-wrap">
          {(phase === "first-night" || phase === "night") &&
            !state.pendingRavenkeeperChoice &&
            !state.pendingMinionPromotion && (
              <button
                onClick={() => dispatch({ type: "resolve-night" })}
                className="btn-primary"
              >
                {t("phase_bar.resolve_night", { day: day + 1 })}
              </button>
            )}
          {phase === "day" && (
            <>
              <button
                onClick={() => dispatch({ type: "skip-execution" })}
                className="btn-default"
              >
                {t("phase_bar.end_day")}
              </button>
              <button
                onClick={() => dispatch({ type: "advance-to-night" })}
                className="btn-default"
              >
                {t("phase_bar.advance_to_night")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Grimoire table
// ============================================================

function GrimoireTable({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { grimoire } = state;

  const columns = [
    t("grimoire.seat"),
    t("grimoire.name"),
    t("grimoire.character"),
    t("grimoire.align"),
    t("grimoire.alive"),
    t("grimoire.poisoned"),
    t("grimoire.drunk"),
    t("grimoire.protected"),
    t("grimoire.ghost"),
  ];

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-200 mb-3">
        {t("grimoire.title")}
      </h2>
      <div className="card overflow-x-auto mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {columns.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grimoire.players.map((p) => (
              <PlayerRow
                key={p.id}
                player={p}
                state={state}
                dispatch={dispatch}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Grimoire metadata */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          {t("grimoire.imp_target")}:{" "}
          <span className="text-slate-400">{grimoire.impTarget ?? "—"}</span>
        </span>
        <span>
          {t("grimoire.monk_protecting")}:{" "}
          <span className="text-slate-400">
            {grimoire.monkProtectionTarget ?? "—"}
          </span>
        </span>
        <span>
          {t("grimoire.poisoner_target")}:{" "}
          <span className="text-slate-400">
            {grimoire.poisonerTarget ?? "—"}
          </span>
        </span>
        <span>
          {t("grimoire.butler_master")}:{" "}
          <span className="text-slate-400">{grimoire.butlerMaster ?? "—"}</span>
        </span>
        <span>
          {t("grimoire.ft_red_herring")}:{" "}
          <span className="text-slate-400">
            {grimoire.fortuneTellerRedHerring ?? "—"}
          </span>
        </span>
      </div>

      {grimoire.demonBluffs.length > 0 && (
        <div className="mt-2 text-xs text-red-400">
          {t("grimoire.demon_bluffs")}:{" "}
          <span className="text-red-300">
            {grimoire.demonBluffs
              .map((id) => t(`characters.${id}`, { defaultValue: id }))
              .join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  state,
  dispatch: _dispatch,
}: {
  player: Player;
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const {
    id,
    seatIndex,
    name,
    trueCharacter,
    alignment,
    isAlive,
    isPoisoned,
    isDrunk,
    isProtected,
    ghostVoteUsed,
  } = player;

  const isCandidate = state.executionCandidateId === id;
  const isEvil = alignment === "Demon" || alignment === "Minion";

  const rowClass = cx(
    "border-b border-slate-800 last:border-0 transition-colors",
    !isAlive && "opacity-40",
    isPoisoned && "bg-red-950/20",
    isDrunk && !isPoisoned && "bg-yellow-950/20",
    isCandidate && "bg-red-950/30",
  );

  const cell = (content: React.ReactNode, extra?: string) => (
    <td className={cx("px-3 py-2.5 text-center text-sm", extra)}>{content}</td>
  );

  return (
    <tr className={rowClass}>
      {cell(<span className="text-slate-500">{seatIndex + 1}</span>)}
      {cell(
        <span
          className={cx(
            "font-medium",
            isCandidate ? "text-red-400 font-bold" : "text-slate-200",
          )}
        >
          {name}
        </span>,
        "text-left",
      )}
      {cell(
        <span className="capitalize text-slate-300">
          {t(`characters.${trueCharacter}`, { defaultValue: trueCharacter })}
        </span>,
        "text-left",
      )}
      {cell(
        <span
          className={cx(
            "text-xs font-semibold px-1.5 py-0.5 rounded",
            isEvil
              ? "text-red-400 bg-red-950/40"
              : "text-blue-400 bg-blue-950/40",
          )}
        >
          {alignment}
        </span>,
      )}
      {cell(
        <span className={isAlive ? "text-emerald-400" : "text-slate-600"}>
          {isAlive ? "✓" : "✗"}
        </span>,
      )}
      {cell(<span className="text-red-400">{isPoisoned ? "☠" : ""}</span>)}
      {cell(<span className="text-amber-400">{isDrunk ? "🍺" : ""}</span>)}
      {cell(<span className="text-blue-400">{isProtected ? "🛡" : ""}</span>)}
      {cell(
        <span className={ghostVoteUsed ? "text-slate-600" : "text-slate-400"}>
          {ghostVoteUsed ? "✗" : isAlive ? "" : "✓"}
        </span>,
      )}
    </tr>
  );
}

// ============================================================
// Night panel — step-by-step night order + discretionary prompts
// ============================================================

/** Characters that need a night-choice dispatched to the engine */
const NEEDS_DISPATCH: ReadonlySet<CharacterId> = new Set([
  "monk",
  "poisoner",
  "imp",
  "butler",
]);

/** Characters where the Fortune Teller picks 2 targets (no engine dispatch needed — info only) */
// Fortune Teller result is answered by the Storyteller reading the grimoire

function NightPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="text-base font-semibold text-indigo-300 mb-4">
        {state.phase === "first-night"
          ? t("night.title_night1")
          : t("night.title_nightN", { day: state.day })}
      </h2>

      {/* Pending blocking actions take priority */}
      {state.pendingRavenkeeperChoice && (
        <RavenkeeperChoicePrompt state={state} dispatch={dispatch} />
      )}
      {state.pendingMinionPromotion && (
        <MinionPromotionPrompt state={state} dispatch={dispatch} />
      )}

      {/* Mayor redirect prompt — show when Imp has targeted the Mayor */}
      {!state.pendingRavenkeeperChoice &&
        !state.pendingMinionPromotion &&
        (() => {
          const impTargetId = state.grimoire.impTarget;
          if (!impTargetId) return null;
          const target = state.grimoire.players.find(
            (p) => p.id === impTargetId,
          );
          if (
            target?.trueCharacter === "mayor" &&
            target.isAlive &&
            !target.isPoisoned &&
            !target.isDrunk
          ) {
            return <MayorRedirectPrompt state={state} dispatch={dispatch} />;
          }
          return null;
        })()}

      {/* Night order walk-through */}
      {!state.pendingRavenkeeperChoice && !state.pendingMinionPromotion && (
        <NightOrderPanel state={state} dispatch={dispatch} />
      )}
    </div>
  );
}

// Map engine pre-step labels to translation keys
function translatePreStep(
  label: string,
  description: string,
  t: (key: string) => string,
): { label: string; description: string } {
  if (label === "Minion Info") {
    return {
      label: t("night.pre_steps.minion_info"),
      description: t("night.pre_steps.minion_info_desc"),
    };
  }
  if (label === "Minion Info (skipped)") {
    return {
      label: t("night.pre_steps.minion_info_skip"),
      description: t("night.pre_steps.minion_info_skip_desc"),
    };
  }
  if (label === "Demon Info") {
    return {
      label: t("night.pre_steps.demon_info"),
      description: t("night.pre_steps.demon_info_desc"),
    };
  }
  if (label === "Demon Info (skipped)") {
    return {
      label: t("night.pre_steps.demon_info_skip"),
      description: t("night.pre_steps.demon_info_skip_desc"),
    };
  }
  return { label, description };
}

function NightOrderPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { grimoire, phase } = state;
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());

  const toggleDone = (key: string) => {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isFirstNight = phase === "first-night";
  const preSteps = isFirstNight
    ? getFirstNightPreSteps(grimoire.players.length)
    : [];
  const charSteps = isFirstNight
    ? getFirstNightOrder(grimoire)
    : getEachNightOrder(grimoire, state.pendingRavenkeeperChoice);

  return (
    <div className="space-y-2">
      {/* Pre-character steps (night 1 only) */}
      {preSteps.length > 0 && (
        <div className="mb-4">
          <p className="section-label mb-2">{t("night.pre_steps_heading")}</p>
          {preSteps.map((step, i) => {
            const key = `pre-${i}`;
            const done = doneSteps.has(key);
            const translated = translatePreStep(
              step.label,
              step.description,
              t,
            );
            return (
              <div
                key={key}
                className={cx(
                  "mb-2 p-3 rounded-xl border transition-all",
                  done
                    ? "bg-emerald-950/20 border-emerald-800/40 opacity-60"
                    : "bg-slate-800/50 border-slate-700",
                )}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleDone(key)}
                    className="accent-indigo-500 w-4 h-4"
                  />
                  <span className="font-semibold text-sm text-slate-200">
                    {translated.label}
                  </span>
                </label>
                <div className="text-xs text-slate-400 mt-1.5 ml-6">
                  {translated.description}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Character night steps */}
      <p className="section-label mb-2">{t("night.char_steps_heading")}</p>
      {charSteps.length === 0 && (
        <p className="text-slate-500 text-sm italic">{t("night.no_steps")}</p>
      )}
      {charSteps.map((step) => {
        const key = `char-${step.player.id}`;
        const done = doneSteps.has(key);
        const needsDispatch = NEEDS_DISPATCH.has(step.character);

        return (
          <NightStepCard
            key={key}
            stepKey={key}
            step={step}
            done={done}
            needsDispatch={needsDispatch}
            state={state}
            dispatch={dispatch}
            toggleDone={toggleDone}
          />
        );
      })}
    </div>
  );
}

/** Characters that receive information from the Storyteller each night */
const INFO_DELIVERY_CHARS = new Set<CharacterId>([
  "washerwoman",
  "librarian",
  "investigator",
  "chef",
  "empath",
  "fortuneteller",
  "butler",
  "undertaker",
]);

function NightStepCard({
  stepKey,
  step,
  done,
  needsDispatch,
  state,
  dispatch,
  toggleDone,
}: {
  stepKey: string;
  step: ReturnType<typeof getFirstNightOrder>[number];
  done: boolean;
  needsDispatch: boolean;
  state: GameState;
  dispatch: (a: Action) => void;
  toggleDone: (key: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const alivePlayers = state.grimoire.players.filter((p) => p.isAlive);
  const [target1, setTarget1] = useState(alivePlayers[0]?.id ?? "");
  const [target2, setTarget2] = useState(alivePlayers[1]?.id ?? "");
  const [infoText, setInfoText] = useState("");
  const [infoSent, setInfoSent] = useState(false);

  const handleSendInfo = () => {
    dispatch({
      type: "storyteller-deliver-info",
      playerId: step.player.id,
      info: infoText,
    });
    setInfoSent(true);
    setInfoText("");
  };

  const handleDispatch = () => {
    const targetIds =
      step.character === "fortuneteller" ? [target1, target2] : [target1];
    dispatch({
      type: "night-choice",
      playerId: step.player.id,
      targetIds,
    });
    toggleDone(stepKey);
  };

  const charName = t(`characters.${step.character}`, {
    defaultValue: step.character,
  });
  const actionText = t(`night.actions.${step.character}`, {
    defaultValue: step.action,
  });

  return (
    <div
      className={cx(
        "p-3 rounded-xl border transition-all",
        done
          ? "bg-emerald-950/20 border-emerald-800/40 opacity-60"
          : "bg-slate-800/50 border-slate-700",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {!needsDispatch && (
          <input
            type="checkbox"
            checked={done}
            onChange={() => toggleDone(stepKey)}
            className="accent-indigo-500 w-4 h-4"
          />
        )}
        <span className="font-semibold text-sm capitalize text-slate-200">
          {charName}
        </span>
        <span className="text-slate-500 text-sm">— {step.player.name}</span>
      </div>
      <div className="text-xs text-slate-400 mb-2 ml-6">{actionText}</div>

      {needsDispatch && !done && (
        <div className="ml-6 flex gap-2 flex-wrap items-center">
          <select
            value={target1}
            onChange={(e) => setTarget1(e.target.value)}
            className="form-select"
          >
            {alivePlayers
              .filter((p) =>
                // Monk and Butler cannot target themselves
                step.character === "monk" || step.character === "butler"
                  ? p.id !== step.player.id
                  : true,
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          {step.character === "fortuneteller" && (
            <select
              value={target2}
              onChange={(e) => setTarget2(e.target.value)}
              className="form-select"
            >
              {alivePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button onClick={handleDispatch} className="btn-primary btn-sm">
            {t("night.confirm_choice")}
          </button>
        </div>
      )}

      {/* Fortune Teller answer: pick 2 players, auto-calculate yes/no */}
      {step.character === "fortuneteller" && !done && (
        <FortuneTellerHelper
          state={state}
          toggleDone={() => toggleDone(stepKey)}
        />
      )}

      {/* Info delivery: send the Storyteller-composed info string to the player */}
      {INFO_DELIVERY_CHARS.has(step.character) && (
        <div className="ml-6 mt-2 p-3 bg-yellow-950/30 border border-yellow-700/50 rounded-lg">
          <div className="text-xs font-semibold text-yellow-400 mb-2">
            {t("night.send_info_to", { name: step.player.name })}
          </div>
          {infoSent ? (
            <div className="text-xs text-emerald-400">
              {t("night.info_sent", { name: step.player.name })}
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={infoText}
                onChange={(e) => setInfoText(e.target.value)}
                placeholder={t("night.compose_info")}
                className="form-input-sm flex-1"
              />
              <button
                onClick={handleSendInfo}
                disabled={infoText.trim() === ""}
                className="btn-warning btn-sm"
              >
                {t("night.send")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Fortune Teller helper — pick 2 players, auto-show YES/NO answer
// ============================================================

function FortuneTellerHelper({
  state,
  toggleDone,
}: {
  state: GameState;
  toggleDone: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const allPlayers = state.grimoire.players;
  const [pick1, setPick1] = useState(allPlayers[0]?.id ?? "");
  const [pick2, setPick2] = useState(allPlayers[1]?.id ?? "");

  const redHerring = state.grimoire.fortuneTellerRedHerring;
  const isYes = [pick1, pick2].some((id) => {
    const p = allPlayers.find((pl) => pl.id === id);
    return p?.trueCharacter === "imp" || p?.id === redHerring;
  });

  return (
    <div className="ml-6 mt-2 p-3 bg-blue-950/30 border border-blue-700/50 rounded-lg">
      <div className="text-xs font-semibold text-blue-400 mb-2">
        {t("night.ft_checks_2")}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={pick1}
          onChange={(e) => setPick1(e.target.value)}
          className="form-select"
        >
          {allPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="text-slate-500 text-sm">&amp;</span>
        <select
          value={pick2}
          onChange={(e) => setPick2(e.target.value)}
          className="form-select"
        >
          {allPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span
          className={cx(
            "text-sm font-bold px-3 py-1 rounded-lg",
            isYes
              ? "bg-emerald-900/50 text-emerald-400 border border-emerald-700"
              : "bg-red-900/50 text-red-400 border border-red-700",
          )}
        >
          {t("night.ft_answer", {
            answer: isYes ? t("night.yes") : t("night.no"),
          })}
        </span>
        <button onClick={toggleDone} className="btn-default btn-sm">
          {t("night.done")}
        </button>
      </div>
      <div className="text-xs text-slate-500 mt-2">
        {t("night.ft_red_herring", { herring: redHerring ?? "—" })}
      </div>
    </div>
  );
}

// ============================================================
// Discretionary prompts (Mayor redirect, Ravenkeeper, Minion promotion)
// ============================================================

function MayorRedirectPrompt({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const alivePlayers = state.grimoire.players.filter(
    (p) => p.isAlive && p.trueCharacter !== "mayor",
  );
  const [redirectId, setRedirectId] = useState<string | null>(
    alivePlayers[0]?.id ?? null,
  );

  return (
    <div className="mb-4 p-4 panel-warn">
      <strong className="text-yellow-300 text-sm">
        {t("mayor_prompt.title")}
      </strong>
      <p className="text-sm text-slate-300 my-2">
        {t("mayor_prompt.description")}
      </p>
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={redirectId ?? ""}
          onChange={(e) => setRedirectId(e.target.value || null)}
          className="form-select"
        >
          <option value="">{t("mayor_prompt.no_redirect")}</option>
          {alivePlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            dispatch({
              type: "storyteller-mayor-redirect",
              targetId: redirectId,
            })
          }
          className="btn-gold"
        >
          {t("mayor_prompt.set_redirect")}
        </button>
        {state.grimoire.mayorRedirectTarget && (
          <span className="text-emerald-400 text-sm">
            {t("mayor_prompt.redirect_set", {
              name:
                state.grimoire.players.find(
                  (p) => p.id === state.grimoire.mayorRedirectTarget,
                )?.name ?? state.grimoire.mayorRedirectTarget,
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function RavenkeeperChoicePrompt({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const allPlayers = state.grimoire.players;
  const [targetId, setTargetId] = useState(allPlayers[0]?.id ?? "");

  return (
    <div className="mb-4 p-4 panel-evil border-2">
      <strong className="text-red-300 text-sm">
        {t("ravenkeeper_prompt.title")}
      </strong>
      <p className="text-sm text-slate-300 my-2">
        {t("ravenkeeper_prompt.description")}
      </p>
      <div className="flex gap-2 items-center">
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="form-select"
        >
          {allPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {!p.isAlive ? `(${t("player.dead")})` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => dispatch({ type: "ravenkeeper-choice", targetId })}
          disabled={!targetId}
          className="btn-danger"
        >
          {t("ravenkeeper_prompt.confirm")}
        </button>
      </div>
      {targetId && (
        <div className="mt-3 text-sm text-slate-400">
          {t("ravenkeeper_prompt.character_to_reveal")}{" "}
          <strong className="text-slate-200">
            {(() => {
              const charId = state.grimoire.players.find(
                (p) => p.id === targetId,
              )?.trueCharacter;
              return charId
                ? t(`characters.${charId}`, { defaultValue: charId })
                : "—";
            })()}
          </strong>
        </div>
      )}
    </div>
  );
}

function MinionPromotionPrompt({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const aliveMinions = state.grimoire.players.filter(
    (p) => p.isAlive && p.alignment === "Minion",
  );
  const [minionId, setMinionId] = useState(aliveMinions[0]?.id ?? "");

  return (
    <div className="mb-4 p-4 panel-evil border-2">
      <strong className="text-red-300 text-sm">
        {t("minion_promotion.title")}
      </strong>
      <p className="text-sm text-slate-300 my-2">
        {t("minion_promotion.description")}
      </p>
      {aliveMinions.length === 0 ? (
        <p className="text-red-400 text-sm">
          {t("minion_promotion.no_minions")}
        </p>
      ) : (
        <div className="flex gap-2 items-center">
          <select
            value={minionId}
            onChange={(e) => setMinionId(e.target.value)}
            className="form-select"
          >
            {aliveMinions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (
                {t(`characters.${p.trueCharacter}`, {
                  defaultValue: p.trueCharacter,
                })}
                )
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              dispatch({ type: "storyteller-choose-minion", minionId })
            }
            disabled={!minionId}
            className="btn-danger"
          >
            {t("minion_promotion.promote")}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Day controls (nomination + execution)
// ============================================================

function DayControls({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { phase, grimoire, voting, executionCandidateId, winner } = state;

  if (phase !== "day" || winner) return <></>;

  const alive = grimoire.players.filter((p) => p.isAlive);

  return (
    <div>
      <h2 className="text-base font-semibold text-amber-300 mb-4">
        {t("day_controls.title")}
      </h2>

      {/* Execution candidate */}
      {executionCandidateId && (
        <div className="mb-4 p-3 panel-evil flex items-center gap-3 flex-wrap">
          <span className="text-sm text-slate-300">
            <strong className="text-red-300">
              {t("day_controls.execution_candidate")}
            </strong>{" "}
            {grimoire.players.find((p) => p.id === executionCandidateId)
              ?.name ?? executionCandidateId}{" "}
            <span className="text-slate-500">
              (
              {t("day_controls.votes", {
                count: state.executionCandidateVotes,
              })}
              )
            </span>
          </span>
          <button
            onClick={() =>
              dispatch({ type: "execute", targetId: executionCandidateId })
            }
            className="btn-danger"
          >
            {t("day_controls.execute")}
          </button>
        </div>
      )}

      {/* Nomination form */}
      {!voting && (
        <NominationForm state={state} dispatch={dispatch} alive={alive} />
      )}

      {/* Active vote */}
      {voting && <VotePanel state={state} dispatch={dispatch} />}

      {/* Slayer button */}
      <SlayerPanel state={state} dispatch={dispatch} alive={alive} />
    </div>
  );
}

function NominationForm({
  state,
  dispatch,
  alive,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  alive: Player[];
}): React.ReactElement {
  const { t } = useTranslation();
  const [nominatorId, setNominatorId] = useState(alive[0]?.id ?? "");
  const [targetId, setTargetId] = useState(alive[0]?.id ?? "");

  const eligibleNominators = alive.filter(
    (p) => !state.nominatorsUsed.includes(p.id),
  );
  const eligibleTargets = alive.filter(
    (p) => !state.nominatedToday.includes(p.id),
  );

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4 p-3 card">
      <span className="text-sm font-medium text-slate-300">
        {t("day_controls.nominate")}:
      </span>
      <select
        value={nominatorId}
        onChange={(e) => setNominatorId(e.target.value)}
        className="form-select"
      >
        {eligibleNominators.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span className="text-slate-500 text-sm">
        {t("day_controls.nominates")}
      </span>
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="form-select"
      >
        {eligibleTargets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => dispatch({ type: "nominate", nominatorId, targetId })}
        disabled={!nominatorId || !targetId || nominatorId === targetId}
        className="btn-warning"
      >
        {t("day_controls.nominate")}
      </button>
    </div>
  );
}

function VotePanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { voting, grimoire } = state;
  if (!voting) return <></>;

  const targetName =
    grimoire.players.find((p) => p.id === voting.targetId)?.name ??
    voting.targetId;

  const aliveCount = grimoire.players.filter((p) => p.isAlive).length;
  const threshold = Math.ceil(aliveCount / 2);
  const yesCount = Object.values(voting.votes).filter(Boolean).length;

  const pendingVoters = voting.eligibleVoterIds.filter(
    (id) => !(id in voting.votes),
  );

  return (
    <div className="mb-4 p-4 card">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <strong className="text-slate-200 text-sm">
          {t("day_controls.vote_in_progress")}
        </strong>
        <span className="text-slate-400 text-sm">
          {t("day_controls.execution_of", { name: targetName })}
        </span>
        <span className="text-xs text-slate-500">
          {t("day_controls.threshold")}: {threshold} &nbsp;|&nbsp;{" "}
          {t("day_controls.yes_so_far")}: {yesCount}
        </span>
      </div>
      {pendingVoters.length > 0 && (
        <div className="flex items-center gap-2 mt-3">
          <span className="text-sm text-slate-400">
            <strong className="text-slate-300">
              {t("day_controls.next_voter")}
            </strong>{" "}
            {grimoire.players.find((p) => p.id === pendingVoters[0])?.name ??
              pendingVoters[0]}
          </span>
          <button
            onClick={() =>
              dispatch({ type: "vote", playerId: pendingVoters[0], vote: true })
            }
            className="btn-success btn-sm"
          >
            {t("day_controls.yes")}
          </button>
          <button
            onClick={() =>
              dispatch({
                type: "vote",
                playerId: pendingVoters[0],
                vote: false,
              })
            }
            className="btn-danger btn-sm"
          >
            {t("day_controls.no")}
          </button>
        </div>
      )}
      <VoteTally voting={voting} grimoire={grimoire} />
    </div>
  );
}

function VoteTally({
  voting,
  grimoire,
}: {
  voting: NonNullable<GameState["voting"]>;
  grimoire: GameState["grimoire"];
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="mt-3 border-t border-slate-700 pt-3">
      {voting.eligibleVoterIds.map((id) => {
        const name = grimoire.players.find((p) => p.id === id)?.name ?? id;
        const vote = voting.votes[id];
        return (
          <div key={id} className="flex items-center gap-3 py-0.5 text-sm">
            <span className="text-slate-400 w-24 truncate">{name}</span>
            <span
              className={cx(
                "text-xs font-medium",
                vote === undefined
                  ? "text-slate-600"
                  : vote
                    ? "text-emerald-400"
                    : "text-red-400",
              )}
            >
              {vote === undefined
                ? "—"
                : vote
                  ? `✅ ${t("day_controls.yes")}`
                  : `❌ ${t("day_controls.no")}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SlayerPanel({
  state,
  dispatch,
  alive,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  alive: Player[];
}): React.ReactElement {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState(alive[0]?.id ?? "");

  const slayer = state.grimoire.players.find(
    (p) => p.trueCharacter === "slayer" && p.isAlive,
  );

  if (!slayer || state.grimoire.slayerUsed) return <></>;

  return (
    <div className="mt-4 p-3 panel-purple flex items-center gap-2 flex-wrap">
      <strong className="text-purple-300 text-sm">
        {t("slayer_st.label", { name: slayer.name })}
      </strong>
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="form-select"
      >
        {alive.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={() =>
          dispatch({
            type: "slayer-shoot",
            slayerId: slayer.id,
            targetId,
          })
        }
        className="btn-purple"
      >
        {t("slayer_st.shoot")}
      </button>
    </div>
  );
}
