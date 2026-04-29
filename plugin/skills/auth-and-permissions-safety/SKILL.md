---
name: auth-and-permissions-safety
description: Use when reviewing or editing authentication, sessions, JWT/tokens, RBAC/ABAC logic, or any route/handler/procedure that accesses user data. Do NOT use for infra-level IAM (use `infra-safe-change` / `aws-deploy-safety`). Covers authN flows, session/token hygiene, RBAC/ABAC checks, CSRF, permission inheritance.
allowed-tools: Read, Grep, Glob, Bash
---

# Auth and permissions safety

## Purpose & scope

Ensure every request is authenticated correctly and authorized on the server for the specific resource, not just the endpoint.

## Core rules

1. **AuthZ is checked on every endpoint — including read endpoints. UI-only guards are advisory.** — *Why:* a client-side redirect or hidden button is trivially bypassed with a direct HTTP call; the server is the only trust boundary that matters.
2. **Permission checks are resource-scoped: "can user X read order Y", not just "can user X read orders".** — *Why:* role-only checks pass every member of a role, including users who own none of the requested data, enabling horizontal privilege escalation.
3. **Sessions: HTTP-only, Secure, SameSite=Lax (or Strict when feasible). Rotate session ID on privilege change; invalidate fully on logout.** — *Why:* missing `HttpOnly` exposes the token to XSS; missing `SameSite` opens CSRF; not rotating on privilege change allows session fixation.
4. **JWTs: short-lived access token (≤15 min) + refresh token; verify `iss`, `aud`, `exp`, `nbf` on every request; no symmetric secrets accessible from the client.** — *Why:* a stolen access token's blast radius is bounded by its TTL; unverified claims let an attacker forge a legitimate-looking payload.
5. **CSRF defence on all cookie-based auth flows (synchronizer token or SameSite=Strict + Origin check).** — *Why:* browsers automatically attach cookies to cross-origin requests; without a CSRF control a malicious page can trigger authenticated mutations.
6. **Rate-limit auth endpoints (login, password reset, MFA, token refresh) separately from normal API traffic.** — *Why:* credential stuffing and brute-force attacks target auth endpoints specifically; a global rate limit set for API throughput is far too lenient for an auth endpoint.
7. **Password reset, email change, and MFA enrolment/removal require step-up auth (re-enter password or second factor).** — *Why:* a stolen or borrowed session should not grant an attacker the ability to lock out the legitimate owner; step-up bounds the damage to the session's original scope.
8. **Don't leak existence: login, registration, and password-reset responses return identical messages regardless of whether the email is registered.** — *Why:* differential responses allow account enumeration, which feeds targeted phishing and credential-stuffing pipelines.

## Red flags

| Thought | Reality |
|---|---|
| "The UI hides the button, only admins see it" | Any HTTP client ignores the UI; the backend must refuse the request independently. |
| "Same JWT secret client-side and server-side, simpler" | Client-side secrets are public — anyone can forge tokens signed with that key. |
| "Long-lived session, users hate re-logging-in" | Compromise window equals session lifetime; prefer sliding-window short sessions with silent refresh. |
| "We rate-limit the whole API, login is covered" | A global API rate limit is orders of magnitude too lenient to stop credential stuffing on a login endpoint. |

## Good vs bad

### Resource-scoped check vs role-only check

Bad — role check only, any `MANAGER` can read any order:
```ts
// NestJS guard checking role but not ownership
@Injectable()
export class RoleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    return req.user?.role === 'MANAGER'; // any manager passes — no resource scoping
  }
}
```

Good — resource-scoped check via Prisma ownership lookup:
```ts
// orders.guard.ts
@Injectable()
export class OrderOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const orderId = req.params.orderId;
    const userId  = req.user.id;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, ownerId: userId }, // resource-scoped
      select: { id: true },
    });

    return order !== null;
  }
}

// Controller usage — guard runs before the handler
@UseGuards(JwtAuthGuard, OrderOwnerGuard)
@Get(':orderId')
getOrder(@Param('orderId') id: string) {
  return this.ordersService.findOne(id);
}
```

### Short-lived JWT + refresh vs long-lived JWT

Bad — single long-lived JWT, 7-day expiry, no refresh path:
```ts
const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET!, {
  expiresIn: '7d', // compromise window = 7 days
});
```

Good — short access token + opaque refresh token stored in HttpOnly cookie:
```ts
// auth.service.ts
async issueTokens(userId: string) {
  const accessToken = this.jwtService.sign(
    { sub: userId },
    { expiresIn: '15m', issuer: 'api.example.com', audience: 'web' },
  );

  // Opaque refresh token stored in DB; rotated on every use
  const refreshToken = crypto.randomBytes(40).toString('hex');
  await this.prisma.refreshToken.create({
    data: {
      token: await argon2.hash(refreshToken),
      userId,
      expiresAt: addDays(new Date(), 30),
    },
  });

  return { accessToken, refreshToken };
}

// In the controller: set refresh token as HttpOnly, Secure, SameSite=Strict cookie
@Post('refresh')
async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const rawToken = req.cookies['refresh_token'];
  const tokens   = await this.authService.rotateRefreshToken(rawToken);
  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure:   true,
    sameSite: 'strict',
    maxAge:   30 * 24 * 60 * 60 * 1000,
    path:     '/auth/refresh',
  });
  return { accessToken: tokens.accessToken };
}
```

### Step-up before sensitive change vs implicit trust from session

Bad — email change accepted on any valid session:
```ts
@Patch('email')
@UseGuards(JwtAuthGuard)
async changeEmail(@Body() dto: ChangeEmailDto, @CurrentUser() user: User) {
  return this.usersService.updateEmail(user.id, dto.email); // no re-auth
}
```

Good — step-up check: password must be re-verified before sensitive mutation:
```ts
// step-up.guard.ts
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req  = ctx.switchToHttp().getRequest<RequestWithUser>();
    const body = req.body as { currentPassword?: string };

    if (!body.currentPassword) {
      throw new UnauthorizedException('Current password required for this action');
    }

    const valid = await this.usersService.verifyPassword(
      req.user.id,
      body.currentPassword,
    );

    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    return true;
  }
}

@Patch('email')
@UseGuards(JwtAuthGuard, StepUpGuard)
async changeEmail(@Body() dto: ChangeEmailDto, @CurrentUser() user: User) {
  return this.usersService.updateEmail(user.id, dto.email);
}
```

## Session vs token trade-offs

- Sessions: instant revocation; needs shared store.
- JWTs: stateless; cannot revoke before expiry.
- Default: short JWT + opaque refresh.
- Wrong: long-lived JWT, no refresh.

## RBAC, ABAC, and resource scoping

Role-based access control (RBAC) assigns permissions to roles and roles to users. RBAC alone creates horizontal privilege escalation in multi-tenant systems.

Attribute-based access control (ABAC) evaluates policies against attributes of the subject (user), the resource, and the environment (time, IP, device). An ABAC rule such as `user.tenantId === resource.tenantId && user.role === 'MANAGER'` closes the horizontal gap. The practical implementation in a NestJS + Prisma stack is to embed the ownership check in the database query itself: `prisma.order.findFirst({ where: { id, ownerId: userId } })`.

Caution: scope queries at the service layer too — guards can be bypassed by internal callers.

Next.js middleware: RBAC routing only; resource ABAC belongs in the handler (middleware can't see the resource).

## CSRF strategy

There are two mainstream defences.

SameSite=Lax minimum; Strict for session/refresh cookies.

Server stores a token; client echoes it in a header. Cross-origin requests can't read the cookie, so attackers can't forge the header.

Don't rely on Referer or CORS as CSRF defence.

## Step-up authentication

Step-up authentication requires a user who already has a valid session to prove their identity again before performing a sensitive action. Stolen sessions shouldn't enable account takeover (email/password change, MFA changes, deletion).

For TOTP-based step-up (used when the account has MFA enrolled), generate a challenge on GET, verify the submitted OTP code on POST, and record a short-lived `stepUpAt` timestamp in the session. Routes that require step-up check that `stepUpAt` is within the last N minutes (typically 5–10). Invalidate the `stepUpAt` timestamp on session rotation.

Never accept the original JWT's `iat` (issued-at) as a step-up proof — it only tells you when the token was issued, not when the user last re-entered their credentials within this session.

## Auth error responses (no enumeration)

Account enumeration allows an attacker to build a list of valid email addresses by observing differential responses from login, registration, or password-reset endpoints.

All three flows — login, registration, password reset — must return identical HTTP status codes, response bodies, and timing for both the found and not-found cases. For login, return `401 Unauthorized` with a generic message such as `"Invalid credentials"` regardless of whether the email exists or the password is wrong. For password reset, always return `200 OK` with `"If that email is registered, you will receive a reset link"`. For registration, if the email is already taken, return `200 OK` (or `201 Created`) with the same success message as a normal signup, and send the existing account holder a "someone tried to register with your email" notification out-of-band.

Equalise timing: run a dummy hash on the user-not-found path.

In Next.js API routes or server actions, do not return different HTTP status codes for these cases. Redirect only on success leaks state — emit a uniform response shape regardless of outcome.

## Interactions with other skills

- **Owns:** app-level authN/authZ logic, session/token handling, RBAC/ABAC modelling, CSRF, step-up flows, error enumeration prevention.
- **Hands off to:** `infra-safe-change` for IAM roles and infrastructure-level access policies; `secrets-and-config-safety` for JWT secret and session secret storage; `nextjs-app-structure-guard` for Next.js middleware scope and placement.
- **Does not duplicate:** `integration-contract-safety`'s API versioning and inter-service contract concerns; `infra-safe-change`'s AWS IAM policies.

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: GREEN / YELLOW / RED.
2. **Findings** — per issue: `file:line, severity (low/med/high), category, fix`. Include endpoint-level observations as bullets here: for each route/handler/procedure touched, note whether it has an authN guard and a resource-scoped authZ check, and flag any missing or role-only checks as findings with their file:line.
3. **Safer alternative** — when the reviewed design has a simpler or lower-risk alternative, name it. Examples: prefer session-based auth with server-side revocation over long-lived JWTs when tokens don't cross service boundaries; prefer short-lived access tokens + refresh rotation over long-lived bearer tokens; prefer resource-scoped Prisma `findFirst({ where: { id, ownerId } })` over a role-only guard plus an unconditional service fetch.
4. **Checklist coverage** — for each of the 8 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: AuthZ on every endpoint including reads
   - Rule 2: Permission checks are resource-scoped, not role-only
   - Rule 3: Sessions are HttpOnly, Secure, SameSite; rotated on privilege change
   - Rule 4: JWTs are short-lived; claims verified; no client-side secrets
   - Rule 5: CSRF defence in place for all cookie-based auth
   - Rule 6: Auth endpoints are rate-limited separately
   - Rule 7: Sensitive changes require step-up auth
   - Rule 8: Login/reset responses do not leak account existence
