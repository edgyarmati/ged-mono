#!/bin/sh
# PreToolUse/Bash hook: reject `git commit` calls whose message doesn't
# start with a Conventional Commits prefix. If the command isn't a
# message-bearing git commit, allow silently.

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

case "$CMD" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

case "$CMD" in
  *"-m"*|*"--message"*) ;;
  *) exit 0 ;;
esac

# Look for a conventional-commits prefix anywhere in the command string.
# Handles plain -m "feat: x", -am, and heredoc forms (text appears verbatim).
if printf '%s' "$CMD" | grep -Eq '(^|[[:space:]"'\''])(feat|fix|refactor|docs|test|chore|ci|build|perf)(\([^)]+\))?!?:[[:space:]]'; then
  exit 0
fi

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Commit message must start with a Conventional Commits prefix: feat|fix|refactor|docs|test|chore|ci|build|perf (optional scope and ! allowed). See CLAUDE.md."}}
JSON
exit 0
