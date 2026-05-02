# improve-codebase-architecture

Use when the user asks to review architecture, find refactoring opportunities, improve testability, identify shallow modules, deepen modules, or make a codebase easier for humans and agents to navigate.

## Goal

Produce architecture review candidates, not automatic refactors. The output should help the user choose a follow-up change request.

## Vocabulary

- **Module** — any unit with an interface and implementation.
- **Interface** — everything a caller must know to use the module: types, invariants, ordering, error modes, and configuration.
- **Implementation** — the code hidden behind the interface.
- **Deep module** — a small interface hiding meaningful behavior.
- **Shallow module** — an interface almost as complex as the implementation.
- **Seam** — a place behavior can vary without editing callers in place.
- **Adapter** — a concrete implementation at a seam.
- **Locality** — changes, bugs, and knowledge concentrated in one place.
- **Leverage** — how much useful behavior callers get from a small interface.

## Review process

1. Read project context first: `.ged/PROJECT.md`, `.ged/STANDARDS.md`, `.ged/DECISIONS.md`, active work planning, docs, ADRs, and the repo map when useful.
2. Explore the relevant code without changing source files.
3. Look for friction:
   - understanding one concept requires bouncing across many tiny modules;
   - modules are pass-throughs or shallow abstractions;
   - tests require private knowledge or cannot reach real behavior;
   - seams have only one adapter and add complexity without leverage;
   - tightly-coupled modules leak implementation details across interfaces.
4. Apply the deletion test: if deleting a module only moves the same complexity to callers, it may not be earning its keep.
5. Present numbered deepening opportunities.

## Output format

For each candidate include:

- **Files** — concrete files/modules involved.
- **Problem** — why current structure causes friction.
- **Opportunity** — what would be deepened, consolidated, or moved behind a seam.
- **Benefits** — expected locality, leverage, and testing improvements.
- **Risk** — what could go wrong or why the candidate may not be worth doing.

End by asking which candidate the user wants to explore. Do not refactor automatically. If the user selects a candidate, start a normal Omni change request with grill, skill-fit, spec, tasks, tests, TDD/verification, and commits.
