---
name: nestjs-service-boundary-guard
description: Use when touching a NestJS module, controller, provider, or DTO. Do NOT use for database query shape (use `prisma-data-access-guard`) or for cross-service contracts (use `integration-contract-safety`). Covers module ownership, provider scope, controller/service split, DTO validation, transaction placement, cross-module coupling.
allowed-tools: Read, Grep, Glob, Bash
---

# NestJS service boundary guard

## Purpose & scope
Keep NestJS codebases maintainable by ensuring each module owns a coherent domain, controllers stay thin HTTP glue, services hold all business logic, and DTOs validate everything that crosses a boundary. Proper layer discipline means the same logic is reachable from HTTP controllers, queue workers, and CLI scripts alike without duplication. Triggers on any change touching modules, controllers, services, providers, or DTOs.

## Core rules
1. **Controllers are thin: validate (DTO), authorize, delegate to a service, shape the response. No business logic.** — *Why:* Controllers are the HTTP glue layer; embedding logic makes it unreachable from other entry points such as queue workers or schedulers.
2. **Services are stateless. State lives in DB or injected caches.** — *Why:* NestJS defaults providers to singleton scope, so instance state becomes a concurrency hazard shared across all concurrent requests.
3. **A module exports only what other modules must consume. Internals stay internal.** — *Why:* Leaking internal providers turns a module into a grab-bag and prevents safe refactoring without auditing all consumers.
4. **Cross-module imports go through a feature module's exported API, not its internal providers.** — *Why:* Reaching inside another module breaks encapsulation and produces circular-module dependencies that NestJS's DI system detects at startup.
5. **Transactions are started in services or explicit use-cases, never in controllers or repositories.** — *Why:* Controllers know HTTP and repositories know one table; only a service knows the business unit-of-work that requires atomicity.
6. **DTOs use `class-validator` decorators and `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true`.** — *Why:* Without whitelist mode, attacker-controlled fields flow through to domain code unexamined and can alter behaviour unexpectedly.
7. **Guards / interceptors / pipes are registered at the most specific scope that works (route > controller > module > global).** — *Why:* Global registration hides which routes are protected; specific scope makes the security guarantee visible exactly where it is needed.

## Red flags
| Thought | Reality |
|---|---|
| "I'll put the transaction in the controller, it's just one" | Controllers become transaction managers and the same unit-of-work can't be reused from a queue worker or CLI script. |
| "Services can reach into other services' repositories" | You've lost module boundaries; every internal change now breaks distant callers who depend on implementation details. |
| "The DTO can be `any` for flexibility" | Hostile input reaches your logic unparsed, and `class-validator` has nothing to check against. |

## Good vs bad

### Thin controller vs fat controller

Bad:
```ts
// orders/orders.controller.ts
@Controller('orders')
export class OrdersController {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  @Post()
  async create(@Body() body: any, @Req() req: Request) {
    if (!body.items?.length) throw new BadRequestException('no items');
    const total = body.items.reduce((s, i) => s + i.price * i.qty, 0);
    const order = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.create({ data: { total, userId: req.user.id } });
      await tx.orderItem.createMany({ data: body.items.map((i) => ({ ...i, orderId: o.id })) });
      return o;
    });
    await this.mail.send(req.user.email, `Order ${order.id} placed`);
    return order;
  }
}
```

Good:
```ts
// orders/orders.controller.ts
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: UserContext) {
    const order = await this.orders.placeOrder(user.id, dto);
    return OrderResponseMapper.toDto(order);
  }
}

// orders/orders.service.ts
@Injectable()
export class OrdersService {
  constructor(private readonly repo: OrdersRepository, private readonly mail: MailService) {}

  async placeOrder(userId: string, dto: CreateOrderDto): Promise<Order> {
    const order = await this.repo.createWithItems(userId, dto);
    await this.mail.send(userId, `Order ${order.id} placed`);
    return order;
  }
}
```

### Module exports a facade vs exports everything

Bad:
```ts
// orders/orders.module.ts
@Module({
  providers: [OrdersService, OrdersRepository, OrderPricingCalculator, OrderEmailer, OrderAuditLogger],
  exports:   [OrdersService, OrdersRepository, OrderPricingCalculator, OrderEmailer, OrderAuditLogger],
})
export class OrdersModule {}
```

Good:
```ts
// orders/orders.module.ts
@Module({
  providers: [OrdersService, OrdersRepository, OrderPricingCalculator, OrderEmailer, OrderAuditLogger],
  exports:   [OrdersService],  // one public entry; internals stay internal
})
export class OrdersModule {}
```

### Transaction in a use-case vs spread across layers

Bad:
```ts
// orders.controller.ts
async create(@Body() dto: CreateOrderDto) {
  return this.prisma.$transaction(async (tx) => {
    const order = await this.ordersService.insertOrder(tx, dto);
    const charge = await this.paymentsService.charge(tx, order);  // service reaches into tx
    return { order, charge };
  });
}
```

Good:
```ts
// orders/place-order.use-case.ts
@Injectable()
export class PlaceOrderUseCase {
  constructor(private readonly prisma: PrismaService, private readonly orders: OrdersService, private readonly payments: PaymentsService) {}

  async execute(userId: string, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order  = await this.orders.insert(tx, userId, dto);
      const charge = await this.payments.charge(tx, order);
      return { order, charge };
    });
  }
}

// orders.controller.ts
@Post()
create(@Body() dto: CreateOrderDto, @CurrentUser() u: UserContext) {
  return this.useCase.execute(u.id, dto);
}
```

## Module boundaries
A NestJS module owns a bounded context. Its `providers` array is the implementation detail; its `exports` array is the published contract. Consumers import the module itself — they never cherry-pick individual providers from another module's internals. A feature module typically exports a single public service (the facade) and keeps repositories, pricing calculators, mappers, and internal utilities unexported and invisible to the rest of the application. Circular module imports are almost always a sign that two modules are really one coherent domain; the correct fix is to extract the shared concept into a third module that both can import, not to paper over the cycle with `forwardRef`. Reserve `forwardRef` for genuinely bidirectional dependencies you cannot restructure — these are rare and must be explicitly justified in a comment. For truly cross-cutting infrastructure concerns such as logging and config, a `CoreModule` or `SharedModule` marked `@Global()` is appropriate — but stop there; applying `@Global()` to feature modules destroys boundary visibility and couples everything implicitly.

## Controller/service split
A controller does exactly four things in order: parse (accept a typed DTO via `ValidationPipe`), authorize (apply guards and resource-level checks), delegate (call a single service method), and shape (map the domain result to a response DTO). It never inspects or enforces business rules, never orchestrates transactions, and never composes multiple service calls to produce a result — that composition belongs in a service or use-case. If a controller method grows beyond roughly ten lines or the service call's intent is obscured by surrounding logic, business logic has leaked into the wrong layer. The testing discipline follows naturally: controllers are covered by `e2e` tests via `supertest` that exercise the full HTTP stack; services are covered by `vitest` unit tests with injected mocks and no HTTP layer involved. Response shaping lives in a dedicated mapper class (`OrderResponseMapper.toDto`) so the controller method remains declarative and the mapping logic is independently testable.

## Transaction placement
Transactions belong in the service layer or in an explicit use-case class whose single responsibility is to represent a business unit-of-work. Repository methods never open their own transactions; instead they accept an optional `tx: PrismaClient | Prisma.TransactionClient` parameter and use whatever was passed, which keeps them composable inside any transaction the caller opens. Controllers never open transactions — doing so couples HTTP concerns directly to persistence semantics and prevents the same operation from being invoked transactionally from a queue consumer or a scheduled job. When a flow requires coordinating two or more services (for example orders, payments, and inventory), an explicit `PlaceOrderUseCase` or similar class should own the transaction boundary, sequence the service calls, and enforce atomicity in one place. Prefer `prisma.$transaction(async (tx) => ...)` interactive transactions over `$transaction([a, b, c])` sequential transactions whenever the flow contains conditional logic between steps, because interactive transactions let you branch on intermediate results.

## DTO validation patterns
DTOs are plain TypeScript classes decorated with `class-validator` constraints (`@IsEmail`, `@IsUUID`, `@IsString`, `@Length`, `@ValidateNested`) and declared as controller parameter types so NestJS can apply the `ValidationPipe` before the handler runs. Enable the `ValidationPipe` globally with `whitelist: true` to strip unrecognised fields, `forbidNonWhitelisted: true` to throw a 400 if any unknown field is present, and `transform: true` to coerce raw JSON into properly typed class instances via `class-transformer`. For nested objects, pair `@Type(() => ChildDto)` with `@ValidateNested({ each: true })` so the child's constraints are enforced recursively. Separate input DTOs from response DTOs — reusing the same class for both directions causes the shapes and validation rules to diverge in incompatible ways over time. For complex validation such as conditional fields or cross-field invariants, write a custom `@ValidatorConstraint` class rather than embedding conditional checks inside service methods; this keeps validation at the boundary where it belongs. If the codebase uses Zod at the controller edge and infers TypeScript types from schemas, this skill accepts that approach but requires consistent use throughout — mixing `class-validator` and Zod ad-hoc within the same codebase is not acceptable.

## Guard/interceptor/pipe scope
NestJS supports four scopes for guards, interceptors, and pipes: route-level (`@UseGuards(...)` on a single method), controller-level (`@UseGuards(...)` on the class), module-level (via `providers: [{ provide: APP_GUARD, useClass: ... }]`), and global (via `app.useGlobalGuards(...)`). The governing rule is to use the most specific scope that still achieves the goal. Route-level is correct when only certain endpoints require a check; controller-level when every route in the controller needs it uniformly; module-level for module-wide uniform requirements; and global only for genuinely universal concerns such as exception formatting or inbound request logging. Applying authorization guards globally is dangerous because any new controller added without deliberate thought silently inherits protection — prefer a `@Public()` decorator pattern where a global guard is opt-out and every `@Public()` usage is reviewed in code review. The `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and `transform` options is one of the few cases where global scope is correct because every endpoint should reject malformed input. Response-shaping or logging interceptors are typically global or module-scoped depending on whether the behaviour is universal or limited to a feature area.

## Interactions with other skills
- **Owns:** module/provider structure, controller discipline, DTO validation placement, transaction scope, guard/interceptor/pipe registration scope.
- **Hands off to:** `prisma-data-access-guard` for query shape inside services and repositories; `integration-contract-safety` for cross-service HTTP/event payloads; `auth-and-permissions-safety` for guard logic and session verification.
- **Does not duplicate:** `architecture-guard`'s cross-package and monorepo-level concerns — this skill is about intra-service module structure.

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *File:line, severity (blocking | concern | info), category (controller discipline | module export surface | cross-module coupling | transaction placement | DTO validation | guard scope), what's wrong, fix*. List every controller method with logic beyond validate/authorize/delegate/shape.
3. **Safer alternative** — if an anti-pattern is widespread (e.g., transactions in controllers across many modules, bare `any` DTOs), prescribe the replacement and migration path.
4. **Checklist coverage** — for each rule below, mark PASS / CONCERN / NOT APPLICABLE:
   - Rule 1: Controllers thin (validate / authorize / delegate / shape).
   - Rule 2: Services stateless.
   - Rule 3: Modules export only their public API.
   - Rule 4: Cross-module imports go through a module's exported API.
   - Rule 5: Transactions in services or use-cases, not controllers/repositories.
   - Rule 6: DTOs use `class-validator` and `ValidationPipe` with whitelist + forbidNonWhitelisted.
   - Rule 7: Guards/interceptors/pipes at the most specific scope that works.
