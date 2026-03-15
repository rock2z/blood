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

import React from "react";
import { PlayerSnapshot, PublicPlayer } from "../useGame";

interface Props {
  state: PlayerSnapshot;
}

export function PlayerView({ state }: Props): React.ReactElement {
  const { phase, day, winner, grimoire, voting, executionCandidateId } = state;

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

      <MyCharacterCard grimoire={grimoire} />
      <PlayerList
        players={grimoire.players}
        executionCandidateId={executionCandidateId}
      />
      {voting && <ActiveVote state={state} />}
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
