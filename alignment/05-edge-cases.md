# Edge Cases & Rule Clarifications

Documented edge cases discovered during development, with official rule references.

---

## Drunk Role Edge Cases

### EC-1: Drunk cannot believe they are a Townsfolk already in the game

**Scenario**: A player is the Drunk, but the Washerwoman (or any other Townsfolk) is already assigned to another player. That Townsfolk is not available as the Drunk's fake identity.

**Rule**: Per the official rules, the Drunk token is _removed_ from the bag and replaced with a single Townsfolk character token — one that represents the Drunk's false identity. Since there is only one physical token per character, if Washerwoman is already assigned to another player, it cannot _also_ be the Drunk's fake identity.

**Implementation**: Correct. `findDrunkFakeCharacter()` in `packages/engine/src/engine/setup.ts` filters out any Townsfolk already in the bag. The Storyteller UI in `StorytellerView.tsx` similarly only shows Townsfolk not already assigned.

**Implication**: In a 7-player game where all 5 Townsfolk slots are filled, the Drunk can only believe they are one of the 8 remaining Townsfolk _not_ in play. If the script has exactly 13 Townsfolk (Trouble Brewing), there are always at least 8 candidates available.

**Source**: [Drunk - Blood on the Clocktower Wiki](https://wiki.bloodontheclocktower.com/Drunk)

---

### EC-2: Drunk should see the ability text of their believed role

**Scenario**: The Drunk believes they are, say, the Washerwoman. They are woken on Night 1 as if they were the Washerwoman — but do they know what the Washerwoman actually does?

**Rule**: In the physical game, the Drunk holds the actual Washerwoman character token, which has the ability text printed on it. They fully believe they are the Washerwoman and act accordingly. The Storyteller delivers information _as if_ they were the Washerwoman (but potentially false).

**Current implementation gap**: `MyCharacterCard` in `PlayerView.tsx` only displays the character _name_ (`myCharacter`). The character's `abilityText` is not shown. A Drunk player sees "Washerwoman" but has no in-app reference to know what that ability does.

**Expected behavior**: The player card should show the ability text of `myCharacter` (the perceived character), exactly as any real Townsfolk would see it. For the Drunk this will be the fake character's ability text — which is intentional and correct, since they genuinely believe they have that ability.

**Action required**: Display `abilityText` from the character data in `MyCharacterCard`. The `perceivedCharacter` id is already exposed as `myCharacter` in the player snapshot; look up the character definition from `TROUBLE_BREWING_CHARACTERS` to get the ability text.

**Source**: [Drunk - Blood on the Clocktower Wiki](https://wiki.bloodontheclocktower.com/Drunk)

---

## General Notes

- The Drunk's info is "unreliable" (not strictly always false). The Storyteller _may_ give accidentally correct info. This is a Storyteller discretion call, not a hard rule.
- The Drunk never knows they are the Drunk. Do not reveal drunk status in the player view.
- If the Drunk believes they are a first-night-only character (e.g. Washerwoman), they are only woken on Night 1 — same as the real character would be.
