---
name: challenge-workflow
description: Red-team a product workflow — attack its states, transitions, actors and edge cases, then rank the findings.
disable-model-invocation: true
---

Red-team the named workflow: attack it until it breaks, then report ranked findings. You are the adversary, not the author — assume the workflow is flawed and hunt for proof.

## Process

1. **Map the terrain.** Explore the codebase and domain docs (`CONTEXT.md`, `docs/adr/`) until you can draw the workflow as states, transitions, actors, and side effects, using the glossary vocabulary. Done when every transition has a trigger, an actor, and a side-effect list — no "somehow" edges.

2. **Attack.** Run every applicable row of the attack grid against the map. For each row, either produce a concrete failure scenario (steps → broken outcome) or record why the workflow survives. Done when every row is marked **broken** or **survived** — no row skipped.

3. **Verify in code.** For each broken scenario, check the actual implementation before reporting — a failure the code already guards against is a survived row, not a finding. Done when every finding cites the file or behaviour that permits it.

4. **Report.** Write the findings to `.scratch/<workflow-slug>/challenge-<YYYY-MM-DD>.md`, ranked **Critique / Modéré / Mineur**, each with scenario, evidence, and recommendation, and end with a verdict: _ship_, _ship-with-fixes_, or _rethink_. Summarize the report back in conversation. Done when every broken row appears in the report exactly once — do not fix anything unless asked.

## Attack grid

| Attack | Question |
|---|---|
| Orphan state | Can an entity get stuck in a state no screen or action leads out of? |
| Ghost transition | Can the state change happen without the workflow's side effects firing (direct edit, import, concurrent user, other screen)? |
| Double fire | What happens when the same step runs twice (double click, retry, two users, replanning)? |
| Backward move | What breaks when an entity moves backwards through the flow? |
| Absent actor | What happens when the assigned human never acts (vacation, departure, overload)? |
| Silent failure | Which side effects can fail without anyone noticing (email, AI, notification, sync)? |
| Stale snapshot | Where does copied or derived data drift from its source, and does it matter? |
| Permission seam | Can an actor without the right role reach the action through another door (other screen, widget, action serveur)? |
| Time skew | What breaks when steps happen out of order or after long delays (weeks-old task, entity deleted or advanced meanwhile)? |
| Volume | Which lists, queries, or widgets degrade at 100× today's entity count? |
