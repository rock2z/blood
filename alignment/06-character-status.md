# Character Implementation Status — Trouble Brewing

_Last updated: 2026-03-16_

This document tracks the implementation completeness of every Trouble Brewing character across the three packages (`engine`, `server`, `client`).

**Columns:**

- **Setup**: Character included in token bag / setup counts. ✅ = done.
- **Info computed**: A helper function in `engine/infoHelpers.ts` computes the correct answer for the Storyteller to deliver. ✅ = done, — = not applicable (no info ability).
- **Night choice automated**: The player submits their night target through the UI; the engine records it. ✅ = done, — = passive/no action.
- **Day ability automated**: The ability fires automatically during day actions in the engine. ✅ = done, — = no day ability.
- **Storyteller-assisted**: Storyteller manually delivers info or resolves the ability. 🔶 = manual step still required.
- **Tests**: Engine tests cover this character's core mechanic. ✅ = yes, 🔶 = partial.

---

## Townsfolk

| Character          | Setup | Info computed                   | Night choice                                 | Day ability                                | ST-assisted                      | Tests |
| ------------------ | ----- | ------------------------------- | -------------------------------------------- | ------------------------------------------ | -------------------------------- | ----- |
| **Washerwoman**    | ✅    | ✅ `computeWasherwomanInfo`     | —                                            | —                                          | 🔶 ST delivers                   | ✅    |
| **Librarian**      | ✅    | ✅ `computeLibrarianInfo`       | —                                            | —                                          | 🔶 ST delivers                   | ✅    |
| **Investigator**   | ✅    | ✅ `computeInvestigatorInfo`    | —                                            | —                                          | 🔶 ST delivers                   | ✅    |
| **Chef**           | ✅    | ✅ `computeChefInfo`            | —                                            | —                                          | 🔶 ST delivers                   | ✅    |
| **Empath**         | ✅    | ✅ `computeEmpathInfo`          | —                                            | —                                          | 🔶 ST delivers                   | ✅    |
| **Fortune Teller** | ✅    | ✅ `computeFortuneTellerResult` | —                                            | —                                          | 🔶 ST delivers                   | ✅    |
| **Undertaker**     | ✅    | ✅ `computeUndertakerInfo`      | —                                            | —                                          | 🔶 ST delivers                   | ✅    |
| **Monk**           | ✅    | —                               | ✅ player submits; engine records protection | —                                          | —                                | ✅    |
| **Ravenkeeper**    | ✅    | —                               | ✅ player submits (pending flag in engine)   | —                                          | 🔶 ST delivers character learned | ✅    |
| **Virgin**         | ✅    | —                               | —                                            | ✅ auto-executes first Townsfolk nominator | —                                | ✅    |
| **Slayer**         | ✅    | —                               | —                                            | ✅ once-per-game shoot auto-kills Demon    | —                                | ✅    |
| **Soldier**        | ✅    | —                               | —                                            | —                                          | —                                | ✅    |
| **Mayor**          | ✅    | —                               | —                                            | ✅ 3-player win; redirect is ST-set        | 🔶 ST sets redirect target       | ✅    |

## Outsiders

| Character   | Setup | Info computed | Night choice                    | Day ability                    | ST-assisted                                      | Tests |
| ----------- | ----- | ------------- | ------------------------------- | ------------------------------ | ------------------------------------------------ | ----- |
| **Butler**  | ✅    | —             | ✅ player submits master choice | —                              | —                                                | ✅    |
| **Drunk**   | ✅    | —             | —                               | —                              | 🔶 ST delivers false info as perceived Townsfolk | ✅    |
| **Recluse** | ✅    | —             | —                               | —                              | 🔶 ST decides registration per check             | ✅    |
| **Saint**   | ✅    | —             | —                               | ✅ evil wins if Saint executed | —                                                | ✅    |

## Minions

| Character         | Setup | Info computed | Night choice                           | Day ability                                  | ST-assisted                                 | Tests |
| ----------------- | ----- | ------------- | -------------------------------------- | -------------------------------------------- | ------------------------------------------- | ----- |
| **Poisoner**      | ✅    | —             | ✅ player submits; engine marks poison | —                                            | —                                           | ✅    |
| **Spy**           | ✅    | —             | —                                      | —                                            | 🔶 ST shows Grimoire snapshot to Spy player | ✅    |
| **Scarlet Woman** | ✅    | —             | —                                      | ✅ auto-promotes to Imp when Demon dies (5+) | —                                           | ✅    |
| **Baron**         | ✅    | —             | —                                      | —                                            | —                                           | ✅    |

## Demon

| Character | Setup | Info computed | Night choice                  | Day ability | ST-assisted                              | Tests |
| --------- | ----- | ------------- | ----------------------------- | ----------- | ---------------------------------------- | ----- |
| **Imp**   | ✅    | —             | ✅ player submits kill target | —           | 🔶 self-kill: ST chooses minion if no SW | ✅    |

---

## Summary

### Fully automated (no Storyteller input needed at runtime)

Virgin, Slayer, Soldier, Saint, Scarlet Woman, Baron, Monk (night target submission), Butler (master submission), Poisoner (target submission), Imp (kill target submission).

### Info helpers available (Storyteller still delivers, but math is done)

Washerwoman, Librarian, Investigator, Chef, Empath, Fortune Teller, Undertaker, Ravenkeeper.

### Storyteller still fully manual

- **Spy**: Storyteller must show the Spy player the full Grimoire each night. No automated delivery yet.
- **Recluse**: Storyteller decides per-check registration (no engine hook yet).
- **Drunk**: Storyteller gives false/unreliable info when Drunk wakes. The engine ensures the Drunk sees a fake Townsfolk identity; the actual false info content is chosen by Storyteller.
- **Mayor redirect**: Storyteller manually sets the redirect target before resolve-night if they choose to redirect.
- **Demon bluffs**: Automatically generated at setup; Storyteller tells the Imp.

---

## Planned Work (not yet started)

| Item                                                                           | Priority |
| ------------------------------------------------------------------------------ | -------- |
| Automated Spy Grimoire delivery (push ST snapshot to Spy client on night step) | Medium   |
| Recluse/Spy registration hooks in info helpers                                 | Low      |
| StorytellerView helpers showing computed Empath/Chef/FT answers in-UI          | Low      |
