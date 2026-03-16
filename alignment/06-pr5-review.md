# PR Review: Hide private player secrets, harden server auth, fix Imp self-kill, and add tests

All 198 tests pass (12 client + 152 engine + 34 server). The changes are well-scoped and address the three core issues from the audit. Here is my assessment by area.

---

## ✅ Strengths

### Information hiding (`stateFilter.ts`, `useGame.ts`, `PlayerView.tsx`)

- Collapsing `myTrueCharacter` / `myPerceivedCharacter` / `myAlignment` / `myIsPoisoned` / `myIsDrunk` into a single `myCharacter` (the perceived character) is the right call. The Drunk sees their fake token; neither the true identity nor the poisoned/drunk flags leak to the client.
- Removing the drunk/poisoned alert banners from `PlayerView.tsx` is essential — those banners were a direct rules violation.
- The `EVIL_CHARACTERS` set for client-side alignment derivation is simple and covers all Trouble Brewing evil roles (`imp`, `poisoner`, `spy`, `scarletwoman`, `baron`).

### Server authorization (`handler.ts`)

- The Storyteller-only guard on `setup-players` is correct and the error message is clear.
- Expanding `storytellerOnlyActions` to include `start-game`, `resolve-night`, `advance-to-night`, `execute`, and `skip-execution` closes the most critical authorization gaps.
- The `test.each` parametrized tests for each blocked action are thorough.

### Imp self-kill fix (`dispatch.ts`)

- Restructuring the branch so `isSelfKill` is checked _before_ `targetIsProtected / soldierSelfProtected` is the correct fix. Monk and Soldier protection should never apply to the Imp's own self-elimination.
- The removed `!isSelfKill` guard on `soldierSelfProtected` is no longer needed (now we're already in the `else` branch) — good cleanup.
- Adding an explicit `return finaliseNightResolution(currentState)` when a kill is blocked is better than the previous silent fall-through.
- The two new dispatch tests (Monk-protecting-Imp, stale-`isProtected` flag on new Imp) cover both the primary case and the Scarlet Woman promotion edge case.

### Dead player night-choice guard (`dispatch.ts`)

- Simple, correct, well-placed before any effect is applied.

---

## ⚠️ Issues and Suggestions

### 1. `EVIL_CHARACTERS` set will become stale (low severity)

**File:** `packages/client/src/views/PlayerView.tsx`

The set is defined inline with no link to the canonical character data. If a new evil character is added to `@botc/engine`'s character data, this set must be manually updated. Consider deriving it from the engine's character data (e.g., `CHARACTERS` map already has alignment info) or at minimum adding a comment pointing to it.

```tsx
// Keep in sync with evil characters in @botc/engine/src/data/troubleBrewing.ts
const EVIL_CHARACTERS = new Set<CharacterId>([...]);
```

### 2. Spy and Recluse misregistration not handled in alignment display (low severity)

**File:** `packages/client/src/views/PlayerView.tsx`

The Spy registers as Townsfolk/Good to info characters but is truly a Minion. With the current `EVIL_CHARACTERS` set, the Spy sees `"evil"` (correct for game purposes). However, the Recluse registers as evil to info characters but is truly an Outsider. The Recluse would see `"good"` in the UI (correct for their true alignment). This is fine for now but worth noting if Storyteller-assisted misregistration mechanics are ever surfaced to players.

### 3. Dead-player night-choice check throws rather than silently rejects (design question)

**File:** `packages/engine/src/engine/dispatch.ts`

```ts
if (!player.isAlive) {
  throw new Error("Dead players cannot act at night");
}
```

Throwing here is consistent with how other invalid actions are handled in the engine (e.g., phase checks also throw). The server catches and surfaces this as an `error` message to the client. This is fine — just confirm this is the intended behavior (reject with error message vs. silently drop).

### 4. `night-choice` role/timing gating still permissive (out of scope, but noted)

The audit noted that any player can submit a `night-choice` even if their character shouldn't act at that timing. This PR doesn't address it (intentionally), but the dead-player guard doesn't close that gap either. Worth tracking in a follow-up.

### 5. `handler.ts` line 95 uncovered (minor)

Test coverage shows `handler.ts` line 95 uncovered. Worth a quick look to confirm it's unreachable or add a test if it's a real edge case.

---

## Summary

| Area                        | Verdict                        |
| --------------------------- | ------------------------------ |
| Information hiding          | ✅ Correct and complete        |
| Server authorization        | ✅ Correct, good test coverage |
| Imp self-kill fix           | ✅ Correct, well-tested        |
| Dead player guard           | ✅ Correct                     |
| Test coverage               | ✅ All 198 tests pass          |
| `EVIL_CHARACTERS` staleness | ⚠️ Low risk, add a comment     |
| Spy/Recluse alignment       | ℹ️ Not a bug for current scope |

**Verdict: Approve with minor suggestions.** The core fixes are correct and the test coverage is solid. The `EVIL_CHARACTERS` comment is the only suggestion I'd act on before merging.
