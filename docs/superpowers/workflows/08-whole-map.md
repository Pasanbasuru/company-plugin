# Workflow 8 — The whole map

Reference diagram. Everything superpowers ships, plus the company-plugin overlay showing where our skills attach.

**Audit verdict:** PASS against superpowers 5.0.7. All hooks, skills, prompt templates, and cross-reference edges verified. No corrections.

## Layer 1 — superpowers only

```mermaid
%%{init: {'theme':'dark','themeVariables':{'fontSize':'11px'},'flowchart':{'nodeSpacing':20,'rankSpacing':26,'padding':4,'diagramPadding':4}}}%%
flowchart LR
    classDef extPlugin     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef companyPlugin fill:#1f5a5bd9,stroke:#4fb0b2,stroke-width:1.25px,color:#dff3f4
    classDef hook     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef rule     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef skill    fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef agent    fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef gate     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef artifact fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5

    subgraph HARNESS[Harness layer]
        H1(["hooks/hooks.json"])
        H1 --> H2(["run-hook.cmd"])
        H2 --> H3(["hooks/session-start"])
        H3 --> H4(["Reads using-superpowers"])
        H4 --> H5(["Emits additionalContext"])
    end

    subgraph ROOT[Root gate]
        US[using-superpowers]
        RULE1{{"1% rule · Red flags · Priority:<br/>user > superpowers > default"}}
        US --- RULE1
    end

    H5 -. injects .-> US

    subgraph PROCESS[Process skills]
        BR[brainstorming]
        WP[writing-plans]
        EP[executing-plans]
        SDD[subagent-driven-development]
        DPA[dispatching-parallel-agents]
    end

    subgraph DISCIPLINE[Discipline skills]
        TDD[test-driven-development]
        DBG[systematic-debugging]
        VBC[verification-before-completion]
        IL1{{"NO CODE WITHOUT FAILING TEST"}}
        IL2{{"NO FIX WITHOUT ROOT CAUSE"}}
        IL3{{"NO CLAIM WITHOUT EVIDENCE"}}
        TDD --- IL1
        DBG --- IL2
        VBC --- IL3
    end

    subgraph WORKSPACE[Workspace skills]
        UGW[using-git-worktrees]
        FIN[finishing-a-development-branch]
    end

    subgraph REVIEW[Review skills]
        RCR[requesting-code-review]
        RCV[receiving-code-review]
    end

    subgraph META[Meta]
        WSK[writing-skills]
    end

    subgraph SUBAGENTS[Sub-agents]
        CR[[code-reviewer]]
        IMP[[Implementer subagent]]
        SPR[[Spec-reviewer subagent]]
        CQR[[Code-quality-reviewer subagent]]
    end

    subgraph ART[Artifacts]
        SPEC[(Design doc)]
        PLAN[(Plan)]
        WT[(Git worktree)]
        COM[(Commits per task)]
    end

    US --> BR
    US --> DBG
    US --> RCR
    US --> WSK

    BR --> SPEC
    BR --> UGW
    UGW --> WT
    BR --> WP
    WP --> PLAN
    WP --> SDD
    WP --> EP

    SDD --> IMP
    SDD --> SPR
    SDD --> CQR
    SDD --> RCR
    EP --> RCR
    DPA --> VBC

    IMP --> TDD
    IMP --> COM

    RCR --> CR
    CR --> RCV
    RCV --> TDD

    SDD --> FIN
    EP --> FIN
    FIN --> WT

    DBG --> TDD
    DBG --> VBC
    TDD --> VBC

    WSK --> TDD

    class H1,H2,H3,H4,H5 hook
    class H1,H2,H3,H4,H5 extPlugin
    class US,BR,WP,EP,SDD,DPA,TDD,DBG,VBC,UGW,FIN,RCR,RCV,WSK skill
    class US,BR,WP,EP,SDD,DPA,TDD,DBG,VBC,UGW,FIN,RCR,RCV,WSK extPlugin
    class CR,IMP,SPR,CQR agent
    class CR,IMP,SPR,CQR extPlugin
    class RULE1,IL1,IL2,IL3 rule
    class RULE1,IL1,IL2,IL3 extPlugin
    class SPEC,PLAN,WT,COM artifact
    class SPEC,PLAN,WT,COM extPlugin
```

## Layer 2 — the same map with company-plugin overlay

```mermaid
%%{init: {'theme':'dark','themeVariables':{'fontSize':'10px'},'flowchart':{'nodeSpacing':16,'rankSpacing':22,'padding':4,'diagramPadding':4}}}%%
flowchart LR
    classDef extPlugin     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef companyPlugin fill:#1f5a5bd9,stroke:#4fb0b2,stroke-width:1.25px,color:#dff3f4

    subgraph SP[superpowers phases]
        BR[brainstorming]:::extPlugin
        WP[writing-plans]:::extPlugin
        IMP[Implementer subagent]:::extPlugin
        DBG[systematic-debugging]:::extPlugin
        FIN[finishing-a-development-branch]:::extPlugin
        RCR[requesting-code-review]:::extPlugin
        WSK[writing-skills]:::extPlugin
    end

    subgraph CPARCH[company-plugin: Architecture]
        AG[architecture-guard]:::companyPlugin
        NEXT[nextjs-app-structure-guard]:::companyPlugin
        NEST[nestjs-service-boundary-guard]:::companyPlugin
        FRNT[frontend-implementation-guard]:::companyPlugin
        MOB[mobile-implementation-guard]:::companyPlugin
    end

    subgraph CPDATA[company-plugin: Data / Integration / Security]
        PRIS[prisma-data-access-guard]:::companyPlugin
        STATE[state-integrity-check]:::companyPlugin
        INT[integration-contract-safety]:::companyPlugin
        QUE[queue-and-retry-safety]:::companyPlugin
        RES[resilience-and-error-handling]:::companyPlugin
        AUTH[auth-and-permissions-safety]:::companyPlugin
        SEC[secrets-and-config-safety]:::companyPlugin
    end

    subgraph CPIMPL[company-plugin: Impl guardrails]
        TS[typescript-rigor]:::companyPlugin
        A11Y[accessibility-guard]:::companyPlugin
        PERF[performance-budget-guard]:::companyPlugin
        TSE[test-strategy-enforcement]:::companyPlugin
    end

    subgraph CPFIN[company-plugin: Finish / Ops]
        CRE[change-risk-evaluation]:::companyPlugin
        RRC[regression-risk-check]:::companyPlugin
        RBP[rollback-planning]:::companyPlugin
        ISC[infra-safe-change]:::companyPlugin
        AWS[aws-deploy-safety]:::companyPlugin
        CICD[cicd-pipeline-safety]:::companyPlugin
        SUP[supply-chain-and-dependencies]:::companyPlugin
        COV[coverage-gap-detection]:::companyPlugin
    end

    subgraph CPDBG[company-plugin: Bug path]
        OBS[observability-first-debugging]:::companyPlugin
    end

    subgraph CPMETA[company-plugin: Meta]
        AUDIT["testing-skills-against-workflows<br/>(audit template)"]:::companyPlugin
    end

    BR --- CPARCH
    WP --- CPDATA
    IMP --- CPIMPL
    DBG --- CPDBG
    FIN --- CPFIN
    RCR --- CPFIN
    WSK --- AUDIT
```

## Compatibility notes

- **Every arrow between a company-plugin cluster and a superpowers phase is an attachment, not a replacement.** The superpowers phase always owns the Iron Law; the company-plugin cluster adds domain rules on top.
- **The `_baseline` skill is implicit under every company-plugin cluster.** It is not drawn on the map because it would connect to every node. Assume it.
- **No company-plugin skill should span more than 3 phases.** A skill that claims to attach in design + impl + finish + review is too broad — split it.
