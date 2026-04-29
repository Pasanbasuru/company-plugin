# Workflow 1 — Universal entry: what happens the moment any prompt arrives

**Trigger shape:** every prompt, no exceptions. Session start, `/clear`, and auto-compact also re-fire this chain.

**Audit verdict:** PASS against superpowers 5.0.7. No corrections.

## Layer 1 — superpowers core flow

```mermaid
%%{init: {'theme':'dark','themeVariables':{'fontSize':'11px'},'flowchart':{'nodeSpacing':20,'rankSpacing':26,'padding':4,'diagramPadding':4}}}%%
flowchart TD
    classDef extPlugin     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef companyPlugin fill:#1f5a5bd9,stroke:#4fb0b2,stroke-width:1.25px,color:#dff3f4
    classDef hook     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef rule     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef skill    fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef agent    fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef gate     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef artifact fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5

    A[User opens Claude Code<br/>or /clear or compact]
    A --> B{"hooks.json matcher:<br/>startup | clear | compact?"}
    B -- yes --> C(["run-hook.cmd session-start<br/>polyglot bash/cmd"])
    C --> D(["hooks/session-start<br/>bash"])
    D --> E(["Reads using-superpowers/SKILL.md"])
    E --> F(["Emits hookSpecificOutput.additionalContext"])
    F --> G[Claude Code injects into system context]

    G --> P[User prompt arrives]
    P --> H{"Might any skill apply?<br/>even 1% chance"}
    H -- "definitely not" --> R[Respond directly]
    H -- yes --> I{{"1% rule:<br/>invoke Skill tool"}}
    I --> J[Skill: using-superpowers]
    J --> ANN{{"Announce:<br/>Using skill to purpose"}}
    ANN --> K{"Skill has checklist?"}
    K -- yes --> L[Create TodoWrite per item]
    K -- no --> M{{Follow skill exactly}}
    L --> M
    M --> R

    class C,D,E,F hook
    class C,D,E,F extPlugin
    class I,ANN,M rule
    class I,ANN,M extPlugin
    class J skill
    class J extPlugin
    class B,H,K gate
```

## Key gates and Iron Laws

- The `SessionStart` hook is the **only** piece that runs outside the model. It re-injects `using-superpowers` as system context after every `/clear` or compact.
- **1% rule:** if any skill *might* apply, invoke it. Rationalizing past this is the defining risk the `using-superpowers` skill guards against.
- **Priority order:** user instructions (CLAUDE.md, direct requests) > superpowers skills > default system prompt.

## No layer 2

No global-plugin skill attaches at this workflow. Everything global-plugin ships lives downstream of the gate in Workflows 2, 3, 4, 5, 6, 7.

## Compatibility notes for new skills

- A new skill must not register a `SessionStart` hook that competes with `using-superpowers` for `additionalContext`. As of 0.4.0, global-plugin ships SessionStart and UserPromptSubmit hooks that DO emit a brief `additionalContext` payload (a skill-loading-discipline reminder); a new skill registering its own injection must coordinate with both this gate and the existing global-plugin injector.
- A new skill must not alter the 1%-rule behaviour. It must sit downstream of invocation, not inside it.
- A new skill's `description` must not be so broad that `using-superpowers` invokes it on every prompt — that would defeat the 1% discretion built into the gate.
