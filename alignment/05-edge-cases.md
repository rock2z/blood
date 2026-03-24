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

**Implementation**: ✅ Resolved. `MyCharacterCard` in `PlayerView.tsx` looks up `abilityText` from `TROUBLE_BREWING_CHARACTERS[myCharacter]` where `myCharacter` is the `perceivedCharacter` exposed by the server filter. The Drunk sees the fake character's ability text, exactly as a real Townsfolk would.

**Source**: [Drunk - Blood on the Clocktower Wiki](https://wiki.bloodontheclocktower.com/Drunk)

---

---

## Mayor Edge Cases

### EC-3: Mayor redirect when Monk also protects the Mayor

**Scenario**: The Monk chooses to protect the Mayor. On the same night, the Imp targets the Mayor and the Storyteller has set a Mayor redirect target (Player X).

**Rule**: The Mayor's passive redirect ability fires when the Demon _attacks_ the Mayor (while Mayor is alive and healthy). Monk protection prevents a player from _dying_; it does not prevent the Mayor's ability from triggering.

**Implementation decision**: In `dispatch.ts`, the Mayor redirect is evaluated before the Monk protection check for the kill target. The redirect takes the kill away from the Mayor (to Player X), then Player X's protection status is checked. The Mayor's own `isProtected` flag is never consulted in this path.

**Practical effect**:

- If Monk protects Mayor and Mayor redirect is set → redirect fires; Player X may die. Mayor survives because the kill was redirected (not because Monk protected them).
- If Monk protects Mayor and **no** redirect is set → Mayor is the effective kill target, `isProtected` blocks the kill, no one dies.

**Conclusion**: This is the correct behaviour. Monk protection of the Mayor is effectively "wasted" when a redirect is also set, because the Mayor was never going to die anyway. The Monk's protection would matter only in the no-redirect case.

---

## Butler Edge Cases

### EC-4: Butler sequential-voting limitation in digital play

**Scenario**: In the physical game, all players raise their hands simultaneously (or a show-of-hands is resolved simultaneously). The Butler may vote YES if, at the moment their hand is counted, their Master's hand is already up.

In the digital implementation, voting is strictly sequential (clockwise from the player left of the nominated, nominated player last). The Butler can only see votes that have already been cast.

**Rule (digital interpretation)**: The Butler may vote YES only if their Master has voted YES in the same nomination **before** Butler's turn comes around. If the Master's seat is later in the clockwise order than the Butler's, the Master has not yet voted when Butler's turn arrives, and the Butler is forced to vote NO.

**Implementation**: `dispatch.ts` enforces this: if `voting.votes[masterId] !== true` when Butler votes, `effectiveVote` is overridden to `false`.

**Implication for play**: Storytellers and players should be aware that a Butler whose Master sits "behind" them in the vote order can never vote YES on a given nomination. This is an inherent limitation of sequential digital voting vs. simultaneous physical hand-raises and does not represent a bug.

---

## General Notes

- The Drunk's info is "unreliable" (not strictly always false). The Storyteller _may_ give accidentally correct info. This is a Storyteller discretion call, not a hard rule.
- The Drunk never knows they are the Drunk. Do not reveal drunk status in the player view.
- If the Drunk believes they are a first-night-only character (e.g. Washerwoman), they are only woken on Night 1 — same as the real character would be.
