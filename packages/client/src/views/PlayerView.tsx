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
import { Action } from "@botc/engine";
import { PlayerSnapshot, PublicPlayer, SendFn } from "../useGame";

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
  const { phase, day, winner, grimoire, voting, executionCandidateId } = state;
  const dispatch = (action: Action) =>
    send({ type: "action", payload: action });

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: 480,
        margin: "0 auto",
        padding: 16,
      }}
    >
      <h1 style={{ fontSize: 20 }}>Blood on the Clocktower</h1>

      <div style={{ marginBottom: 12 }}>
        <strong>Phase:</strong> {phase} &nbsp;
        <strong>Day:</strong> {day}
        {winner && (
          <span
            style={{
              color: winner === "good" ? "royalblue" : "crimson",
              marginLeft: 12,
              fontWeight: "bold",
            }}
          >
            {winner.toUpperCase()} WINS
          </span>
        )}
      </div>

      <NightInfoPanel grimoire={grimoire} phase={phase} />
      <MyCharacterCard grimoire={grimoire} />
      <PlayerList
        players={grimoire.players}
        executionCandidateId={executionCandidateId}
      />
      {voting && <ActiveVote state={state} />}

      <div style={{ marginTop: 16 }}>
        <VoteButtons state={state} playerId={playerId} dispatch={dispatch} />
        <NominatePanel state={state} playerId={playerId} dispatch={dispatch} />
        <SlayerPanel state={state} playerId={playerId} dispatch={dispatch} />
        <RavenkeeperPanel
          state={state}
          playerId={playerId}
          dispatch={dispatch}
        />
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
  const {
    myPerceivedCharacter,
    myTrueCharacter,
    myAlignment,
    myIsPoisoned,
    myIsDrunk,
    myDemonBluffs,
  } = grimoire;

  const isEvil = myAlignment === "Minion" || myAlignment === "Demon";
  const borderColor = isEvil ? "crimson" : "royalblue";
  const bgColor = isEvil ? "#fff5f5" : "#f5f8ff";

  return (
    <div
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        background: bgColor,
      }}
    >
      <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>
        Your character
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: "bold",
          textTransform: "capitalize",
        }}
      >
        {myPerceivedCharacter}
      </div>
      <div
        style={{
          fontSize: 13,
          color: isEvil ? "crimson" : "royalblue",
          marginTop: 2,
        }}
      >
        {myAlignment}
      </div>

      {myIsDrunk && (
        <div
          style={{
            marginTop: 6,
            padding: "4px 8px",
            background: "#fff8e1",
            borderRadius: 4,
            fontSize: 12,
            color: "#795548",
          }}
        >
          🍺 You are the <strong>Drunk</strong> — you think you are{" "}
          {myPerceivedCharacter} but your ability gives unreliable information.
          Your true character is {myTrueCharacter}.
        </div>
      )}

      {myIsPoisoned && (
        <div
          style={{
            marginTop: 6,
            padding: "4px 8px",
            background: "#fce4ec",
            borderRadius: 4,
            fontSize: 12,
            color: "#b71c1c",
          }}
        >
          ☠ You are <strong>poisoned</strong> — your ability may give false or
          no information tonight.
        </div>
      )}

      {myDemonBluffs && myDemonBluffs.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: "4px 8px",
            background: "#fbe9e7",
            borderRadius: 4,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: "bold",
              color: "#b71c1c",
              marginBottom: 2,
            }}
          >
            Demon bluffs — safe characters to claim:
          </div>
          <div style={{ fontSize: 13, color: "#b71c1c" }}>
            {myDemonBluffs.join(", ")}
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
  return (
    <div>
      <h2 style={{ fontSize: 16 }}>Players</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {players.map((p) => {
          const isCandidate = p.id === executionCandidateId;
          return (
            <li
              key={p.id}
              style={{
                padding: "6px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: p.isAlive ? 1 : 0.45,
                borderBottom: "1px solid #eee",
                fontWeight: isCandidate ? "bold" : "normal",
                color: isCandidate ? "crimson" : undefined,
              }}
            >
              <span style={{ width: 20, textAlign: "right", color: "#999" }}>
                {p.seatIndex + 1}.
              </span>
              <span style={{ flex: 1 }}>{p.name}</span>
              {!p.isAlive && (
                <span style={{ fontSize: 12, color: "#999" }}>
                  {p.ghostVoteUsed ? "dead (vote used)" : "dead"}
                </span>
              )}
              {isCandidate && (
                <span style={{ fontSize: 12 }}>on the block</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================
// Active vote display
// ============================================================

function ActiveVote({ state }: { state: PlayerSnapshot }): React.ReactElement {
  const { voting, grimoire } = state;
  if (!voting) return <></>;

  const targetName =
    grimoire.players.find((p) => p.id === voting.targetId)?.name ??
    voting.targetId;

  const aliveCount = grimoire.players.filter((p) => p.isAlive).length;
  const threshold = Math.ceil(aliveCount / 2);
  const yesCount = Object.values(voting.votes).filter(Boolean).length;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        border: "1px solid #ccc",
        borderRadius: 6,
      }}
    >
      <strong>Vote:</strong> Execute {targetName}?
      <div style={{ fontSize: 13, marginTop: 4, color: "#555" }}>
        Need {threshold} votes &nbsp;|&nbsp; YES: {yesCount}
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
  if (
    (phase !== "first-night" && phase !== "night") ||
    grimoire.myNightInfo === null
  ) {
    return <></>;
  }
  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 14px",
        background: "#e6f7ff",
        border: "2px solid #1890ff",
        borderRadius: 6,
      }}
    >
      <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>
        Night Information
      </div>
      <div style={{ fontSize: 14 }}>{grimoire.myNightInfo}</div>
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
        <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
          Waiting for <strong>{voterName}</strong> to vote…
        </div>
      );
    }
    return <></>;
  }

  const targetName =
    state.grimoire.players.find((p) => p.id === voting.targetId)?.name ??
    voting.targetId;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        border: "2px solid #faad14",
        borderRadius: 6,
        background: "#fffbe6",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 6 }}>
        Your vote: Execute {targetName}?
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => dispatch({ type: "vote", playerId, vote: true })}
          style={{
            background: "#52c41a",
            color: "white",
            border: "none",
            borderRadius: 4,
            padding: "6px 16px",
            cursor: "pointer",
          }}
        >
          YES
        </button>
        <button
          onClick={() => dispatch({ type: "vote", playerId, vote: false })}
          style={{
            background: "#f5222d",
            color: "white",
            border: "none",
            borderRadius: 4,
            padding: "6px 16px",
            cursor: "pointer",
          }}
        >
          NO
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
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        border: "1px solid #d9d9d9",
        borderRadius: 6,
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 6 }}>Nominate</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          value={resolvedTarget}
          onChange={(e) => setTargetId(e.target.value)}
          style={{ flex: 1 }}
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
        >
          Nominate
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
  const [targetId, setTargetId] = useState<string>("");

  if (!playerId) return <></>;
  if (state.phase !== "day") return <></>;
  if (state.winner) return <></>;
  if (state.grimoire.myTrueCharacter !== "slayer") return <></>;
  if (state.grimoire.slayerUsed) return <></>;

  const me = state.grimoire.players.find((p) => p.id === playerId);
  if (!me?.isAlive) return <></>;

  const targets = state.grimoire.players.filter((p) => p.isAlive);
  const resolvedTarget = targetId || targets[0]?.id;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        border: "1px solid #b37feb",
        borderRadius: 6,
        background: "#f9f0ff",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 6 }}>
        Slayer ability — shoot a player
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          value={resolvedTarget}
          onChange={(e) => setTargetId(e.target.value)}
          style={{ flex: 1 }}
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
          style={{
            background: "#722ed1",
            color: "white",
            border: "none",
            borderRadius: 4,
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          Shoot
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
  const [targetId, setTargetId] = useState<string>("");

  if (!playerId) return <></>;
  if (!state.pendingRavenkeeperChoice) return <></>;
  if (state.grimoire.myTrueCharacter !== "ravenkeeper") return <></>;

  const allPlayers = state.grimoire.players;
  const resolvedTarget = targetId || allPlayers[0]?.id;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        border: "2px solid #1890ff",
        borderRadius: 6,
        background: "#e6f7ff",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 6 }}>
        Ravenkeeper — choose a player to learn their character
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          value={resolvedTarget}
          onChange={(e) => setTargetId(e.target.value)}
          style={{ flex: 1 }}
        >
          {allPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.isAlive ? "" : "(dead)"}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            dispatch({ type: "ravenkeeper-choice", targetId: resolvedTarget })
          }
        >
          Choose
        </button>
      </div>
    </div>
  );
}
