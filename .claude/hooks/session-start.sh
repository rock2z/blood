#!/bin/bash
# SessionStart hook for botc monorepo
# Runs at the start of every Claude Code web session.
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR}"

# ── 1. npm dependencies ──────────────────────────────────────────────────────
# Uses npm install (not ci) so the container cache is reused across sessions.
echo "[session-start] Installing npm dependencies..."
npm install

# ── 2. gh CLI ────────────────────────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "[session-start] Installing gh CLI..."
  apt-get install -y gh 2>/dev/null
fi

# ── 3. GitHub token ──────────────────────────────────────────────────────────
# Read from .claude/github_token (gitignored, you create this file once).
# The token is exported into the session environment via $CLAUDE_ENV_FILE.
TOKEN_FILE="${CLAUDE_PROJECT_DIR}/.claude/github_token"
if [ -f "$TOKEN_FILE" ]; then
  GH_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
  if [ -n "$GH_TOKEN" ]; then
    echo "export GH_TOKEN=${GH_TOKEN}" >> "${CLAUDE_ENV_FILE}"
    echo "[session-start] GH_TOKEN loaded from .claude/github_token"
  fi
else
  echo "[session-start] WARNING: .claude/github_token not found — gh pr create will not work."
  echo "[session-start]   Create the file with your GitHub PAT (repo scope) to enable it."
fi

echo "[session-start] Done."
