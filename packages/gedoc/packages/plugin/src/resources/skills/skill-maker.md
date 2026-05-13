# skill-maker

Use during the post-grill skill-fit checkpoint after `find-skills` cannot identify an adequate existing skill for the clarified task. Creates narrow project-local skills so the main agent can start with the missing expertise already available.

Purpose:
- Turn missing task expertise into a reusable local skill before planning or implementation.
- Keep generated skills project-local under `.ged/skills/<skill-name>/SKILL.md`; never install global/user skills.
- Capture enough research, constraints, examples, and verification guidance for future agents or workers to use the skill from the start.

Workflow:
1. Confirm the gap: state why bundled/project skills and `find-skills` results do not adequately cover the clarified task.
2. Research first. Prefer a research/explore subagent when subagent-driven development is available; otherwise research inline using repo context, project standards, official docs, and reputable references.
3. Choose a short kebab-case skill name that describes the missing capability.
4. Create `.ged/skills/<skill-name>/SKILL.md` with YAML frontmatter and concise instructions.
5. Record the new skill in `.ged/SKILLS.md` under project notes or current-work suggestions, including when to load it.
6. Load/use the local skill before final planning.

Skill shape:

```markdown
---
name: example-skill
description: Does the specific missing capability. Use when the user/task mentions concrete trigger terms, files, frameworks, or workflows that need this expertise.
---

# Example Skill

## When to use
- Specific trigger contexts.

## Workflow
1. First step.
2. Second step.

## Project constraints
- Repo-specific boundaries, standards, and non-goals.

## Verification
- Checks that prove the skill was applied correctly.
```

Writing guidance:
- Follow the lightweight `write-a-skill` pattern: strong description triggers, concise instructions, progressive disclosure, and optional scripts only for deterministic repeated work.
- Keep `SKILL.md` ideally under 100 lines. Split larger details into nearby reference files only when necessary.
- Explain why steps matter instead of adding brittle rules.
- Include concrete examples when they prevent ambiguity.
- Do not add time-sensitive claims or unverified external facts.

Review checklist:
- Description includes clear "Use when..." triggers.
- Skill is narrow to the current missing expertise, not a generic catch-all.
- Skill is project-local in `.ged/skills/` and no global install was attempted.
- `.ged/SKILLS.md` points future agents/workers to the new local skill.
- Planning artifacts can now reference the new skill before implementation starts.
