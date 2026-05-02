# Project

## Goal

Build GedCode as an OpenCode plugin plus launcher that preserves the Omni workflow while relying on OpenCode for the host UX and runtime.

## Users

- developers who want Omni-style workflow enforcement inside OpenCode
- contributors extending GedCode's workflow, durable memory, repo map, and skill routing

## Constraints

- OpenCode remains the host product; no custom shell/fork direction
- keep launcher thin and plugin thick
- preserve the user's normal OpenCode setup unless launched through `gedcode`
- keep runtime/generated `.ged` state out of git by default

## Success Criteria

- GedCode launches OpenCode with isolated config and the GedCode plugin loaded
- `.ged/` bootstrap, standards import, repo map, skill sync, and workflow enforcement work in real OpenCode sessions
- durable `.ged` docs remain committable while runtime state stays ignored
