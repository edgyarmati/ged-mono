# grill-with-docs

Use as an enhanced `grill-me` variant when clarification reveals domain language, durable decisions, ADR-worthy tradeoffs, or reusable project context that should be captured for future sessions.

## Relationship to grill-me

Do not replace `grill-me`. Use `grill-me` as the default lightweight clarification gate for change requests. Use `grill-with-docs` when the conversation needs documentation side effects.

## Workflow

Ask one question at a time and include a recommended answer, just like `grill-me`. If the answer is discoverable in the codebase or docs, inspect those instead of asking.

While clarifying:

- compare user terms against existing project docs, standards, and ADRs;
- call out overloaded or conflicting terms;
- propose canonical vocabulary for fuzzy domain concepts;
- stress-test the plan with concrete scenarios and edge cases;
- identify decisions that are hard to reverse, surprising without context, and based on real tradeoffs.

## Documentation side effects

Only write docs when there is durable value:

- Add or refine project/domain vocabulary in the appropriate durable project context file when a term is resolved.
- Offer an ADR when a decision is hard to reverse, surprising, and tradeoff-driven.
- Do not batch important terminology updates until the end; record them when they crystallize.
- Do not turn implementation details into domain language.

## Planning handoff

After the grilling loop, make sure the active planning directory's `SPEC.md`, `TASKS.md`, and `TESTS.md` reflect the clarified vocabulary, decisions, constraints, and verification expectations.
