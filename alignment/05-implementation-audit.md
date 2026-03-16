# Implementation Audit — Trouble Brewing Repository

_Date: 2026-03-16_

## Scope

This audit compares:

1. The project's stated goals and architecture.
2. The current implementation in engine/server/client.
3. The existing automated tests.
4. Public rules references attempted via web search (network access was blocked in this environment; details below).

## Web Research Attempt

I attempted to fetch public rules references (official wiki and search engines) but received blocked/empty responses from outbound HTTP in this environment (e.g. `403 Forbidden` from `https://example.com`).

As a result, external verification relied on known Trouble Brewing mechanics already summarized in `alignment/03-research-summary.md`.

## High-Level Understanding

The repository implements a monorepo with:

- `@botc/engine`: pure game rules and state transitions.
- `@botc/server`: in-memory room and WebSocket transport.
- `@botc/client`: React Storyteller and Player views.

The implementation already supports:

- Setup of players/characters.
- First-night and recurring night flow scaffolding.
- Nominations, voting, executions.
- Several character-specific mechanics (Virgin, Saint, Slayer, Monk, Soldier, Mayor redirect, Scarlet Woman, Imp self-kill branch, Ravenkeeper pause).
- State filtering between Storyteller and Player clients.

## Confirmed Documentation Ambiguities / Gaps

1. **No top-level gameplay/status README.**
   The alignment docs describe target architecture and goals, but there is no single current-state implementation matrix (what is fully implemented, partial, missing).

2. **No explicit trust/security model in protocol docs.**
   The architecture's protocol section defines message shapes but not authorization guarantees (which actions must be Storyteller-only server-side).

3. **Character coverage lacks a completion checklist.**
   Character data is complete, but ability execution is mixed (some automated, some Storyteller-manual), and this split is not tracked in one canonical implementation-status table.

## Documented Rules vs Code Mismatches

1. **Drunk secrecy is broken for players.**
   Player snapshots include `myTrueCharacter` and `myIsDrunk`, and Player UI explicitly tells the user they are the Drunk and reveals their true character.
   That conflicts with the Drunk design intent in Trouble Brewing and with this project's own text that Drunk should think they are another Townsfolk.

2. **Poison secrecy is also broken for players.**
   Snapshot/API and Player UI directly expose `myIsPoisoned`.
   In Trouble Brewing, poisoned status is generally hidden from players.

3. **Server does not enforce Storyteller-only setup.**
   `setup-players` is accepted from any identified client; no role guard is present.

4. **Server only guards a subset of Storyteller-only actions.**
   Current guard blocks only 3 actions; other high-impact actions (`start-game`, `resolve-night`, `advance-to-night`, `execute`, `skip-execution`) are not restricted.

5. **Night-choice actions can be submitted by dead players.**
   `handleNightChoice` does not validate `player.isAlive` before applying role effects.

6. **Night-choice role gating is permissive.**
   Any player's `night-choice` is accepted during night phases, even when their character should not act at that timing; this is manageable for a trustful Storyteller workflow but is not aligned with strict rules enforcement.

## Implementation Bugs / Incorrect Behavior

1. **Critical bug: Imp self-kill checks wrong target for Monk/Soldier blocking.**
   In night resolution, when Imp targets themselves, protection checks are computed against the Imp target and can block the self-kill path entirely.
   - Soldier check can incorrectly treat Imp as Soldier-protected if the Imp has transformed from Scarlet Woman and retained old `isProtected`/status state.
   - More fundamentally, self-kill should resolve via self-kill logic branch regardless of ordinary target protection checks.

2. **Authorization bug: non-Storytellers can mutate room state.**
   Any player can currently send `setup-players` and several non-guarded control actions.

3. **Rules leak bug: private hidden-state exposed to players.**
   Player-facing API/UI leaks true character and poisoned/drunk status.

4. **Potential fairness bug: no strict vote turn-order enforcement.**
   Voting checks eligibility and duplicate voting but does not enforce that voters act in the required clockwise sequence.

## Test Coverage Gaps

1. No tests asserting unauthorized clients are blocked from `setup-players`.
2. No tests asserting unauthorized clients are blocked from day/night control actions outside the 3 currently guarded actions.
3. No tests for dead-player `night-choice` rejection.
4. No tests for “player snapshots must not reveal true Drunk identity / poisoned status.”
5. No regression test for Imp self-kill interaction with protection checks.

## Proposed Next Steps (Most Logical Sequence)

1. **Fix information-leak model first (high product correctness).**
   - Remove `myTrueCharacter`, `myIsDrunk`, `myIsPoisoned` from player snapshots.
   - Keep only `myPerceivedCharacter` and role-appropriate private data.
   - Update Player UI accordingly.

2. **Harden server authorization (high security/integrity).**
   - Restrict `setup-players` to Storyteller.
   - Expand server-side action ACL to all Storyteller-controlled phase/resolve/execute actions.
   - Add handler tests for denial cases.

3. **Fix night-resolution self-kill path (high gameplay correctness).**
   - Ensure Imp self-kill bypasses normal target protection logic and always enters self-kill branch.
   - Add focused engine tests for Monk/Soldier interactions with Imp self-kill.

4. **Add strict action validity checks in engine.**
   - Reject `night-choice` from dead players.
   - Optionally validate per-character timing windows if the team wants stronger engine authority.

5. **Improve rules-implementation traceability.**
   - Add a character-by-character “implemented / storyteller-assisted / missing” matrix.
   - Link each mechanic to tests.

6. **Then continue feature depth.**
   - Formalize night-order executor UX so required character steps are visibly complete before `resolve-night`.
   - Implement remaining nuanced TB interactions (Spy/Recluse registration hooks in info checks, Undertaker/Empath/etc. computed helper outputs for Storyteller tooling).

## Suggested Delivery Plan (2 short iterations)

- **Iteration A (stability):** secrecy model + authorization + tests.
- **Iteration B (rules depth):** self-kill fix + alive/timing validation + regression tests + docs matrix.

This sequencing minimizes exploitability and hidden-info leakage before adding more mechanics.
