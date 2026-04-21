---
description: Evaluate implementation risk before or during a change, especially for API, schema, auth, deploy, infra, and cross-service work.
---

Classify the change as Low, Medium, or High risk.

Always assess:
1. user impact
2. backward compatibility
3. rollback complexity
4. test surface
5. data integrity risk
6. security risk
7. operational risk

Output:
- risk level
- why it has that level
- preconditions before merge or deploy
- rollback notes
- validation plan
