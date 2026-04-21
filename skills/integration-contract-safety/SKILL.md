---
description: Protect API, webhook, and external integration contracts from accidental breakage.
---

Use this skill when changing:
- request or response shapes
- webhook payloads
- field names, defaults, semantics, or error codes
- auth headers or retry behavior

Rules:
1. Backward compatibility is the default.
2. Identify downstream consumers first.
3. Prefer additive changes over breaking changes.
4. If a breaking change is unavoidable, state the migration path clearly.
5. Consider idempotency and retry safety for async integrations.

Output:
- contract impact summary
- affected consumers
- compatibility risk
- safer alternative if available
- migration note if required
