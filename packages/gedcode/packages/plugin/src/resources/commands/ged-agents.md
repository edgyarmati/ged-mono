---
description: Configure optional GedCode native sub-agents
agent: gedcode
---
Interpret the user's desired `/ged-agents` action from `$ARGUMENTS`.

Supported actions:

- `status`: call `gedcode_agents_status` and summarize global, project, and effective settings.
- `on`: call `gedcode_update_agents_settings` with `enabled: true` and `scope: "global"`.
- `off`: call `gedcode_update_agents_settings` with `enabled: false` and `scope: "global"`.
- `on --project`: call `gedcode_update_agents_settings` with `enabled: true` and `scope: "project"`.
- `off --project`: call `gedcode_update_agents_settings` with `enabled: false` and `scope: "project"`.
- `setup`: run the guided setup walkthrough below.

If no action is provided, show `status` first and then ask whether the user wants `on`, `off`, or `setup`.

For `setup`:

1. Call `gedcode_agents_status`.
2. Call `gedcode_read_model_recommendations` and read any guidance from `model-recommendations.md`.
3. Try to inspect available OpenCode models with bash command `opencode models`. If the command fails, explain that model choices can still be entered manually as exact `<provider>/<model>` strings. Do not invent model IDs; if the user suggests a model, prefer the exact ID visible in `opencode models` or provided by the user.
4. Walk the user through setup one question at a time:
   - enable native GedCode sub-agents?
   - write global settings or project override?
   - use the invoking/orchestrator model for sub-agents, or choose a shared default model?
   - optionally choose per-agent models for `ged-explorer`, `ged-planner`, and `ged-verifier`.
   - optionally choose provider options by using an object config such as `{ "model": "openai/gpt-5.5", "reasoningEffort": "high" }` instead of a plain model string.
5. Explain the orchestration model before recommending models: GedCode uses a single-writer invariant. The primary `gedcode` agent remains the active-worktree writer and decision owner; subagents are read-only intelligence contributors. There is no writer subagent role. Native subagents are optional to enable, but when enabled they are mandatory checkpoints for non-trivial change requests unless the agent records a skip reason.
6. Recommend sensible models using, in order:
    - project `model-recommendations.md`
    - global `model-recommendations.md`
    - visible `opencode models` output
    - general heuristics: cheaper/faster for `ged-explorer`, stronger reasoning for `ged-planner` smart-friend critique, and reliable/tool-capable for `ged-verifier` clean-context review/checks.
7. Before calling `gedcode_update_agents_settings`, summarize the exact settings that will be written and confirm ambiguous model IDs. Call `gedcode_update_agents_settings` with only the selected values. Do not write bundled prompt/default agent definitions into settings. Preserve object configs when the user selected provider options.
8. Explain that settings take effect after OpenCode reloads plugin configuration (usually a new GedCode/OpenCode session).

Keep `.ged/` for workflow memory only. Agent settings live in `~/.gedcode/settings.json` by default, with optional project overrides in `.gedcode/settings.json` that are gitignored.
