import { CharacterId, Grimoire, Player } from "../types";
import { TROUBLE_BREWING_CHARACTERS } from "../data/troubleBrewing";
import { getAlivePlayers } from "./grimoire";

// ============================================================
// Night order
// ============================================================

export interface NightStep {
  character: CharacterId;
  player: Player;
  /** Storyteller action to perform */
  action: string;
}

/**
 * Returns the ordered list of night steps for the first night.
 * Steps are filtered to characters that are in play and alive.
 *
 * First-night order (pre-character steps handled separately):
 *   1. Minion Info  (all Minions — handled outside character steps)
 *   2. Demon Info   (Imp      — handled outside character steps)
 *   3. Poisoner     (order 3)
 *   4. Spy          (order 4)
 *   5. Washerwoman  (order 5)
 *   6. Librarian    (order 6)
 *   7. Investigator (order 7)
 *   8. Chef         (order 8)
 *   9. Empath       (order 9)
 *  10. Fortune Teller (order 10)
 *  11. Butler       (order 11)
 */
export function getFirstNightOrder(grimoire: Grimoire): NightStep[] {
  const alive = getAlivePlayers(grimoire);
  return buildSteps(alive, (char) => char.firstNightOrder);
}

/**
 * Returns the ordered list of night steps for each night after the first.
 *
 * Each-night order (except first):
 *   1. Poisoner     (order 1)
 *   2. Spy          (order 2)
 *   3. Monk         (order 3)
 *   4. Imp          (order 4)
 *   5. Ravenkeeper  (order 5 — only if killed this night)
 *   6. Empath       (order 6)
 *   7. Fortune Teller (order 7)
 *   8. Undertaker   (order 8)
 *   9. Butler       (order 9)
 */
export function getEachNightOrder(
  grimoire: Grimoire,
  ravenkeeperKilledThisNight: boolean,
): NightStep[] {
  const alive = getAlivePlayers(grimoire);
  const steps = buildSteps(alive, (char) => char.eachNightOrder);

  // Ravenkeeper fires only if killed this night. Because they are already dead
  // by the time this function is called, we must look them up from all players
  // (not just alive) and insert them at their correct night-order position.
  if (!ravenkeeperKilledThisNight) {
    return steps.filter((s) => s.character !== "ravenkeeper");
  }

  // Include the dead Ravenkeeper if not already present (they are dead so
  // buildSteps above would have skipped them).
  if (!steps.some((s) => s.character === "ravenkeeper")) {
    const rkPlayer = grimoire.players.find(
      (p) => p.trueCharacter === "ravenkeeper",
    );
    if (rkPlayer) {
      steps.push({
        character: "ravenkeeper",
        player: rkPlayer,
        action: nightAction("ravenkeeper"),
      });
      // Re-sort to place Ravenkeeper at its correct position (eachNightOrder: 5).
      // For the Drunk, use perceivedCharacter's order.
      steps.sort((a, b) => {
        const aLookup =
          a.character === "drunk" ? a.player.perceivedCharacter : a.character;
        const bLookup =
          b.character === "drunk" ? b.player.perceivedCharacter : b.character;
        /* istanbul ignore next */
        const aOrder = TROUBLE_BREWING_CHARACTERS[aLookup].eachNightOrder ?? 0;
        /* istanbul ignore next */
        const bOrder = TROUBLE_BREWING_CHARACTERS[bLookup].eachNightOrder ?? 0;
        return aOrder - bOrder;
      });
    }
  }

  return steps;
}

// ============================================================
// Internal helpers
// ============================================================

function buildSteps(
  players: Player[],
  orderSelector: (
    char: (typeof TROUBLE_BREWING_CHARACTERS)[CharacterId],
  ) => number | null,
): NightStep[] {
  const steps: NightStep[] = [];

  for (const player of players) {
    // The Drunk wakes at the night-order position of their perceived Townsfolk
    // character (they believe they are that character). All other players use
    // their trueCharacter for the order lookup.
    const lookupId =
      player.trueCharacter === "drunk"
        ? player.perceivedCharacter
        : player.trueCharacter;
    const char = TROUBLE_BREWING_CHARACTERS[lookupId];
    /* istanbul ignore next */
    if (!char) continue;

    const order = orderSelector(char);
    if (order === null) continue;

    steps.push({
      character: player.trueCharacter,
      player,
      action: nightAction(player.trueCharacter),
    });
  }

  // Sort by night order position. For the Drunk, use perceivedCharacter's order.
  steps.sort((a, b) => {
    const aLookup =
      a.character === "drunk" ? a.player.perceivedCharacter : a.character;
    const bLookup =
      b.character === "drunk" ? b.player.perceivedCharacter : b.character;
    /* istanbul ignore next */
    const aOrder = orderSelector(TROUBLE_BREWING_CHARACTERS[aLookup]) ?? 0;
    /* istanbul ignore next */
    const bOrder = orderSelector(TROUBLE_BREWING_CHARACTERS[bLookup]) ?? 0;
    return aOrder - bOrder;
  });

  return steps;
}

/** Human-readable storyteller action for each character */
function nightAction(character: CharacterId): string {
  const actions: Record<CharacterId, string> = {
    washerwoman:
      "Wake the Washerwoman. Show two players (one is the named Townsfolk). Show that Townsfolk token.",
    librarian:
      "Wake the Librarian. Show two players (one is the named Outsider), or show the zero-Outsider info token.",
    investigator:
      "Wake the Investigator. Show two players (one is the named Minion). Show that Minion token.",
    chef: "Wake the Chef. Count adjacent evil pairs in the circle; show that many fingers.",
    empath:
      "Wake the Empath. Count living evil neighbours; show 0, 1, or 2 fingers.",
    fortuneteller:
      "Wake the Fortune Teller. They point at two players. Nod if either is the Demon or the Red Herring; shake head otherwise.",
    undertaker:
      "If a player was executed today: wake the Undertaker and show the executed player's character token.",
    monk: "Wake the Monk. They point at a player (not themselves) to protect.",
    ravenkeeper:
      "The Ravenkeeper was killed tonight: wake them. They point at any player; show that player's character token.",
    virgin: "No night action. Ability triggers during day nominations.",
    slayer: "No night action. Ability used publicly during the day.",
    soldier: "No night action. Passively protected from Demon attack.",
    mayor: "No night action. Death redirect and win condition are passive.",
    butler:
      "Wake the Butler. They point at a player (not themselves) to be their Master.",
    drunk:
      "Wake the Drunk as if they were the Townsfolk they believe they are. Give false or unreliable information.",
    recluse:
      "No night action. Registration as evil/Minion/Demon is decided per-check.",
    saint: "No night action. Ability triggers on execution.",
    poisoner:
      "Wake the Poisoner. They point at any player — that player is poisoned tonight and tomorrow.",
    spy: "Wake the Spy. Show them the open Grimoire.",
    scarletwoman:
      "No night action. Transforms automatically when the Demon dies with 5+ players alive.",
    baron: "No night action. Setup modifier only (+2 Outsiders).",
    imp: "Wake the Imp. They point at any player — that player dies. If they point at themselves, trigger self-kill logic.",
  };
  return actions[character];
}

// ============================================================
// Pre-character first-night steps
// ============================================================

export interface PreCharacterStep {
  label: string;
  description: string;
}

/**
 * Steps that happen before any character wakes on night 1.
 * Only applies to games with 7+ players.
 */
export function getFirstNightPreSteps(playerCount: number): PreCharacterStep[] {
  if (playerCount < 7) {
    return [
      {
        label: "Minion Info (skipped)",
        description:
          "Fewer than 7 players: Minions do not learn who the Demon is. Storyteller shakes head.",
      },
      {
        label: "Demon Info (skipped)",
        description:
          "Fewer than 7 players: The Demon does not learn the Minions. Storyteller shakes head.",
      },
    ];
  }

  return [
    {
      label: "Minion Info",
      description:
        "All Minions wake simultaneously. They open eyes, see each other, and learn which player is the Demon. Put them to sleep.",
    },
    {
      label: "Demon Info",
      description:
        "The Demon (Imp) wakes. Show them who the Minions are. Provide 3 good-character bluff tokens not in play. Put them to sleep.",
    },
  ];
}
