# Blood on the Clocktower (Trouble Brewing) — Monorepo

This repository implements an online, multiplayer **Blood on the Clocktower** game focused on the **Trouble Brewing** script.

## Project Goals

- Human Storyteller + human players connected over web clients.
- Engine-backed game state transitions for setup, night/day flow, nominations, voting, execution, and win checks.
- Private information delivery per-player and full Grimoire visibility for Storyteller.
- Progressively move all character ability handling to **engine-enforced** behavior, while preserving Storyteller discretion where rules permit.

See alignment docs for design context:

- `alignment/01-project-goals.md`
- `alignment/02-architecture.md`
- `alignment/03-research-summary.md`
- `alignment/04-tech-decisions.md`
- `alignment/05-implementation-audit.md`

## Repository Layout

```text
packages/
  engine/   Pure TS game rules/state machine
  server/   Node + ws message routing and room state
  client/   React UI (Storyteller and Player views)
alignment/  Architecture/research/audit docs
```

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Run tests

```bash
npm test
```

### 3) Typecheck, lint, format checks

```bash
npm run typecheck
npm run lint
npm run format:check
```

### 4) Run packages (workspace commands)

Use workspace scripts from each package as needed:

```bash
npm run -w @botc/server <script>
npm run -w @botc/client <script>
npm run -w @botc/engine <script>
```

(See each `packages/*/package.json` for available scripts.)

## Current Implementation Notes

- The codebase already includes strong core mechanics and test coverage.
- Remaining work is focused on:
  - strict identity/auth binding in server action routing,
  - completing engine-enforced ability coverage,
  - tightening edge-case rules validation.
