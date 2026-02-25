#!/usr/bin/env bash
# SessionStart hook: auto-install required plugins if not already installed
set -euo pipefail

INSTALLED_PLUGINS="${HOME}/.claude/plugins/installed_plugins.json"
KNOWN_MARKETPLACES="${HOME}/.claude/plugins/known_marketplaces.json"

install_plugin() {
  local marketplace_repo="$1"  # e.g. "obra/superpowers-marketplace"
  local marketplace_name="$2"  # e.g. "superpowers-marketplace"
  local plugin_name="$3"       # e.g. "superpowers@superpowers-marketplace"

  # Skip if already installed
  if [ -f "$INSTALLED_PLUGINS" ]; then
    if grep -q "$plugin_name" "$INSTALLED_PLUGINS" 2>/dev/null; then
      return 0
    fi
  fi

  # Add marketplace if not already known
  if [ ! -f "$KNOWN_MARKETPLACES" ] || \
     ! grep -q "$marketplace_name" "$KNOWN_MARKETPLACES" 2>/dev/null; then
    claude plugin marketplace add "$marketplace_repo" 2>/dev/null || true
  fi

  # Install plugin
  claude plugin install "$plugin_name" 2>/dev/null || true
}

# superpowers
install_plugin "obra/superpowers-marketplace" "superpowers-marketplace" "superpowers@superpowers-marketplace"

# n8n skills
install_plugin "czlonkowski/n8n-skills" "n8n-skills" "n8n-mcp-skills@n8n-skills"

exit 0
