#!/usr/bin/env bash
# Check which ecommerce-marketing sub-skills are installed and which APIs are configured.
# Outputs a JSON summary to stdout.
#
# Since skill path env vars (AGENT_SKILL_DIR, SKILL_DIR) are only available in the
# system prompt text and NOT injected into the shell environment, the agent must
# pass them as positional arguments when calling this script.
#
# Usage:
#   bash scripts/check_environment.sh <account_skills_dir> [agent_skills_dir]
#
# Example:
#   bash scripts/check_environment.sh \
#     ~/.accio/accounts/123/skills \
#     ~/.accio/accounts/123/agents/MID-xxx/agent-core/skills

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <account_skills_dir> [agent_skills_dir]" >&2
  exit 1
fi

ACCOUNT_SKILLS_DIR="$1"
AGENT_SKILLS_DIR="${2:-}"
SKILLS_CONFIG="$ACCOUNT_SKILLS_DIR/skills_config.json"

REQUIRED_SKILLS=(
  "company-research"
  "competitive-landscape"
  "people-research"
  "product-marketing-context"
  "launch-strategy"
  "marketing-ideas"
  "content-strategy"
  "copywriting"
  "product-description-generator"
  "social-content"
  "instagram-marketing"
  "remotion"
  "mcp-tools"
  "review-summarizer"
  "social-network-mapper"
  "page-cro"
  "ab-test-setup"
  "sales-negotiator"
  "marketing-psychology"
)

is_disabled() {
  local skill="$1"
  if [ ! -f "$SKILLS_CONFIG" ]; then
    echo "false"
    return
  fi
  python3 -c "
import json, sys
with open('$SKILLS_CONFIG') as f:
    cfg = json.load(f)
for key, val in cfg.items():
    parts = key.rsplit('_', 1)
    name = parts[-1] if len(parts) > 1 else key
    if name == '$skill':
        if isinstance(val, dict) and val.get('enabled') is False:
            print('true')
            sys.exit(0)
print('false')
" 2>/dev/null || echo "false"
}

check_skill() {
  local skill="$1"
  local found="false"

  # Check account-level install
  if [ -f "$ACCOUNT_SKILLS_DIR/$skill/SKILL.md" ]; then
    found="true"
  fi

  # Check agent-level install
  if [ -n "$AGENT_SKILLS_DIR" ] && [ -f "$AGENT_SKILLS_DIR/$skill/SKILL.md" ]; then
    found="true"
  fi

  if [ "$found" = "false" ]; then
    echo "missing"
    return
  fi

  local disabled
  disabled=$(is_disabled "$skill")
  if [ "$disabled" = "true" ]; then
    echo "disabled"
  else
    echo "installed"
  fi
}

check_api() {
  local name="$1"
  case "$name" in
    exa)
      [ -n "${EXA_API_KEY:-}" ] && echo "true" || echo "false"
      ;;
    *)
      echo "false"
      ;;
  esac
}

# Build JSON output
echo "{"
echo '  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",'
echo '  "account_skills_dir": "'"$ACCOUNT_SKILLS_DIR"'",'
echo '  "agent_skills_dir": "'"${AGENT_SKILLS_DIR:-not provided}"'",'

# Skills
echo '  "skills": {'
total=${#REQUIRED_SKILLS[@]}
i=0
installed=0
disabled_count=0
missing=0
for skill in "${REQUIRED_SKILLS[@]}"; do
  i=$((i + 1))
  status=$(check_skill "$skill")
  case "$status" in
    installed) installed=$((installed + 1)) ;;
    disabled)  disabled_count=$((disabled_count + 1)) ;;
    missing)   missing=$((missing + 1)) ;;
  esac
  comma=","
  [ $i -eq $total ] && comma=""
  echo "    \"$skill\": \"$status\"$comma"
done
echo '  },'

# APIs
echo '  "apis": {'
echo "    \"exa\": $(check_api exa)"
echo '  },'

# Summary
echo '  "summary": {'
echo "    \"total_skills\": $total,"
echo "    \"installed\": $installed,"
echo "    \"disabled\": $disabled_count,"
echo "    \"missing\": $missing"
echo '  }'
echo "}"
