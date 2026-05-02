# grill-me

Use automatically before planning or implementing a user-requested change, new feature, bug fix, refactor, migration, or behavior update.

Interview the user relentlessly until you and the user share the same understanding of the request.

Rules:
- Ask one question at a time.
- For each question, provide your recommended answer or default assumption.
- If a question can be answered by exploring the codebase, explore the codebase instead of asking.
- Walk down the decision tree in dependency order: goal, users, current behavior, desired behavior, constraints, edge cases, non-goals, tests, rollout, and success criteria.
- Stop grilling only when the requested behavior, constraints, and success criteria are concrete enough to update `.ged/SPEC.md`, `.ged/TASKS.md`, and `.ged/TESTS.md` safely.
- Do not implement during grilling.

Output style:
- Be direct and concise.
- Ask exactly one unresolved question per turn.
- Include `Recommended answer:` after the question when you have a sensible default.
