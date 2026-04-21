---
description: Enforce architecture boundaries, layering, and module ownership during implementation and refactors.
---

Use this skill when:
- a change touches multiple modules, services, or packages
- a refactor may increase coupling
- a request may bypass existing boundaries

Rules:
1. Identify affected layers first.
2. Preserve boundaries unless the task explicitly requires changing them.
3. Prefer the smallest safe change over broad restructuring.
4. Call out layering violations, hidden dependencies, and architecture drift.
5. Recommend a safer structure when the proposed change is too coupled.

Output:
- architecture impact summary
- main risk areas
- recommended approach
- follow-up checks
