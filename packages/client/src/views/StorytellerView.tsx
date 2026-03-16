/**
 * StorytellerView — Storyteller-only UI.
 *
 * Shows the full Grimoire (all roles, alive/dead status, night state),
 * phase controls, night-order walk-through, and action buttons for every
 * game event.  Every point where the rules say "Storyteller may/might"
 * is a UI prompt here.
 */

import React, { useState } from "react";
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
  const dispatch = (action: Action) =>
    send({ type: "action", payload: action });

  const hasPlayers = state.grimoire.players.length > 0;

  return (
    <div style={{ fontFamily: "monospace", padding: 16 }}>
      <h1>Blood on the Clocktower — Storyteller</h1>

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
      <h2>Setup Players ({names.length})</h2>
      <p style={{ fontSize: 13, color: "#555" }}>
        Enter player names then press <strong>Roll Characters</strong> to
        randomly assign roles. Hit <strong>Start Game</strong> when ready.
      </p>

      <table style={{ borderCollapse: "collapse", marginBottom: 12 }}>
        <thead>
          <tr>
            {["Seat", "Name", "Character", "Align", ""].map((h) => (
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
            const charName = p?.trueCharacter ?? "—";
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
                      (believes: {p.perceivedCharacter})
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
          + Add Player
        </button>
        <button onClick={reroll}>↺ Re-roll Characters</button>
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
          ▶ Start Game
        </button>
      </div>

      {!valid && (
        <p style={{ color: "crimson", fontSize: 13 }}>
          Trouble Brewing requires 5–15 players.
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
  const { phase, day, winner } = state;

  return (
    <div>
      <strong>Phase:</strong> {phase} &nbsp;
      <strong>Day:</strong> {day}
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
          🏆 {winner.toUpperCase()} WINS — Game Over
        </span>
      )}
      {!winner && (
        <div style={{ marginTop: 8 }}>
          {(phase === "first-night" || phase === "night") &&
            !state.pendingRavenkeeperChoice &&
            !state.pendingMinionPromotion && (
              <button onClick={() => dispatch({ type: "resolve-night" })}>
                Resolve Night (→ Day {day + 1})
              </button>
            )}
          {phase === "day" && (
            <>
              <button onClick={() => dispatch({ type: "skip-execution" })}>
                End Day (No Execution)
              </button>
              <button
                style={{ marginLeft: 8 }}
                onClick={() => dispatch({ type: "advance-to-night" })}
              >
                Advance to Night
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
  const { grimoire } = state;

  return (
    <div>
      <h2>Grimoire</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {[
              "Seat",
              "Name",
              "Character",
              "Align",
              "Alive",
              "Poisoned",
              "Drunk",
              "Protected",
              "Ghost",
            ].map((h) => (
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
        Imp target: {grimoire.impTarget ?? "—"} &nbsp;|&nbsp; Monk protecting:{" "}
        {grimoire.monkProtectionTarget ?? "—"} &nbsp;|&nbsp; Poisoner target:{" "}
        {grimoire.poisonerTarget ?? "—"} &nbsp;|&nbsp; Butler master:{" "}
        {grimoire.butlerMaster ?? "—"} &nbsp;|&nbsp; FT red herring:{" "}
        {grimoire.fortuneTellerRedHerring ?? "—"}
      </div>
      {grimoire.demonBluffs.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#800" }}>
          Demon bluffs: {grimoire.demonBluffs.join(", ")}
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
      {cell(trueCharacter)}
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
  return (
    <div>
      <h2>
        Night Phase —{" "}
        {state.phase === "first-night" ? "Night 1" : `Night ${state.day}`}
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

function NightOrderPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
}): React.ReactElement {
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
          <strong>Pre-character steps:</strong>
          {preSteps.map((step, i) => {
            const key = `pre-${i}`;
            const done = doneSteps.has(key);
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
                  <strong>{step.label}</strong>
                </label>
                <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                  {step.description}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Character night steps */}
      <strong>Character steps:</strong>
      {charSteps.length === 0 && (
        <p style={{ color: "#888", fontSize: 13 }}>
          No character steps this night.
        </p>
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
        <strong style={{ textTransform: "capitalize" }}>
          {step.character}
        </strong>
        <span style={{ color: "#666" }}>— {step.player.name}</span>
      </div>
      <div style={{ fontSize: 12, color: "#555", margin: "4px 0 6px 20px" }}>
        {step.action}
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
          <button onClick={handleDispatch}>Confirm choice</button>
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
            Send info to {step.player.name}
          </div>
          {infoSent ? (
            <div style={{ fontSize: 12, color: "#389e0d" }}>
              ✓ Info sent to {step.player.name}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                value={infoText}
                onChange={(e) => setInfoText(e.target.value)}
                placeholder="Compose info for this player…"
                style={{ flex: 1, fontSize: 12, padding: "2px 6px" }}
              />
              <button
                onClick={handleSendInfo}
                disabled={infoText.trim() === ""}
                style={{ fontSize: 12 }}
              >
                Send
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
        Fortune Teller checks 2 players
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
          Answer: {isYes ? "YES" : "NO"}
        </span>
        <button onClick={toggleDone} style={{ fontSize: 12 }}>
          ✓ Done
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
        Red herring: {redHerring ?? "—"} &nbsp;|&nbsp; YES if either pick is the
        Demon or red herring
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
      <strong>Mayor ability — Imp targeted the Mayor!</strong>
      <p style={{ fontSize: 13, margin: "4px 0" }}>
        The Mayor is alive and healthy. You may redirect the kill to another
        player, or let the Mayor die.
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
          <option value="">— Mayor dies (no redirect) —</option>
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
          Set redirect
        </button>
        {state.grimoire.mayorRedirectTarget && (
          <span style={{ color: "green", fontSize: 13 }}>
            ✓ Redirect set →{" "}
            {state.grimoire.players.find(
              (p) => p.id === state.grimoire.mayorRedirectTarget,
            )?.name ?? state.grimoire.mayorRedirectTarget}
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
      <strong>Ravenkeeper died tonight — choose a player to reveal</strong>
      <p style={{ fontSize: 13, margin: "4px 0" }}>
        Wake the Ravenkeeper. They point at any player (alive or dead). Show
        that player's character token privately.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {allPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {!p.isAlive ? "(dead)" : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => dispatch({ type: "ravenkeeper-choice", targetId })}
          disabled={!targetId}
        >
          Confirm Ravenkeeper choice
        </button>
      </div>
      {targetId && (
        <div style={{ marginTop: 6, fontSize: 13, color: "#555" }}>
          Character to reveal:{" "}
          <strong>
            {state.grimoire.players.find((p) => p.id === targetId)
              ?.trueCharacter ?? "—"}
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
  const aliveMinioons = state.grimoire.players.filter(
    (p) => p.isAlive && p.alignment === "Minion",
  );
  const [minionId, setMinionId] = useState(aliveMinioons[0]?.id ?? "");

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
      <strong>Imp self-killed — choose which Minion becomes the new Imp</strong>
      <p style={{ fontSize: 13, margin: "4px 0" }}>
        No Scarlet Woman was eligible. Choose a living Minion to become the new
        Demon. Show them the Imp token secretly.
      </p>
      {aliveMinioons.length === 0 ? (
        <p style={{ color: "crimson" }}>No living Minions — good wins!</p>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={minionId}
            onChange={(e) => setMinionId(e.target.value)}
          >
            {aliveMinioons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.trueCharacter})
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              dispatch({ type: "storyteller-choose-minion", minionId })
            }
            disabled={!minionId}
          >
            Promote to Imp
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
  const { phase, grimoire, voting, executionCandidateId, winner } = state;

  if (phase !== "day" || winner) return <></>;

  const alive = grimoire.players.filter((p) => p.isAlive);

  return (
    <div>
      <h2>Day Controls</h2>

      {/* Execution candidate */}
      {executionCandidateId && (
        <div style={{ marginBottom: 8 }}>
          <strong>Execution candidate:</strong>{" "}
          {grimoire.players.find((p) => p.id === executionCandidateId)?.name ??
            executionCandidateId}{" "}
          ({state.executionCandidateVotes} votes)
          <button
            style={{ marginLeft: 8 }}
            onClick={() =>
              dispatch({ type: "execute", targetId: executionCandidateId })
            }
          >
            Execute
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
      <strong>Nominate:</strong>
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
      nominates
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
        Nominate
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
      <strong>Vote in progress:</strong> execution of {targetName}
      <br />
      Threshold: {threshold} &nbsp;|&nbsp; YES so far: {yesCount}
      <br />
      {pendingVoters.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <strong>Next voter:</strong>{" "}
          {grimoire.players.find((p) => p.id === pendingVoters[0])?.name ??
            pendingVoters[0]}
          <button
            style={{ marginLeft: 8 }}
            onClick={() =>
              dispatch({ type: "vote", playerId: pendingVoters[0], vote: true })
            }
          >
            YES
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
            NO
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
  return (
    <table style={{ marginTop: 8, fontSize: 12 }}>
      <tbody>
        {voting.eligibleVoterIds.map((id) => {
          const name = grimoire.players.find((p) => p.id === id)?.name ?? id;
          const vote = voting.votes[id];
          return (
            <tr key={id}>
              <td style={{ paddingRight: 8 }}>{name}</td>
              <td>{vote === undefined ? "—" : vote ? "✅ YES" : "❌ NO"}</td>
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
  const [targetId, setTargetId] = useState(alive[0]?.id ?? "");

  const slayer = state.grimoire.players.find(
    (p) => p.trueCharacter === "slayer" && p.isAlive,
  );

  if (!slayer || state.grimoire.slayerUsed) return <></>;

  return (
    <div style={{ marginTop: 12 }}>
      <strong>Slayer ({slayer.name}):</strong>
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
        Slayer: Shoot!
      </button>
    </div>
  );
}
