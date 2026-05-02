---
description: Review the codebase for architecture deepening opportunities
agent: gedcode
---
Run the `improve-codebase-architecture` workflow.

Scope:
- review only; do not refactor or edit source files automatically
- use the repo map, project docs, standards, ADRs, active planning files, and targeted code exploration
- identify shallow modules, weak seams, poor locality, and opportunities to deepen modules

Return numbered deepening opportunities. For each candidate include:
- files/modules involved
- problem
- opportunity
- benefits for locality, leverage, and testing
- risk or reason not to do it

Ask the user which candidate to explore. If they choose one, treat the refactor as a new Omni change request with normal grill, skill-fit, planning, testing, verification, and commits.
