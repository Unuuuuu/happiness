#!/usr/bin/env bash
# SessionStart hook: auto-install superpowers plugin if not already installed
set -euo pipefail

MARKETPLACE_NAME="superpowers-marketplace"
PLUGIN_NAME="superpowers@${MARKETPLACE_NAME}"

# Check if plugin is already installed
if [ -f "${HOME}/.claude/plugins/installed_plugins.json" ]; then
  if grep -q "$PLUGIN_NAME" "${HOME}/.claude/plugins/installed_plugins.json" 2>/dev/null; then
    exit 0
  fi
fi

# Add marketplace if not already known
if [ ! -f "${HOME}/.claude/plugins/known_marketplaces.json" ] || \
   ! grep -q "$MARKETPLACE_NAME" "${HOME}/.claude/plugins/known_marketplaces.json" 2>/dev/null; then
  claude plugin marketplace add "obra/${MARKETPLACE_NAME}" 2>/dev/null || true
fi

# Install plugin
claude plugin install "${PLUGIN_NAME}" 2>/dev/null || true

exit 0
