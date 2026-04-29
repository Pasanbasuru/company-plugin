# Workflow 6 — Review loop: requesting + receiving code review

**Trigger shape:** a task is complete, or user asks for a review before merge.

**Audit verdict:** PASS against superpowers 5.0.7. `agents/code-reviewer.md` covers plan alignment, code quality, architecture, docs/standards, and Critical/Important/Suggestions classification. `receiving-code-review` explicitly forbids performative agreement ("You're absolutely right!" marked as a violation).

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

    P[Context: task complete<br/>or review my changes]
    P --> RCR[Skill: requesting-code-review]
    RCR --> SHA[Get git SHAs<br/>BASE_SHA, HEAD_SHA]
    SHA --> DISP[Dispatch superpowers:code-reviewer<br/>via Task tool]

    DISP --> AGENT[[Agent: code-reviewer<br/>agents/code-reviewer.md]]
    AGENT --> AR1[Plan alignment]
    AR1 --> AR2[Code quality]
    AR2 --> AR3[Architecture]
    AR3 --> AR4[Docs / standards]
    AR4 --> AR5[Classify:<br/>Critical · Important · Suggestions]
    AR5 --> REPORT[Structured report returned]

    REPORT --> RCV[Skill: receiving-code-review]
    RCV --> RULE1{{"No performative agreement"}}
    RULE1 --> R1[READ full feedback]
    R1 --> R2[UNDERSTAND — restate in own words]
    R2 --> R3[VERIFY against codebase]
    R3 --> R4{Technically sound?}
    R4 -- "no / unclear" --> PUSH[Push back with technical reasoning<br/>or ask clarifying question]
    R4 -- yes --> IMPL[Implement one at a time<br/>Critical → Important → Minor]
    IMPL --> TEST[Test each change]
    PUSH --> DONE[Resolved via discussion]
    TEST --> DONE

    class RCR,RCV skill
    class RCR,RCV extPlugin
    class AGENT agent
    class AGENT extPlugin
    class RULE1 rule
    class RULE1 extPlugin
    class R4 gate
```

## Key gates and Iron Laws

- The superpowers `code-reviewer` is the **only dedicated subagent** the plugin ships. Everything else in superpowers is a `Task` dispatch with a prompt template.
- **No performative agreement.** `receiving-code-review` forbids phrases like "You're absolutely right!" because review feedback tends to produce sycophantic drift.
- **Push-back is structurally encouraged** when the reviewer is wrong — via technical reasoning, not capitulation.

## Layer 2 — where global-plugin skills attach

```mermaid
%%{init: {'theme':'dark','themeVariables':{'fontSize':'11px'},'flowchart':{'nodeSpacing':18,'rankSpacing':22,'padding':4,'diagramPadding':4}}}%%
flowchart LR
    classDef extPlugin     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef companyPlugin fill:#1f5a5bd9,stroke:#4fb0b2,stroke-width:1.25px,color:#dff3f4

    CR[[code-reviewer<br/>plan alignment owner]]:::extPlugin

    subgraph DOMAIN[Domain-risk reviewers — run alongside, not on top]
        CRE[change-risk-evaluation]:::companyPlugin
        ARC[architecture-guard]:::companyPlugin
        ANYGUARD["any domain guard<br/>(next / nest / prisma / …)"]:::companyPlugin
    end

    CR --- DOMAIN
```

### Attach-point table

| Phase | Company-plugin skill | Mode | Owner concern |
|---|---|---|---|
| Alongside `code-reviewer` | `change-risk-evaluation` | review | Overall risk posture, blast radius on changed surface, and reverse path for the change (consolidated in 0.4.0 from prior `change-risk-evaluation` + `regression-risk-check` + `rollback-planning`) |
| Alongside `code-reviewer` | `architecture-guard` | review | Cross-service boundaries / monorepo ownership |
| Alongside `code-reviewer` | `nextjs-app-structure-guard`, `nestjs-service-boundary-guard`, `frontend-implementation-guard`, `mobile-implementation-guard` | review | Intra-app structure matching the changed files |
| Alongside `code-reviewer` | `prisma-data-access-guard`, `state-integrity-check`, `integration-contract-safety`, `queue-and-retry-safety`, `resilience-and-error-handling`, `auth-and-permissions-safety`, `secrets-and-config-safety` | review | Domain-specific risk for the affected subsystem |
| Alongside `code-reviewer` | `coverage-gap-detection`, `supply-chain-and-dependencies` | review | Quality and supply-chain posture |
| Alongside `code-reviewer` | `infra-safe-change`, `aws-deploy-safety`, `cicd-pipeline-safety` | review | Infra / deploy / pipeline files |

## Compatibility notes

- **The `code-reviewer` owns plan alignment.** Company-plugin review skills own **domain risk**. Their outputs **sit alongside**, not on top. If a global-plugin skill tries to re-grade plan alignment, it duplicates the agent.
- **Report-shape must match the guide.** `docs/superpowers/skill-authoring-guide.md` specifies a four-section markdown report: Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage (PASS / CONCERN / NOT APPLICABLE). Every review-mode global-plugin skill must produce this shape.
- **Grading vocabulary is `PASS / CONCERN / NOT APPLICABLE`.** Not GREEN/YELLOW/RED, not OK/WARN/ERROR. The per-skill audit (`docs/superpowers/audits/2026-04-22/*.md`) uses GREEN/YELLOW/RED at the **skill-audit level** (for compatibility verdicts), but individual review checklists inside a SKILL must use the three sanctioned labels.
- **Review mode is read-only.** A skill in review mode does not call Edit, Write, or Bash for state-changing commands. Only Read, Grep, Glob, Bash for read-only probes.
- **Push-back on the superpowers reviewer is encouraged** per `receiving-code-review`. A global-plugin skill must not teach the user to "just apply the reviewer's suggestion" — it must defer to the receiver skill's rule that verification comes first.
