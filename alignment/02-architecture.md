# Architecture

## Repository Layout

```
/
├── packages/
│   ├── engine/        Pure TypeScript game rules — no I/O, no network
│   ├── server/        Node.js + Fastify + ws — rooms, WebSocket, action routing
│   └── client/        React + Vite + Tailwind — Storyteller Grimoire + player views
├── alignment/         Decision records and research summaries
├── .github/workflows/ CI pipelines
├── package.json       npm workspace root
└── tsconfig.base.json shared TS config
```

## Layer Responsibilities

### `packages/engine`

- Pure state machine: `dispatch(state, action) → state`
- No side effects, no I/O
- Exposes typed Actions and GameState
- Fully unit-testable in isolation
- All game rules encoded here

### `packages/server`

- Manages in-memory room map `roomId → GameState`
- Handles WebSocket connections (one per player)
- Routes incoming actions to the engine
- Broadcasts safe state deltas + private info to correct clients
- Handles Storyteller-only events (night-step confirmation, discretionary decisions)

### `packages/client`

- **Storyteller view**: full Grimoire, night order steps with decision prompts, voting dashboard
- **Player view**: your character, info received, voting/nomination controls
- Real-time updates over WebSocket

## Multi-Script Strategy

Characters are **data-only**. No character-specific logic is hard-coded into the engine core.

```
Script = {
  id: string
  name: string
  characters: CharacterId[]
}

Character = {
  id: CharacterId
  alignment: Alignment
  timing: AbilityTiming
  abilityText: string
  firstNightOrder: number | null
  eachNightOrder: number | null
}
```

Character abilities that require custom logic use a **hook registry** — a map from `CharacterId` to a handler function. The engine calls the hook when the character's trigger fires. Scripts register their own hooks.

This means:

- Adding Sects & Violets = new data file + new hook handlers, no engine core changes
- Adding Bad Moon Rising = same
- Custom scripts = supported by design

## WebSocket Protocol (rough)

```
Server → Client (all):
  game:state-update    { phase, day, alivePlayers, nominationQueue, ... }

Server → Client (private, player only):
  player:info          { type: "empath", value: 1 }
  player:character     { trueCharacter, perceivedCharacter }

Server → Storyteller only:
  storyteller:prompt   { stepId, character, options, required }
  storyteller:grimoire { full game state including evil info }

Client → Server:
  action:night-choice  { character, targetIds: PlayerId[] }
  action:nominate      { targetId: PlayerId }
  action:vote          { vote: boolean }
  storyteller:resolve  { stepId: string, decision: Record<string, unknown> }
  storyteller:deliver  { stepId: string, recipientId: PlayerId, info: unknown }
```

## State Persistence

**In-memory only.** Games do not survive server restarts. This keeps the server stateless and simple.

If persistence is needed later, game state is already a plain serialisable object — drop-in Redis/Postgres can be added without changing the engine.

## Agreed On: 2026-03-14
