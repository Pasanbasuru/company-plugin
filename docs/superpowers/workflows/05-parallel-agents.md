# Workflow 5 — Parallel agents: "fix these N independent tests"

**Trigger shape:** user asks for several independent fixes / investigations at once. Not executing a written plan (that is Workflow 4).

**Audit verdict:** CORRECTIONS NEEDED. One item applied inline below — see §Correction applied.

## Correction applied

The original reference (superpowers.md Diagram 5) contained a rule node labelled `{{"Fan out — ALL Task calls in ONE message"}}`. The superpowers 5.0.7 source `skills/dispatching-parallel-agents/SKILL.md` talks about parallel dispatch and per-agent constraints but **does not** contain the literal phrase "ALL Task calls in ONE message" or equivalent. The claim is a harness-specific implementation detail (Claude Code's `Agent` tool processes parallel tool-use content blocks in one assistant message), not a skill-level rule.

The diagram below softens the wording to describe the spirit faithfully.

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

    P["User: 6 tests are failing, fix them"]
    P --> G1{Gate from Workflow 1 → YES}
    G1 --> DPA[Skill: dispatching-parallel-agents]

    DPA --> TRI{Failures independent?}
    TRI -- "no — related" --> SEQ[Single agent investigates together]
    TRI -- yes --> GROUP[Group by problem domain]

    GROUP --> PAR{{"Dispatch in parallel<br/>(single-message fan-out in harnesses<br/>like Claude Code's Agent tool)"}}
    PAR --> A1[[Agent: fix abort.test.ts]]
    PAR --> A2[[Agent: fix batch.test.ts]]
    PAR --> A3[[Agent: fix race.test.ts]]

    A1 --> R1[Summary returned]
    A2 --> R2[Summary returned]
    A3 --> R3[Summary returned]

    R1 --> INT[Read each summary<br/>check for file conflicts]
    R2 --> INT
    R3 --> INT
    INT --> VB[Skill: verification-before-completion]
    VB --> OK{Full suite green?}
    OK -- no --> FIX[Spot-check, investigate conflicts]
    OK -- yes --> DONE[Report: solved in parallel]

    class DPA,VB skill
    class DPA,VB extPlugin
    class A1,A2,A3 agent
    class A1,A2,A3 extPlugin
    class PAR rule
    class PAR extPlugin
    class G1,TRI,OK gate
```

## Key gates and Iron Laws

- **Triage first.** Related failures get one agent (fixing one may fix all). Only independent domains get parallelized.
- **Per-agent constraints.** Each parallel agent gets a narrow scope, explicit "don't touch other code", and a defined return format.
- **Full-suite verification at the end.** `verification-before-completion` catches cross-parallel conflicts that each agent individually missed.

## Layer 2 — minimal

```mermaid
%%{init: {'theme':'dark','themeVariables':{'fontSize':'11px'},'flowchart':{'nodeSpacing':18,'rankSpacing':22,'padding':4,'diagramPadding':4}}}%%
flowchart LR
    classDef extPlugin     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef companyPlugin fill:#1f5a5bd9,stroke:#4fb0b2,stroke-width:1.25px,color:#dff3f4

    VB[verification-before-completion]:::extPlugin
    CRE[change-risk-evaluation]:::companyPlugin

    VB --> CRE
```

### Attach-point table

| Phase | Company-plugin skill | Mode | Trigger condition |
|---|---|---|---|
| Inside each parallel agent's scope | any domain guard that fits the narrow task | guide | Same criteria as Workflow 4's guardrail cluster, scoped down |
| After full-suite verification | `change-risk-evaluation` | review | Always — flags whether any of the parallel fixes expanded blast radius unexpectedly (covers blast-radius analysis as part of its consolidated scope in 0.4.0) |

## Compatibility notes

- **Parallel agents are narrow by design.** A global-plugin skill that wants to fire inside a parallel agent must fit in a reduced context — prefer the smallest possible guide rather than a full review.
- **Cross-agent regression is the real risk.** A new parallel-friendly skill should include a rule that references `change-risk-evaluation` via `**Hands off to:** global-plugin:change-risk-evaluation` when post-parallel verification is the right consumer (the skill covers blast-radius analysis as well as risk posture and rollback).
- **Do not add a per-agent review step.** Per-task review belongs in Workflow 4. This workflow is about fan-out, not gating.
