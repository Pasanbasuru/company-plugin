---
name: architecture-guard
description: Use when reviewing a change that crosses service/app boundaries, adds a new top-level package, or shifts dependency direction in the monorepo. Do NOT use for intra-app structure concerns — use nextjs-app-structure-guard or nestjs-service-boundary-guard instead. Covers monorepo ownership, dependency direction, shared-package scope, cross-service contracts.
allowed-tools: Read, Grep, Glob, Bash
---

# Architecture guard

## Purpose & scope

Keep the monorepo's shape healthy — packages have clear owners, dependencies flow one direction, shared code is stable.

## Core rules

1. **Apps depend on packages; packages never depend on apps.** — *Why:* apps are leaves in the dependency graph; reversing the arrow couples independent deliverables.
2. **Packages form a DAG — reject any new edge that creates a cycle.** — *Why:* cycles break tooling (TypeScript project references, build caches, test runners) and make module evaluation order undefined.
3. **Each package has one public entry (`index.ts`); consumers import from the package root only.** — *Why:* deep imports into internals couple you to implementation details that aren't a stable contract.
4. **Shared types live in a dedicated `shared-types` (or similarly scoped) package; services never import each other's internal types.** — *Why:* service-to-service type imports hide what is actually a cross-service contract.
5. **Every new package has an `OWNERS` entry (or CODEOWNERS) and a one-paragraph `README.md` describing its responsibility.** — *Why:* unowned packages become sandboxes where fixes never happen.
6. **Test code never imports from a sibling app's source tree.** — *Why:* test coupling across apps means one app's refactor breaks another's tests for no functional reason.

## Red flags

| Thought | Reality |
|---|---|
| "Just one import from the other app, it's harmless" | That's either a missing shared package or a leak — surface it explicitly instead of hiding it. |
| "The circular dep is tiny, I'll clean it up later" | Tooling breaks silently; later debugging is miserable and the cycle only grows. |
| "I'll flatten the packages for convenience" | Monorepos collapse into spaghetti when boundaries disappear — convenience today is a week of cleanup next quarter. |

## Good vs bad

### App importing from another app vs shared package

Bad:
```ts
// apps/web/src/components/UserCard.tsx
import { formatUserName } from '../../admin/src/lib/foo';
```

Good:
```ts
// apps/web/src/components/UserCard.tsx
import { formatUserName } from '@acme/shared-foo';

// apps/admin/src/components/UserCard.tsx
import { formatUserName } from '@acme/shared-foo';
```

### Deep-path import vs package-root import

Bad:
```ts
import { computeHash } from '@acme/pkg/src/internals/helper';
```

Good:
```ts
import { publicApi } from '@acme/pkg';
```

## Dependency direction rules

The dependency graph has exactly four layers, top to bottom:

1. **Apps** (`apps/*`) — Next.js apps, NestJS services, CLI tools. These are the deployable leaves.
2. **Feature packages** (`packages/features/*` or `packages/<domain>`) — domain logic consumed by one or more apps.
3. **Shared packages** (`packages/shared-*`, `packages/ui`, `packages/utils`) — general-purpose code with no domain opinion.
4. **Foundation packages** (`packages/logging`, `packages/types`, `packages/config`) — zero-dependency primitives every layer can import.

Arrows only point downward. An app can import from feature, shared, or foundation. A feature package can import from shared or foundation. A shared package can import from foundation only. Foundation packages import from nothing inside the monorepo.

**Detecting a violation.** Check `package.json` dependencies for any entry that names a package above the current layer. Also inspect `tsconfig.json` references — TypeScript project references (`"references": [...]`) must follow the same arrow direction; a composite project that references a higher layer is a build-time error waiting to happen.

## Shared-types package pattern

Introduce a single `@acme/contracts` (or `@acme/shared-types`) package at the foundation layer. Place all cross-service DTOs, event payloads, and API response/request types there. Must depend on nothing inside the monorepo (a pure leaf).

Services that currently import from each other (`import { CreateOrderDto } from '@acme/order-service/src/...'`) must be migrated: the DTO moves to `@acme/contracts`, both services import from there, and the direct service-to-service import is deleted. The HTTP/event contract semantics (versioning, evolution) are the responsibility of `integration-contract-safety`, not this skill.

**Does not duplicate:** integration-contract-safety

## Adding a new package (checklist)

1. Create the folder with `package.json` (name under `@acme/` scope prefix), `tsconfig.json`, and a one-paragraph `README.md` explaining the package's single responsibility.
2. Add the package to the workspace config (`pnpm-workspace.yaml`, `packages` field in the root `package.json`, or Turborepo `workspaces`).
3. Assign an owner in `CODEOWNERS` — one team or one individual, not a catch-all.
4. Pick a name that reflects the layer: `@acme/feature-<domain>` for feature packages, `@acme/shared-<name>` for shared utilities, no prefix decoration for foundation packages.
5. Export everything through `index.ts` only; add an `exports` field in `package.json` pointing to the compiled entry.
6. If consumers use TypeScript project references, add a `"references"` entry in each consumer's `tsconfig.json` and mark the new package's `tsconfig.json` with `"composite": true`.

## Detecting cycles

Three tools cover cycle detection at different layers:

- **madge**: `npx madge --circular --extensions ts packages/` — scans source-level imports and prints every cycle it finds.
- **dependency-cruiser**: `npx depcruise --validate .dependency-cruiser.js packages/` — enforces declared rules (e.g., "no package may import from an app") and exits non-zero on violation.
- **TypeScript `--build` mode**: `npx tsc --build --dry` — when composite projects form a cycle, the compiler refuses to build and reports the loop explicitly; this is the fastest feedback loop in CI.

Run all three during a new-package PR and in the pre-merge CI pipeline.

## Interactions with other skills

- **Owns:** cross-package / cross-app structure, dependency direction, public-package API surface.
- **Hands off to:** nextjs-app-structure-guard for intra-Next.js file structure
- **Hands off to:** nestjs-service-boundary-guard for intra-NestJS module boundaries
- **Hands off to:** integration-contract-safety for the actual HTTP/event contract semantics across services
- **Does not duplicate:** `integration-contract-safety`'s contract-versioning concerns.

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: GREEN / YELLOW / RED.
2. **Findings** — for every new cross-package edge introduced by the diff, list: *File:line, severity (blocking | concern | info), category (dependency direction | cycle | deep import | missing owner | cross-service type leak | test coupling), what's wrong, fix*. Classify each edge against the four-layer dependency direction rules explicitly.
3. **Safer alternative** — if an anti-pattern is widespread (e.g., multiple apps importing each other), prescribe the replacement (e.g., extract `@acme/shared-foo`, migrate all consumers, delete the cross-app imports).
4. **Checklist coverage** — for each rule below, mark PASS / CONCERN / NOT APPLICABLE:
   - Rule 1: Apps depend on packages; packages never depend on apps.
   - Rule 2: Packages form a DAG — no cycles introduced.
   - Rule 3: Each package exports through `index.ts`; no deep-path imports.
   - Rule 4: Shared types live in a dedicated package; no service-to-service type imports.
   - Rule 5: Every new package has an OWNERS entry and a README.
   - Rule 6: Test code does not import from a sibling app's source tree.
