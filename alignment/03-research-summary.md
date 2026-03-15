# Research Summary

Research was conducted by automated agents before implementation began. This file records what was confirmed, what was partially covered, and what remains unknown.

## Fully Researched

### Trouble Brewing — Character Catalog

All 22 characters documented with:

- Exact printed ability text
- Timing (first-night-only / each-night / each-night-except-first / triggered / passive / once-per-game / setup-only)
- Night order position (first night + each subsequent night)
- Storyteller procedure (step-by-step)
- Key interactions (Spy, Recluse, Drunk, Poison)
- Edge cases

**Distribution** (13 Townsfolk + 4 Outsiders + 4 Minions + 1 Demon = 22):

| Type      | Characters                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Townsfolk | Washerwoman, Librarian, Investigator, Chef, Empath, Fortune Teller, Undertaker, Monk, Ravenkeeper, Virgin, Slayer, Soldier, Mayor |
| Outsiders | Butler, Drunk, Recluse, Saint                                                                                                     |
| Minions   | Poisoner, Spy, Scarlet Woman, Baron                                                                                               |
| Demon     | Imp                                                                                                                               |

### Core Game Mechanics

- Night phase / day phase sequence
- Night order (first night: Minion Info → Demon Info → characters; subsequent nights: characters only)
- Voting: `threshold = ceil(alive / 2)`. Ghost votes (dead players) count toward YES tally but NOT toward threshold denominator. Ties → **no execution** (both candidates cancel each other out).
- Voting order: clockwise from the player immediately clockwise of the **nominated** player; nominated player votes **last**.
- Execution: majority vote, one per day; win condition checked **immediately at moment of death** (not at end of day).
- Win conditions: Demon dead → good wins; 3 players alive + no execution today + Mayor alive and healthy → good wins; Saint executed → evil wins.
- Player states: alive, dead, ghostVoteUsed, poisoned, drunk, protected
- Baron modifier: −2 Townsfolk +2 Outsiders at setup (permanent)
- Demon bluffs: 3 good characters not in play, given to Imp on night 1 (7+ players only)
- Scarlet Woman: transforms to Imp when Demon dies with 5+ alive, non-Traveller players
- Imp self-kill: passes Demonhood to Scarlet Woman or (if ineligible) Storyteller-chosen Minion. **If Monk protected the Imp, the self-kill is prevented — Imp stays alive, no new Imp created.**

### Verified Character Interaction Rules (2026-03-14)

| Character       | Verified Rule                                                                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Butler**      | Can only vote YES if master has their hand raised at the moment Butler's vote is counted (or master was already counted YES). Master must vote YES in that same nomination round. Dead master not using ghost vote = Butler cannot vote YES. |
| **Spy**         | Sees the full physical Grimoire each night — all characters, alignments, and all reminder tokens. Storyteller shows full state.                                                                                                              |
| **Recluse**     | Registration as evil is Storyteller-discretionary, re-evaluated independently for every ability check, every night. Not fixed at setup.                                                                                                      |
| **Mayor**       | Has two independent abilities: (1) passive night redirect — if Demon attacks Mayor, Storyteller _may_ redirect kill to another player; (2) 3-player win — if exactly 3 alive and no execution today, good wins.                              |
| **Virgin**      | Ability fires based on **true** character alignment of nominator (not Spy/Recluse registering). Virgin self-nomination is legal and triggers ability (Virgin is executed as their own nominator).                                            |
| **Drunk**       | Info is unreliable (not strictly false); Storyteller may give accidentally correct info.                                                                                                                                                     |
| **Ravenkeeper** | May target any player when waking, including their killer. Spy/Recluse may produce false results.                                                                                                                                            |
| **Monk**        | Protection applies to Imp self-kill: if Imp targets themselves and Monk protected them, self-kill is prevented. Imp stays alive, no new Demon created.                                                                                       |

### Spy / Recluse Registration Rules

- **Spy**: may register as good + any Townsfolk or Outsider, per-check (Storyteller decides each time)
- **Recluse**: may register as evil + any Minion or Demon, per-check; retains ability after death
- Both: do NOT gain the ability of the character they register as

## Partially Researched

### Scripts Beyond Trouble Brewing

Agents began researching S&V and BMR but were rate-limited before completing. Key gaps:

- Sects & Violets characters not fully catalogued
- Bad Moon Rising characters not fully catalogued
- New mechanics (Fang Gu outsider-swap, Vigormortis, Zombuul undead kill, Po multi-kill) not confirmed in detail

This is acceptable since the architecture is designed to be script-agnostic and we are only implementing TB now.

### Official Script JSON Format

The BotC script tool JSON format was being researched when rate limits hit. Known fields:

- `id` — character identifier
- `name` — display name
- `team` — alignment
- `ability` — ability text
- `firstNight`, `otherNight` — night order
- `special` fields (`bag-disabled`, `bag-duplicate`, `replace-character`) — NOT yet confirmed

**Resolution**: We define our own internal format (already done in `packages/engine/src/types.ts`). If we later want to import official scripts, we add a converter.

### Jinxes

Jinxes (character-pair interaction overrides) were partially researched. Some examples found:

- Organ Grinder / Minstrel, Organ Grinder / Preacher, Princess / Cannibal, etc.

Jinxes are not relevant to TB (TB has none). Will research fully when adding S&V/BMR.

## Not Researched

- Travellers — neutral alignment, mid-game join, exile mechanic
- Fabled — Storyteller-only modifiers (Bootlegger found but not documented)
- Experimental characters
- Online clocktower.online architecture (open-source reference)

## Agreed On: 2026-03-14
