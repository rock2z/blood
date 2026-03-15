# Technical Decisions

## Stack

| Layer             | Technology                                    | Rationale                                                              |
| ----------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Engine            | TypeScript (pure, no runtime deps)            | Type safety, portable, testable in isolation                           |
| Server            | Node.js + Fastify + `ws`                      | Lightweight, TypeScript-native, fast WebSocket support                 |
| Client            | React + Vite + Tailwind CSS                   | Fast dev iteration, component model fits the multi-view UI             |
| Testing           | Jest + ts-jest                                | Already set up; familiar, great for unit tests                         |
| Lint              | ESLint v9 (flat config) + `typescript-eslint` | Modern config, strict TS rules                                         |
| Format            | Prettier                                      | Zero-config, enforced via pre-commit                                   |
| Pre-commit        | Husky + lint-staged                           | Blocks bad commits locally                                             |
| CI                | GitHub Actions                                | Lint + typecheck + test on every push/PR                               |
| Monorepo          | npm workspaces                                | Built-in, no extra tooling needed                                      |
| State persistence | In-memory only                                | Simple; game state is serialisable if we need to add persistence later |

## Repository Layout

```
/
├── packages/
│   ├── engine/        (implemented first)
│   ├── server/        (implemented second)
│   └── client/        (implemented third)
├── alignment/
└── .github/workflows/
```

## Script Scope

- **Now**: Trouble Brewing only (22 characters)
- **Later**: Architecture is data-driven and hook-based to support S&V, BMR, custom scripts without engine core changes

## Storyteller Model

- **Human Storyteller only.** No automated decisions.
- Every discretionary rule ("Storyteller may/might") surfaces as a UI prompt with options.
- Storyteller has a privileged WebSocket role — sees full Grimoire state.

## Development Approach

- **TDD**: tests written before or alongside implementation
- Engine tests: pure unit tests (no mocks needed — pure functions)
- Server tests: integration tests with a real WebSocket server
- Client tests: component tests with React Testing Library

## Build Order

1. Harness (lint, CI, pre-commit) — stable before any feature code
2. Engine — complete: day phase, state machine, action dispatch, ability hooks
3. Server — room management, WebSocket protocol
4. Client — Storyteller Grimoire + player views + voting UI

## Agreed On: 2026-03-14
