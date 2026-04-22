---
name: auth-and-permissions-safety
description: Use when touching authentication, sessions, JWT/tokens, RBAC/ABAC logic, or any route/handler/procedure that accesses user data. Do NOT use for infra-level IAM (use `infra-safe-change` / `aws-deploy-safety`). Covers authN flows, session/token hygiene, RBAC/ABAC checks, CSRF, permission inheritance.
allowed-tools: Read, Grep, Glob, Bash
---

# Auth and permissions safety

## Purpose & scope

Ensure every request is authenticated correctly and authorized on the server for the specific resource, not just the endpoint. Authentication confirms who is making a request; authorization confirms whether that identity is allowed to perform the requested action on the specific piece of data involved. Both must happen server-side on every request — UI guards, hidden buttons, and frontend route checks are advisory only. This skill focuses on application-level auth: session and token mechanics, RBAC/ABAC modelling, CSRF mitigations, step-up flows, and safe error responses.

## Assumes `_baseline`. Adds:

Application-level authN/authZ rules on top of baseline's security floor — resource-scoped checks, session/token mechanics, CSRF, step-up.

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

Sessions store state server-side: the server holds the authoritative record of whether a session is valid. This makes revocation instant — invalidating a row in the session store terminates access immediately, with no grace period. The cost is horizontal scalability: every server in a cluster needs access to the same session store (typically Redis), which adds infrastructure and a potential single point of failure. Sessions are also simpler to implement securely because the only sensitive value in the browser is an opaque ID stored in an HttpOnly cookie, with no JWT claims to forge or misconfigure.

JWTs push state to the client. The access token is self-describing: any server can validate it by verifying the signature and claims, with no database round-trip. That property makes JWTs attractive for stateless microservices and API gateways. The trade-off is that a valid token cannot be revoked before its `exp` claim — revoking requires either keeping a denylist (which reintroduces server state) or accepting that a stolen token is usable until expiry. Keeping access-token TTL short (≤15 minutes) limits the blast radius. Refresh tokens should be opaque, stored hashed in a database, rotated on every use, and transmitted only to a dedicated refresh endpoint via an HttpOnly cookie, never exposed to JavaScript.

For most web applications the right default is: short-lived JWTs for API access, opaque refresh tokens stored HttpOnly, and a Redis-backed token denylist for high-value revocation events (logout, password change, suspicious activity detection). Pure session-cookie architectures are also correct — they are not outdated, just require a shared session store. The wrong choice is a single long-lived JWT with no refresh mechanism: it combines the statelessness downside (no revocation) with long exposure windows.

## RBAC, ABAC, and resource scoping

Role-based access control (RBAC) assigns permissions to roles and roles to users. It is easy to reason about and audit but coarse-grained: every `MANAGER` gets the same permissions regardless of which resources they own. In multi-tenant or ownership-centric applications — an e-commerce platform, a SaaS with workspaces, a healthcare record system — RBAC alone creates horizontal privilege escalation: a manager can read any other manager's orders, not just their own.

Attribute-based access control (ABAC) evaluates policies against attributes of the subject (user), the resource, and the environment (time, IP, device). An ABAC rule such as `user.tenantId === resource.tenantId && user.role === 'MANAGER'` closes the horizontal gap. The practical implementation in a NestJS + Prisma stack is to embed the ownership check in the database query itself: `prisma.order.findFirst({ where: { id, ownerId: userId } })`. If the query returns `null`, the resource either does not exist or the requester does not own it — the guard returns `false` either way, avoiding a separate enumeration call.

Caution: never expose the authorization logic only in a guard decorator while the service layer fetches data unconditionally. The service must also scope queries to the requesting user's tenant or ownership, because guards can be bypassed by internal calls, background jobs, or future refactors that forget to apply the guard. Defence in depth means the query itself is scoped, even when a guard also runs.

For Next.js middleware, RBAC routing checks (redirect unauthenticated users, block non-admins from `/admin`) are appropriate at the middleware layer. Resource-level ABAC checks still belong in the server action or API route handler where the actual data operation occurs — middleware does not have access to the specific resource being requested.

## CSRF strategy

Cross-site request forgery exploits the browser's automatic inclusion of cookies in cross-origin requests. A malicious page served from `evil.com` can cause a user's browser to POST to `api.example.com/transfer`, and the browser will attach the auth cookie, authenticating the forged request. There are two mainstream defences.

The first is `SameSite=Strict` (or `SameSite=Lax` for GET-heavy flows). With `Strict`, the browser will not attach the cookie on any cross-site navigation, including top-level navigations. With `Lax`, the cookie is attached on top-level GET navigations but not on cross-site POST/PUT/DELETE requests — which covers the most common CSRF vectors. `SameSite=Lax` is the minimum for any auth cookie on a modern application. `SameSite=Strict` should be preferred for sensitive cookies (session, refresh token) when the UX cost (cookie not sent after clicking an external link) is acceptable.

The second is the synchronizer token pattern: the server generates a CSRF token, stores it server-side (in the session or signed in a separate cookie), and requires the client to echo it in a request header (`X-CSRF-Token`) or form field. Because cross-origin requests cannot read the cookie's value (same-origin policy), an attacker cannot forge the header. This pattern is required when `SameSite` cannot be used (legacy browser support, cross-subdomain auth) or when defence in depth is desired. In Next.js applications, the `csrf` / `edge-csrf` package or a custom middleware that validates a double-submit cookie is the standard approach.

Never rely solely on checking the `Referer` header — it is sometimes stripped by browsers or proxies, making the check unreliable. Never use CORS alone as a CSRF defence; CORS restricts browser access to response bodies, not request submission.

## Step-up authentication

Step-up authentication requires a user who already has a valid session to prove their identity again before performing a sensitive action. The rationale is threat modelling, not paranoia: a session cookie can be stolen by XSS, a shared device, or a shoulder-surf. Requiring re-authentication for account takeover vectors (change email, change password, add MFA device, delete account, view payment methods) means a stolen session grants read-only comfort, not the ability to lock the legitimate owner out.

The implementation pattern in NestJS is a `StepUpGuard` that reads a `currentPassword` or a TOTP code from the request body, verifies it against the database, and either passes or throws `UnauthorizedException`. The guard should be applied at the route level and must run after the primary `JwtAuthGuard` so that `req.user` is populated before the password check. The verification call must use a constant-time comparison (argon2/bcrypt verify) to prevent timing attacks.

For TOTP-based step-up (used when the account has MFA enrolled), generate a challenge on GET, verify the submitted OTP code on POST, and record a short-lived `stepUpAt` timestamp in the session. Routes that require step-up check that `stepUpAt` is within the last N minutes (typically 5–10), so the user is not asked to re-authenticate on every page action within a short window. Invalidate the `stepUpAt` timestamp on session rotation.

Never accept the original JWT's `iat` (issued-at) as a step-up proof — it only tells you when the token was issued, not when the user last re-entered their credentials within this session.

## Auth error responses (no enumeration)

Account enumeration allows an attacker to build a list of valid email addresses by observing differential responses from login, registration, or password-reset endpoints. A response that says "no account with that email" confirms the negative space and accelerates targeted attacks. A response that says "we sent a reset link if that email is registered" reveals nothing.

All three flows — login, registration, password reset — must return identical HTTP status codes, response bodies, and timing for both the found and not-found cases. For login, return `401 Unauthorized` with a generic message such as `"Invalid credentials"` regardless of whether the email exists or the password is wrong. For password reset, always return `200 OK` with `"If that email is registered, you will receive a reset link"`. For registration, if the email is already taken, return `200 OK` (or `201 Created`) with the same success message as a normal signup, and send the existing account holder a "someone tried to register with your email" notification out-of-band.

Timing attacks are a subtler form of enumeration: if a "user not found" path returns in 2 ms and a "wrong password" path returns in 80 ms (due to bcrypt), an attacker can distinguish them statistically. Mitigate with a constant-time dummy hash operation on the "user not found" path: run `argon2.verify(DUMMY_HASH, providedPassword)` and discard the result before returning the generic error. This equalises the response time regardless of whether a user record was found.

In Next.js API routes or server actions, do not return different HTTP status codes for these cases. Use `next/headers` `cookies()` and `redirect()` carefully — a redirect only on success is itself a timing and state signal.

## Interactions with other skills

- **Owns:** app-level authN/authZ logic, session/token handling, RBAC/ABAC modelling, CSRF, step-up flows, error enumeration prevention.
- **Hands off to:** `infra-safe-change` for IAM roles and infrastructure-level access policies; `secrets-and-config-safety` for JWT secret and session secret storage; `nextjs-app-structure-guard` for Next.js middleware scope and placement.
- **Does not duplicate:** `integration-contract-safety`'s API versioning and inter-service contract concerns; `infra-safe-change`'s AWS IAM policies.

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *File:line, severity (low/med/high), category, what's wrong, recommended fix*.
3. **Endpoint inventory** — for every route/handler/procedure touched: does it have an authN guard? Does it have a resource-scoped authZ check? Mark PASS / CONCERN / MISSING.
4. **Checklist coverage** — for each of the 8 core rules below, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: AuthZ on every endpoint including reads
   - Rule 2: Permission checks are resource-scoped, not role-only
   - Rule 3: Sessions are HttpOnly, Secure, SameSite; rotated on privilege change
   - Rule 4: JWTs are short-lived; claims verified; no client-side secrets
   - Rule 5: CSRF defence in place for all cookie-based auth
   - Rule 6: Auth endpoints are rate-limited separately
   - Rule 7: Sensitive changes require step-up auth
   - Rule 8: Login/reset responses do not leak account existence
