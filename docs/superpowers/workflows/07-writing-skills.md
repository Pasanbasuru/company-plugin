# Workflow 7 — Writing or editing a skill

**Trigger shape:** user asks to create a new skill or modify an existing one.

**Audit verdict:** PASS against superpowers 5.0.7. Iron Law `NO SKILL WITHOUT A FAILING TEST FIRST` is literally in `writing-skills/SKILL.md` line 377. RED-GREEN-REFACTOR and pressure-scenario testing fully documented in the skill and its companion `testing-skills-with-subagents.md`.

## Layer 1 — superpowers core flow

```mermaid
%%{init: {'theme':'dark','themeVariables':{'fontSize':'11px'},'flowchart':{'nodeSpacing':20,'rankSpacing':26,'padding':4,'diagramPadding':4}}}%%
flowchart TD
    classDef extPlugin     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef companyPlugin fill:#1f5a5bd9,stroke:#4fb0b2,stroke-width:1.25px,color:#dff3f4
    classDef rule     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef skill    fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef agent    fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef gate     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef artifact fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5

    P["User: write a skill for X"]
    P --> G1{Gate from Workflow 1 → YES}
    G1 --> WS[Skill: writing-skills]
    WS --> IL{{"Iron Law:<br/>NO SKILL WITHOUT A FAILING TEST FIRST"}}
    IL --> REQ[[REQUIRED BACKGROUND:<br/>test-driven-development]]

    REQ --> RED[RED — Baseline testing]
    RED --> RED1[Build 3+ pressure scenarios]
    RED1 --> RED2[[Dispatch subagents WITHOUT skill]]
    RED2 --> RED3[Document rationalizations verbatim]

    RED3 --> GREEN[GREEN — Write minimal skill]
    GREEN --> G2[Valid name + YAML frontmatter]
    G2 --> G3[Description starts with Use when<br/>NO workflow summary]
    G3 --> G4[Address specific rationalizations]
    G4 --> G5[One excellent example]
    G5 --> G7[[Dispatch same scenarios WITH skill]]
    G7 --> G8{Agents comply?}

    G8 -- no --> REFACTOR
    G8 -- yes --> REFACTOR[REFACTOR — close loopholes]
    REFACTOR --> RF1[Find new rationalizations]
    RF1 --> RF2[Add counters + Red Flags table]
    RF2 --> RF3[Re-test until bulletproof]
    RF3 --> G8

    REFACTOR --> DEPLOY[(Commit skill or PR upstream)]

    class WS skill
    class WS extPlugin
    class REQ,RED2,G7 agent
    class REQ,RED2,G7 extPlugin
    class IL rule
    class IL extPlugin
    class G1,G8 gate
    class DEPLOY artifact
```

## Key gates and Iron Laws

- **IL: NO SKILL WITHOUT A FAILING TEST FIRST.** You must run baseline scenarios **without** the skill and watch them fail before writing anything. Writing the skill first and testing after is the canonical violation.
- **REQUIRED BACKGROUND: `test-driven-development`.** Same RED-GREEN-REFACTOR discipline.
- **Description field is load-bearing.** A description that summarises the skill's workflow causes Claude to follow the description instead of reading the body. `writing-skills` has an entire CSO section on this.

## Layer 2 — global-plugin compatibility audit hook

```mermaid
%%{init: {'theme':'dark','themeVariables':{'fontSize':'11px'},'flowchart':{'nodeSpacing':18,'rankSpacing':22,'padding':4,'diagramPadding':4}}}%%
flowchart TD
    classDef extPlugin     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef companyPlugin fill:#1f5a5bd9,stroke:#4fb0b2,stroke-width:1.25px,color:#dff3f4
    classDef gate     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef artifact fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5

    SPGREEN[superpowers GREEN:<br/>agents comply under pressure]:::extPlugin
    AUDIT[Workflow-compatibility audit<br/>docs/superpowers/testing-skills-against-workflows.md]:::companyPlugin
    C1[C1 Trigger correctness]:::companyPlugin
    C2[C2 No HARD-GATE bypass]:::companyPlugin
    C3[C3 No duplication]:::companyPlugin
    C4[C4 Correct handoff markers]:::companyPlugin
    C5[C5 No Iron Law contradiction]:::companyPlugin
    C6[C6 Review-mode output compat]:::companyPlugin
    C7[C7 Workflow-insertion simulation]:::companyPlugin
    REPORT[(Audit report<br/>docs/superpowers/audits/YYYY-MM-DD/skill-name.md)]
    VERDICT{GREEN / YELLOW / RED}:::gate
    COMMIT[Safe to commit]
    FIX[Fix and re-audit]

    SPGREEN --> AUDIT
    AUDIT --> C1 --> C2 --> C3 --> C4 --> C5 --> C6 --> C7 --> REPORT --> VERDICT
    VERDICT -- GREEN or YELLOW --> COMMIT
    VERDICT -- RED --> FIX --> AUDIT
```

### Attach-point table

| Phase | Artifact / skill | Mode | Trigger condition |
|---|---|---|---|
| After superpowers GREEN phase passes | `docs/superpowers/testing-skills-against-workflows.md` (audit template) | audit | Every new or edited global-plugin skill, without exception |
| Records | `docs/superpowers/audits/YYYY-MM-DD/<skill-name>.md` | artifact | Produced once per audit run |

## Compatibility notes

- **The workflow-compatibility audit is additive.** It runs **after** superpowers' RED-GREEN-REFACTOR passes — not instead of it. A skill with a great pressure-test record can still fail this audit, and vice versa. Both gates must pass before commit.
- **RED verdict blocks commit.** A skill with any C1–C7 FAIL cannot merge. A YELLOW verdict (CONCERN, no FAIL) can merge with an issue logged.
- **The audit template itself is a living document.** If, during piece #4's bulk audit, new systemic rationalizations surface, add them to the template as additional check rows and re-audit affected skills.
- **This workflow is the only place in global-plugin where the audit is explicitly invoked.** Don't fold it into Workflow 2 or 6 — skill authoring is a distinct activity and the audit belongs here.
