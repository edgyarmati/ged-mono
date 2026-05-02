# find-skills

Use during the post-grill skill-fit checkpoint when the clarified task needs domain expertise that is not covered by the currently bundled or project-recorded skills, or when the user asks to find/install/remove skills.

Purpose:
- Discover relevant external agent skills for specialized domains, tools, frameworks, testing, deployment, design, security, documentation, or workflows.
- Help decide whether GedCode already has enough skill coverage for the task.
- Keep project skill memory accurate when the user asks to delete or remove skills.

Workflow:
1. Identify the task domains and required expertise from the completed `grill-me` clarification.
2. Inventory available bundled/project skills from `.ged/SKILLS.md` and `gedcode_list_skills`.
3. Judge coverage explicitly: `sufficient` or `insufficient`, with a one-sentence reason.
4. If coverage is sufficient, load only the relevant skills for this task.
5. If coverage is insufficient, search for external skills with targeted keywords and verify source quality before recommending anything.
6. If no adequate existing skill is available, hand off to `skill-maker` to research and create a narrow project-local skill under `.ged/skills/<skill-name>/SKILL.md` before planning.
7. Ask the user before installing anything outside the project; GedCode's automatic fallback creates only local `.ged/skills/` skills.
8. If the user asks to remove/delete skills from the project, update `.ged/SKILLS.md` so those skills are no longer recorded or suggested.

Search guidance:
- Prefer specific domain queries such as `react performance`, `playwright e2e`, `convex auth`, `security review`, or `release automation`.
- Prefer reputable/high-install sources when recommending external skills.
- Do not recommend a skill solely because it appeared in search output; verify that it fits the task.
- Prefer local `skill-maker` creation over global installation when the missing expertise is project-specific or no high-quality external skill fits.

Boundary:
- Do not implement product changes while finding skills.
- Do not load domain/implementation skills before the skill-fit checkpoint, except core Omni workflow skills required to run the process.
- Do not install global/user skills during the automatic Omni workflow; global skills are explicitly user-managed.
