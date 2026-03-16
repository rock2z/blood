# Implementation Audit — Trouble Brewing Repository

_Date: 2026-03-16 (revised — see note below)_

> **Revision note (2026-03-16):** The original audit (written 2026-03-16) contained several
> factually incorrect claims about the state of the code. Those claims have been corrected
> below after a line-by-line review of the actual source. The one confirmed open bug
> (Monk self-kill) has been fixed in the same session.

## Scope

This audit compares:

1. The project's stated goals and architecture.
2. The current implementation in engine/server/client.
3. The existing automated tests.
4. The verified rules in `alignment/03-research-summary.md`.

## High-Level Understanding

The repository implements a monorepo with:

- `@botc/engine`: pure game rules and state transitions.
- `@botc/server`: in-memory room and WebSocket transport.
- `@botc/client`: React Storyteller and Player views.

The implementation already supports:

- Setup of players/characters.
- First-night and recurring night flow scaffolding.
- Nominations, voting, executions.
- Several character-specific mechanics (Virgin, Saint, Slayer, Monk, Soldier, Mayor redirect,
  Scarlet Woman, Imp self-kill branch, Ravenkeeper pause).
- State filtering between Storyteller and Player clients.
- Correct dead-player night-choice rejection.
- Correct authorization guards (8 Storyteller-only actions, including `setup-players`).
- Correct Drunk secrecy (player receives `perceivedCharacter`, not `trueCharacter`).

## Confirmed Documentation Ambiguities / Gaps

1. **No top-level gameplay/status README.**
   The alignment docs describe target architecture and goals, but there is no single
   current-state implementation matrix (what is fully implemented, partial, missing).
   See `alignment/06-character-status.md` for the recommended matrix.

2. **No explicit trust/security model in protocol docs.**
   The architecture's protocol section defines message shapes but not authorization
   guarantees. These are enforced in `server/src/handler.ts` lines 74 and 125–134.

3. **Character coverage lacks a completion checklist.**
   Character data is complete, but ability execution is mixed (some automated, some
   Storyteller-manual), and this split is not tracked in one canonical document.

## Documented Rules vs Code — Current State

All items previously listed as mismatches have been resolved in the current codebase.
The following table reflects the **corrected** analysis:

| Item                          | Claim in original audit                      | Actual code state                                                         |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| `setup-players` authorization | "not enforced"                               | Guarded at `handler.ts:74`                                                |
| Storyteller-only action ACL   | "only 3 actions"                             | 8 actions listed at `handler.ts:125–134`                                  |
| Dead-player night-choice      | "no validation"                              | Error thrown at `dispatch.ts:389–391`                                     |
| Drunk secrecy                 | "broken — exposes `myTrueCharacter`"         | `filterForPlayer` returns `perceivedCharacter` at `stateFilter.ts:87,118` |
| Poison secrecy                | "broken — exposes `myIsPoisoned`"            | Field not present in `PlayerSnapshot` at `stateFilter.ts:28–41`           |
| Imp self-kill + protection    | "protection can incorrectly block self-kill" | No such bug in current code                                               |

## Implementation Bugs — Fixed

### ~~Critical bug: Monk self-kill protection (FIXED 2026-03-16)~~

**Rule** (`alignment/03-research-summary.md` line 52):

> "Protection applies to Imp self-kill: if Imp targets themselves and Monk protected them,
> self-kill is prevented. Imp stays alive, no new Demon created."

**Was**: The self-kill branch in `handleResolveNight` entered immediately without checking
`isProtected`. Protection checks existed only in the `else` (non-self-kill) branch.

**Fix applied**: Added Monk-protection check at the top of the `if (isSelfKill)` block in
`packages/engine/src/engine/dispatch.ts`. If the Imp is protected by a live, healthy Monk,
`finaliseNightResolution` is called immediately with no death.

**Regression tests added** in `dispatch.test.ts`:

- `Monk protecting Imp: self-kill is blocked, Imp survives, game continues`
- `Poisoned Monk does NOT block Imp self-kill — Imp dies`
- `self-kill is not blocked by stale isProtected flag when no Monk is in play`

## Known Rules Interpretations (Not Bugs)

### Butler sequential voting limitation

In the digital sequential voting model (`dispatch.ts:554–574`), the Butler's YES vote is
suppressed unless the master has already voted YES earlier in the clockwise sequence.
In the physical game, voting is simultaneous (raised hands), so the Butler just needs to
see the master's hand up at the same moment.

**Consequence**: If Butler is seated clockwise before their master, Butler votes before the
master and can never vote YES in that game.

**Recommendation**: The Storyteller should advise Butler players to choose a master who sits
clockwise before them in the circle.

### Ghost-vote-used players excluded from future nominations

Dead players who have used their ghost vote (`ghostVoteUsed: true`) are excluded from
`allVoters` entirely in `handleNominate` (`dispatch.ts:499–503`). Per strict rules they
could still vote NO (silently). In practice their NO votes do not affect outcomes. This
is a deliberate UX simplification — if included, they would need to explicitly vote NO in
every subsequent nomination.

## Open Implementation Gaps

1. **No night-choice UI for players.**
   `PlayerView` has no generic panel for characters who pick a night target (Monk, Butler,
   Poisoner, Imp). Players currently cannot submit their night actions through the client.
   See proposed `NightChoicePanel` component in `client/src/views/PlayerView.tsx`.

2. **No Spy Grimoire delivery.**
   The Spy's "see the full Grimoire" ability is entirely Storyteller-handled. The server
   could automatically push the Storyteller snapshot to the Spy client during their night step.

3. **No info-computation helpers for Storyteller.**
   Characters such as Empath, Fortune Teller, Chef, Undertaker, Washerwoman, Librarian, and
   Investigator require the Storyteller to compute the correct (or plausibly incorrect)
   information manually. Helper functions in the engine would assist.

4. **Night-choice role gating is permissive.**
   Any player can submit a `night-choice` action during night phases; the engine only
   processes choices for `monk`, `poisoner`, `imp`, and `butler` — others are silently
   ignored. Manageable for a Storyteller-supervised workflow but not strict rules enforcement.

5. **Vote turn-order not enforced engine-side.**
   The client UI enforces sequential voting (showing "Waiting for X to vote…"), but the
   engine itself does not reject out-of-order votes. A modified client could vote out of
   sequence as long as the player is eligible.

6. **Ravenkeeper choice lacks player-identity validation.**
   The `ravenkeeper-choice` action does not carry a `playerId` field, so the engine cannot
   verify it was sent by the actual Ravenkeeper player. In practice the UI gating (`myCharacter
=== "ravenkeeper"` in `PlayerView`) prevents abuse.

## Proposed Next Steps

1. **Add night-choice UI for players** (`client/src/views/PlayerView.tsx`).
2. **Add info-computation helpers** (`engine/src/engine/infoHelpers.ts`):
   Empath, Chef, Fortune Teller, Undertaker, Washerwoman, Librarian, Investigator.
3. **Add character implementation status matrix** (`alignment/06-character-status.md`).
4. **Implement Spy Grimoire delivery** — push Storyteller snapshot to Spy client on night step.
5. **Optionally harden night-choice role gating** for stricter rules enforcement.

## Suggested Delivery Plan

- **Iteration A (UX completeness):** night-choice panels + info helpers + character matrix.
- **Iteration B (rules depth):** Spy delivery + role gating + vote order enforcement +
  documentation of all remaining Storyteller-discretion mechanics.
