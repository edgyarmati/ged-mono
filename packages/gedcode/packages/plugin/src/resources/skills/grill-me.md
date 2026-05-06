# grill-me

Use before planning or implementing a user-requested change, new feature, bug fix, refactor, migration, or behavior update when the request is not already fully specified.

Clarify only the missing details until you and the user share the same understanding of the request. If the request is already clear, skip grilling and proceed to the skill-fit checkpoint.

Rules:
- Ask one question at a time in chat.
- For each question, provide your recommended answer or default assumption.
- If a question can be answered by exploring the codebase, explore the codebase instead of asking.
- Walk down the decision tree in dependency order: goal, users, current behavior, desired behavior, constraints, edge cases, non-goals, tests, rollout, and success criteria.
- Stop grilling only when the requested behavior, constraints, and success criteria are concrete enough to update `.ged/work/<work-id>/SPEC.md`, `.ged/work/<work-id>/TASKS.md`, and `.ged/work/<work-id>/TESTS.md` safely.
- Do not implement during grilling.

Output style:
- Be direct and concise.
- Ask exactly one unresolved question per turn.
- Include `Recommended answer:` after the question when you have a sensible default.
