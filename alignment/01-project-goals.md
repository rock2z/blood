# Project Goals

## Final Goal

A **full-stack online Blood on the Clocktower implementation** — all players (including the Storyteller) are humans connecting via a web client.

The system handles all game mechanics digitally:

- Night order execution (step-by-step prompts)
- Information delivery to the correct player only
- Voting and execution flow
- State transitions and win condition checks

The **Storyteller is a human player** with a privileged role. Every point where the rules say "Storyteller may/might" becomes a UI prompt with choices. The system never makes discretionary decisions automatically.

## What "Functional" Means

- All players join a room via a shareable link
- Each player sees only their own private information
- The Storyteller sees the full Grimoire + a guided step-by-step night order UI
- All player decisions (who to kill tonight, who to nominate, how to vote) are submitted through the UI
- The Storyteller confirms/selects for every discretionary call:
  - Washerwoman: which two players + which is the Townsfolk
  - Recluse registration: evil / specific Minion or Demon type / true (Outsider)
  - Mayor redirect: yes/no, and if yes, who
  - Drunk false info: what information to show the Drunk
  - Imp self-kill (no Scarlet Woman): which Minion becomes the Imp
  - Poisoned player false info: what to show them

## Out of Scope (for now)

- Automated Storyteller / AI decisions
- Spectator mode
- Persistent accounts / leaderboards
- Replay system
- Mobile app (web responsive is fine)

## Agreed On: 2026-03-14
