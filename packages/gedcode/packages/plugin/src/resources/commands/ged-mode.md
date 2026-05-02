---
description: Turn Omni mode on or off for the current project
agent: gedcode
---
Interpret the user's desired mode from `$ARGUMENTS`.

Then:
- use `gedcode_set_mode`
- confirm the new mode
- if turning Omni mode on, ensure `.ged/` exists and summarize the next workflow step
- if turning Omni mode off, explain that `.ged/` remains as passive project context
- mention that `STATE.md` is updated automatically to reflect the current Omni mode
