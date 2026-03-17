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
    <div style={{ fontFamily: "monospace", padding: 16 }}>
      <h1>{t("app.title")} — Storyteller</h1>

      {!hasPlayers ? (
        <SetupPlayers send={send} />
      ) : (
        <>
          <PhaseBar state={state} dispatch={dispatch} />
          <hr />
          <GrimoireTable state={state} dispatch={dispatch} />
          <hr />
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
    <div>
      <h2>{t("setup.title", { count: names.length })}</h2>
      <p style={{ fontSize: 13, color: "#555" }}>
        {t("setup.instructions_1")}{" "}
        <strong>{t("setup.instructions_roll")}</strong>{" "}
        {t("setup.instructions_2")}{" "}
        <strong>{t("setup.instructions_start")}</strong>{" "}
        {t("setup.instructions_3")}
      </p>

      <table style={{ borderCollapse: "collapse", marginBottom: 12 }}>
        <thead>
          <tr>
            {[
              t("setup.seat"),
              t("setup.name"),
              t("setup.character"),
              t("setup.align"),
              "",
            ].map((h) => (
              <th
                key={h}
                style={{
                  border: "1px solid #ccc",
                  padding: "4px 8px",
                  background: "#f5f5f5",
                  textAlign: "left",
                }}
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
              <tr key={i}>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    textAlign: "center",
                  }}
                >
                  {i + 1}
                </td>
                <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>
                  <input
                    value={name}
                    onChange={(e) => updateName(i, e.target.value)}
                    style={{ width: 120 }}
                  />
                </td>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    color: isEvil ? "crimson" : "navy",
                  }}
                >
                  {charName}
                  {p?.isDrunk && (
                    <span style={{ color: "#a05000", marginLeft: 6 }}>
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
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    color: isEvil ? "crimson" : "royalblue",
                  }}
                >
                  {p?.alignment ?? "—"}
                </td>
                <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>
                  <button
                    onClick={() => removePlayer(i)}
                    disabled={names.length <= 5}
                    style={{ fontSize: 11 }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={addPlayer} disabled={names.length >= 15}>
          {t("setup.add_player")}
        </button>
        <button onClick={reroll}>{t("setup.reroll")}</button>
        <button
          onClick={handleStart}
          disabled={!valid}
          style={{
            background: valid ? "#2a6" : "#ccc",
            color: valid ? "white" : "#666",
            fontWeight: "bold",
            padding: "4px 16px",
          }}
        >
          {t("setup.start_game")}
        </button>
      </div>

      {!valid && (
        <p style={{ color: "crimson", fontSize: 13 }}>
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

  return (
    <div>
      <strong>{t("phase_bar.phase")}</strong> {phase} &nbsp;
      <strong>{t("phase_bar.day")}</strong> {day}
      {winner && (
        <span
          style={{
            display: "inline-block",
            marginLeft: 12,
            padding: "2px 12px",
            background: winner === "good" ? "#1890ff" : "#cf1322",
            color: "white",
            fontWeight: "bold",
            borderRadius: 4,
          }}
        >
          🏆 {t("phase_bar.wins", { winner: winner.toUpperCase() })}
        </span>
      )}
      {!winner && (
        <div style={{ marginTop: 8 }}>
          {(phase === "first-night" || phase === "night") &&
            !state.pendingRavenkeeperChoice &&
            !state.pendingMinionPromotion && (
              <button onClick={() => dispatch({ type: "resolve-night" })}>
                {t("phase_bar.resolve_night", { day: day + 1 })}
              </button>
            )}
          {phase === "day" && (
            <>
              <button onClick={() => dispatch({ type: "skip-execution" })}>
                {t("phase_bar.end_day")}
              </button>
              <button
                style={{ marginLeft: 8 }}
                onClick={() => dispatch({ type: "advance-to-night" })}
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
      <h2>{t("grimoire.title")}</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {columns.map((h) => (
              <th
                key={h}
                style={{
                  border: "1px solid #ccc",
                  padding: "4px 8px",
                  background: "#f5f5f5",
                }}
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
      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        {t("grimoire.imp_target")}: {grimoire.impTarget ?? "—"} &nbsp;|&nbsp;{" "}
        {t("grimoire.monk_protecting")}: {grimoire.monkProtectionTarget ?? "—"}{" "}
        &nbsp;|&nbsp; {t("grimoire.poisoner_target")}:{" "}
        {grimoire.poisonerTarget ?? "—"} &nbsp;|&nbsp;{" "}
        {t("grimoire.butler_master")}: {grimoire.butlerMaster ?? "—"}{" "}
        &nbsp;|&nbsp; {t("grimoire.ft_red_herring")}:{" "}
        {grimoire.fortuneTellerRedHerring ?? "—"}
      </div>
      {grimoire.demonBluffs.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#800" }}>
          {t("grimoire.demon_bluffs")}:{" "}
          {grimoire.demonBluffs
            .map((id) => t(`characters.${id}`, { defaultValue: id }))
            .join(", ")}
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

  const cell = (content: React.ReactNode) => (
    <td
      style={{
        border: "1px solid #ccc",
        padding: "4px 8px",
        textAlign: "center",
      }}
    >
      {content}
    </td>
  );

  const rowStyle: React.CSSProperties = {
    opacity: isAlive ? 1 : 0.45,
    background: isPoisoned ? "#fff0f0" : isDrunk ? "#fffff0" : "white",
  };

  const isCandidate = state.executionCandidateId === id;

  return (
    <tr style={rowStyle}>
      {cell(seatIndex + 1)}
      {cell(
        <span
          style={
            isCandidate ? { fontWeight: "bold", color: "crimson" } : undefined
          }
        >
          {name}
        </span>,
      )}
      {cell(t(`characters.${trueCharacter}`, { defaultValue: trueCharacter }))}
      {cell(
        <span
          style={{
            color:
              alignment === "Demon" || alignment === "Minion" ? "red" : "blue",
          }}
        >
          {alignment}
        </span>,
      )}
      {cell(isAlive ? "✓" : "✗")}
      {cell(isPoisoned ? "☠" : "")}
      {cell(isDrunk ? "🍺" : "")}
      {cell(isProtected ? "🛡" : "")}
      {cell(ghostVoteUsed ? "✗" : isAlive ? "" : "✓")}
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
      <h2>
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
    <div>
      {/* Pre-character steps (night 1 only) */}
      {preSteps.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <strong>{t("night.pre_steps_heading")}</strong>
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
                style={{
                  margin: "6px 0",
                  padding: 8,
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  background: done ? "#f0fff0" : "white",
                  opacity: done ? 0.6 : 1,
                }}
              >
                <label style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleDone(key)}
                    style={{ marginRight: 6 }}
                  />
                  <strong>{translated.label}</strong>
                </label>
                <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                  {translated.description}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Character night steps */}
      <strong>{t("night.char_steps_heading")}</strong>
      {charSteps.length === 0 && (
        <p style={{ color: "#888", fontSize: 13 }}>{t("night.no_steps")}</p>
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
      style={{
        margin: "6px 0",
        padding: 8,
        border: "1px solid #ccc",
        borderRadius: 4,
        background: done ? "#f0fff0" : "white",
        opacity: done ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!needsDispatch && (
          <input
            type="checkbox"
            checked={done}
            onChange={() => toggleDone(stepKey)}
          />
        )}
        <strong style={{ textTransform: "capitalize" }}>{charName}</strong>
        <span style={{ color: "#666" }}>— {step.player.name}</span>
      </div>
      <div style={{ fontSize: 12, color: "#555", margin: "4px 0 6px 20px" }}>
        {actionText}
      </div>

      {needsDispatch && !done && (
        <div
          style={{
            marginLeft: 20,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <select value={target1} onChange={(e) => setTarget1(e.target.value)}>
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
            >
              {alivePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button onClick={handleDispatch}>{t("night.confirm_choice")}</button>
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
        <div
          style={{
            marginLeft: 20,
            marginTop: 6,
            padding: "6px 8px",
            background: "#fffbe6",
            border: "1px solid #ffe58f",
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>
            {t("night.send_info_to", { name: step.player.name })}
          </div>
          {infoSent ? (
            <div style={{ fontSize: 12, color: "#389e0d" }}>
              {t("night.info_sent", { name: step.player.name })}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                value={infoText}
                onChange={(e) => setInfoText(e.target.value)}
                placeholder={t("night.compose_info")}
                style={{ flex: 1, fontSize: 12, padding: "2px 6px" }}
              />
              <button
                onClick={handleSendInfo}
                disabled={infoText.trim() === ""}
                style={{ fontSize: 12 }}
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
    <div
      style={{
        marginLeft: 20,
        marginTop: 6,
        padding: "6px 8px",
        background: "#f0f5ff",
        border: "1px solid #adc6ff",
        borderRadius: 4,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>
        {t("night.ft_checks_2")}
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <select
          value={pick1}
          onChange={(e) => setPick1(e.target.value)}
          style={{ fontSize: 12 }}
        >
          {allPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12 }}>&amp;</span>
        <select
          value={pick2}
          onChange={(e) => setPick2(e.target.value)}
          style={{ fontSize: 12 }}
        >
          {allPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span
          style={{
            fontSize: 13,
            fontWeight: "bold",
            padding: "2px 8px",
            borderRadius: 4,
            background: isYes ? "#f6ffed" : "#fff1f0",
            color: isYes ? "#389e0d" : "#cf1322",
            border: `1px solid ${isYes ? "#b7eb8f" : "#ffa39e"}`,
          }}
        >
          {t("night.ft_answer", {
            answer: isYes ? t("night.yes") : t("night.no"),
          })}
        </span>
        <button onClick={toggleDone} style={{ fontSize: 12 }}>
          {t("night.done")}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
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
    <div
      style={{
        margin: "12px 0",
        padding: 12,
        border: "2px solid goldenrod",
        borderRadius: 6,
        background: "#fffbe6",
      }}
    >
      <strong>{t("mayor_prompt.title")}</strong>
      <p style={{ fontSize: 13, margin: "4px 0" }}>
        {t("mayor_prompt.description")}
      </p>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <select
          value={redirectId ?? ""}
          onChange={(e) => setRedirectId(e.target.value || null)}
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
        >
          {t("mayor_prompt.set_redirect")}
        </button>
        {state.grimoire.mayorRedirectTarget && (
          <span style={{ color: "green", fontSize: 13 }}>
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
    <div
      style={{
        margin: "12px 0",
        padding: 12,
        border: "2px solid #a00",
        borderRadius: 6,
        background: "#fff5f5",
      }}
    >
      <strong>{t("ravenkeeper_prompt.title")}</strong>
      <p style={{ fontSize: 13, margin: "4px 0" }}>
        {t("ravenkeeper_prompt.description")}
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {allPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {!p.isAlive ? `(${t("player.dead")})` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => dispatch({ type: "ravenkeeper-choice", targetId })}
          disabled={!targetId}
        >
          {t("ravenkeeper_prompt.confirm")}
        </button>
      </div>
      {targetId && (
        <div style={{ marginTop: 6, fontSize: 13, color: "#555" }}>
          {t("ravenkeeper_prompt.character_to_reveal")}{" "}
          <strong>
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
    <div
      style={{
        margin: "12px 0",
        padding: 12,
        border: "2px solid #a00",
        borderRadius: 6,
        background: "#fff5f5",
      }}
    >
      <strong>{t("minion_promotion.title")}</strong>
      <p style={{ fontSize: 13, margin: "4px 0" }}>
        {t("minion_promotion.description")}
      </p>
      {aliveMinions.length === 0 ? (
        <p style={{ color: "crimson" }}>{t("minion_promotion.no_minions")}</p>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={minionId}
            onChange={(e) => setMinionId(e.target.value)}
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
      <h2>{t("day_controls.title")}</h2>

      {/* Execution candidate */}
      {executionCandidateId && (
        <div style={{ marginBottom: 8 }}>
          <strong>{t("day_controls.execution_candidate")}</strong>{" "}
          {grimoire.players.find((p) => p.id === executionCandidateId)?.name ??
            executionCandidateId}{" "}
          ({t("day_controls.votes", { count: state.executionCandidateVotes })})
          <button
            style={{ marginLeft: 8 }}
            onClick={() =>
              dispatch({ type: "execute", targetId: executionCandidateId })
            }
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
    <div>
      <strong>{t("day_controls.nominate")}:</strong>
      <select
        value={nominatorId}
        onChange={(e) => setNominatorId(e.target.value)}
        style={{ margin: "0 4px" }}
      >
        {eligibleNominators.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {t("day_controls.nominates")}
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        style={{ margin: "0 4px" }}
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
    <div style={{ border: "1px solid #aaa", padding: 12, marginTop: 8 }}>
      <strong>{t("day_controls.vote_in_progress")}</strong>{" "}
      {t("day_controls.execution_of", { name: targetName })}
      <br />
      {t("day_controls.threshold")}: {threshold} &nbsp;|&nbsp;{" "}
      {t("day_controls.yes_so_far")}: {yesCount}
      <br />
      {pendingVoters.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <strong>{t("day_controls.next_voter")}</strong>{" "}
          {grimoire.players.find((p) => p.id === pendingVoters[0])?.name ??
            pendingVoters[0]}
          <button
            style={{ marginLeft: 8 }}
            onClick={() =>
              dispatch({ type: "vote", playerId: pendingVoters[0], vote: true })
            }
          >
            {t("day_controls.yes")}
          </button>
          <button
            style={{ marginLeft: 4 }}
            onClick={() =>
              dispatch({
                type: "vote",
                playerId: pendingVoters[0],
                vote: false,
              })
            }
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
    <table style={{ marginTop: 8, fontSize: 12 }}>
      <tbody>
        {voting.eligibleVoterIds.map((id) => {
          const name = grimoire.players.find((p) => p.id === id)?.name ?? id;
          const vote = voting.votes[id];
          return (
            <tr key={id}>
              <td style={{ paddingRight: 8 }}>{name}</td>
              <td>
                {vote === undefined
                  ? "—"
                  : vote
                    ? `✅ ${t("day_controls.yes")}`
                    : `❌ ${t("day_controls.no")}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
    <div style={{ marginTop: 12 }}>
      <strong>{t("slayer_st.label", { name: slayer.name })}</strong>
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        style={{ margin: "0 4px" }}
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
      >
        {t("slayer_st.shoot")}
      </button>
    </div>
  );
}
