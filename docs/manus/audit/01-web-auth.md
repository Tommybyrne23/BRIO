# Web App Router and Authentication Audit

**Scope.** This is a static implementation audit of `/home/ubuntu/work/BRIO/code/brioweb` performed on 2026-09-12. It covers the App Router routes and layouts, route handlers, Better Auth setup, DAL, proxy, account flows, navigation, and deployment configuration. It does **not** assert live behavior against a running database or identity provider. No application code was changed. `npm run lint` and `npx tsc --noEmit` both completed successfully during the review.

## Conclusion

The application has a clear two-layer protection model for browser routes: `proxy.ts` performs a cookie-presence redirect for the three protected URL prefixes, while the authenticated layout and admin layout enforce session and role checks through the server-only DAL. API routes are not proxy matched, but both application API handlers explicitly obtain a session and return `401` when absent. Better Auth is mounted at a single catch-all App Router handler and is configured for email/password accounts with username and admin plugins.

The central operational weakness is the password-reset delivery implementation: it generates the reset URL but writes it to server logs rather than delivering it through a provider. That URL is a reset capability and must be treated as secret-bearing operational data. Email verification is intentionally disabled in the actual configuration. The reviewed pages do not guest-gate the sign-in, sign-up, forgot-password, or reset-password routes, so an already authenticated browser may still render those forms.

## Verified implementation inventory

| Surface | Actual implementation | Evidence |
|---|---|---|
| Root shell | The root layout supplies document structure, fonts, metadata, and no authorization logic. | `/home/ubuntu/work/BRIO/code/brioweb/app/layout.tsx:15-28` |
| Home route (`/`) | Server component calls `getSession()`. It renders Dashboard for a session and Sign up/Sign in links otherwise. It is not a redirect route. | `/home/ubuntu/work/BRIO/code/brioweb/app/page.tsx:2-5,19-46` |
| Better Auth handler | Catch-all route delegates `GET`, `POST`, `PATCH`, `PUT`, and `DELETE` to `toNextJsHandler(auth)`. This is the only application-defined handler under `/api/auth/**`. | `/home/ubuntu/work/BRIO/code/brioweb/app/api/auth/[...all]/route.ts:1-4` |
| Authenticated route group | The URL-less `(authenticated)` layout requires a user before rendering all group children and passes name, email, and role into the navigation component. | `/home/ubuntu/work/BRIO/code/brioweb/app/(authenticated)/layout.tsx:1-23` |
| Dashboard and chat | `/dashboard` has an additional local `requireUser()` before its query. `/dashboard/chat` relies on the parent authenticated layout rather than making its own DAL call. | `/home/ubuntu/work/BRIO/code/brioweb/app/(authenticated)/dashboard/page.tsx:1-6`; `/home/ubuntu/work/BRIO/code/brioweb/app/(authenticated)/dashboard/chat/page.tsx:1-14` |
| Profile | The group layout already protects it; the page redundantly calls `requireUser()` and renders account fields. | `/home/ubuntu/work/BRIO/code/brioweb/app/(authenticated)/profile/page.tsx:1-28` |
| Admin | The admin layout calls `requireAdmin()` before rendering. The client page calls Better Auth admin client methods to list up to 100 users and toggle each target’s role. | `/home/ubuntu/work/BRIO/code/brioweb/app/(authenticated)/admin/layout.tsx:1-6`; `/home/ubuntu/work/BRIO/code/brioweb/app/(authenticated)/admin/page.tsx:19-45` |
| Health-sample API | `GET` and `POST` both obtain a session and return `401` when absent. Reads filter by `session.user.id`; writes overwrite caller-supplied identity with `session.user.id`. | `/home/ubuntu/work/BRIO/code/brioweb/app/api/health-samples/route.ts:5-18,60-103` |
| Chat API | `POST` obtains a session and returns `401` when absent. It passes `session.user.id` into the orchestrator construction, which builds every domain agent/tool set from that ID. | `/home/ubuntu/work/BRIO/code/brioweb/app/api/chat/route.ts:40-44,82-84`; `/home/ubuntu/work/BRIO/code/brioweb/agents/orchestrator.ts:30-36` |

## Authentication and authorization behavior

### Authoritative DAL

`getSession()` is server-only, memoized with React `cache`, and calls `auth.api.getSession` with request headers. `requireUser()` redirects a missing session to `/sign-in`; `requireAdmin()` first requires a user, then redirects non-admin users to `/dashboard`. Therefore, role authorization is a server-side check at layout rendering time, not a navigation-only condition.

| Check | Result | Evidence |
|---|---|---|
| Session retrieval | Better Auth session lookup receives the current request headers. | `/home/ubuntu/work/BRIO/code/brioweb/db/auth-dal.ts:1-9` |
| Any authenticated user | Missing session redirects to `/sign-in`. | `/home/ubuntu/work/BRIO/code/brioweb/db/auth-dal.ts:11-15` |
| Administrator | `user.role !== "admin"` redirects to `/dashboard`. | `/home/ubuntu/work/BRIO/code/brioweb/db/auth-dal.ts:17-21` |
| User identity in health queries | Query helpers constrain reads by `healthSamples.userId`; handler supplies the session user ID. | `/home/ubuntu/work/BRIO/code/brioweb/db/queries/health-samples.ts:19-43`; `/home/ubuntu/work/BRIO/code/brioweb/app/api/health-samples/route.ts:17,90-100` |

### Proxy versus authoritative enforcement

`proxy.ts` is an optimistic entry filter only. It redirects requests without a Better Auth session cookie to `/sign-in` for `/dashboard/**`, `/admin/**`, and `/profile/**`. It does not query the database, validate a role, preserve a destination/return URL, or cover `/api/**`. The layout/DAL checks and individual API session checks are the actual backstops.

| Route class | Anonymous behavior actually implemented | Authenticated behavior actually implemented | Evidence |
|---|---|---|---|
| `/` | Renders Sign up and Sign in links. | Renders signed-in name and Dashboard link. | `/home/ubuntu/work/BRIO/code/brioweb/app/page.tsx:19-46` |
| `/sign-up`, `/sign-in`, `/forgot-password`, `/reset-password` | Forms/pages are rendered. | The same forms/pages are also rendered; no code redirects an authenticated visitor away. | `/home/ubuntu/work/BRIO/code/brioweb/app/sign-up/page.tsx:15-125`; `/home/ubuntu/work/BRIO/code/brioweb/app/sign-in/page.tsx:15-99`; `/home/ubuntu/work/BRIO/code/brioweb/app/forgot-password/page.tsx:14-90`; `/home/ubuntu/work/BRIO/code/brioweb/app/reset-password/page.tsx:13-100` |
| `/dashboard/**`, `/profile/**` | Proxy redirects on absent cookie; parent layout redirects absent/invalid sessions during rendering. | Parent layout renders shared navigation and child. | `/home/ubuntu/work/BRIO/code/brioweb/proxy.ts:5-14`; `/home/ubuntu/work/BRIO/code/brioweb/app/(authenticated)/layout.tsx:9-20` |
| `/admin/**` | Same cookie redirect and authenticated-layout session requirement. | Admin layout additionally checks the database-backed session role and redirects non-admins. | `/home/ubuntu/work/BRIO/code/brioweb/proxy.ts:5-14`; `/home/ubuntu/work/BRIO/code/brioweb/app/(authenticated)/admin/layout.tsx:1-6`; `/home/ubuntu/work/BRIO/code/brioweb/db/auth-dal.ts:17-21` |
| `/api/health-samples` and `/api/chat` | Not proxy matched, but handler returns JSON `401`. | Handler scopes application data work to the session user. | `/home/ubuntu/work/BRIO/code/brioweb/proxy.ts:12-14`; `/home/ubuntu/work/BRIO/code/brioweb/app/api/health-samples/route.ts:5-18,60-103`; `/home/ubuntu/work/BRIO/code/brioweb/app/api/chat/route.ts:40-44,82-84` |
| `/api/auth/**` | Intentionally delegated to Better Auth; behavior is supplied by Better Auth rather than custom application code. | Same. | `/home/ubuntu/work/BRIO/code/brioweb/app/api/auth/[...all]/route.ts:1-4` |

## Better Auth configuration and schema support

The actual server configuration enables email/password accounts and explicitly disables required email verification. It installs username, admin, Expo, and Next.js cookie plugins. The user schema includes unique email and username fields plus the `role`, ban, and session/account/verification fields needed by the configured plugins. The default role is `user`, and `admin` is the recognized admin role.

| Concern | Actual implementation | Evidence |
|---|---|---|
| Database adapter | Better Auth uses the Drizzle Postgres adapter with the application schema. | `/home/ubuntu/work/BRIO/code/brioweb/db/auth.ts:1-11` |
| Password/email authentication | Enabled; `requireEmailVerification` is explicitly `false`. | `/home/ubuntu/work/BRIO/code/brioweb/db/auth.ts:12-18` |
| Username authentication | Server adds `username()`; browser client adds `usernameClient()`. | `/home/ubuntu/work/BRIO/code/brioweb/db/auth.ts:22-26`; `/home/ubuntu/work/BRIO/code/brioweb/lib/auth-client.ts:1-6` |
| Administrator roles | Server adds `admin({ defaultRole: "user", adminRoles: "admin" })`; browser client adds `adminClient()`. | `/home/ubuntu/work/BRIO/code/brioweb/db/auth.ts:22-26`; `/home/ubuntu/work/BRIO/code/brioweb/lib/auth-client.ts:1-6` |
| Cookie integration | `nextCookies()` is present and is last in the plugin array. The inline comment explains the intended ordering, but the ordering itself is the verifiable implementation fact. | `/home/ubuntu/work/BRIO/code/brioweb/db/auth.ts:22-27` |
| Mobile origin | The only explicit custom trusted-origin pattern is `briomobile://*`; Expo plugin is enabled. | `/home/ubuntu/work/BRIO/code/brioweb/db/auth.ts:5-6,19-26` |
| Auth schema | User has unique email and username and nullable role; session/account rows reference the user with cascade delete; verification data is stored separately. | `/home/ubuntu/work/BRIO/code/brioweb/db/schema.ts:14-91` |

## Account-flow behavior

### Sign-up and sign-in

The sign-up page submits name, email, username, and password to `authClient.signUp.email`, then navigates to `/dashboard` on a no-error response. The browser form requires every field and has only an eight-character minimum on the password. The sign-in page is **username/password only** in its UI and calls `authClient.signIn.username`; it then navigates to `/dashboard`. These client constraints do not substitute for Better Auth server validation.

| Flow | Submitted action and success navigation | Evidence |
|---|---|---|
| Sign up | `authClient.signUp.email({ name, email, password, username })`; `router.push("/dashboard")` and `router.refresh()`. | `/home/ubuntu/work/BRIO/code/brioweb/app/sign-up/page.tsx:24-41` |
| Sign-up form | Name, email, username, and password are required; password `minLength={8}`. | `/home/ubuntu/work/BRIO/code/brioweb/app/sign-up/page.tsx:52-113` |
| Sign in | `authClient.signIn.username({ username, password })`; `router.push("/dashboard")` and `router.refresh()`. | `/home/ubuntu/work/BRIO/code/brioweb/app/sign-in/page.tsx:22-39` |
| Sign-in navigation | Links to forgot-password and sign-up are present. | `/home/ubuntu/work/BRIO/code/brioweb/app/sign-in/page.tsx:85-95` |

### Password reset

The forgot-password page requests a reset with `redirectTo: "/reset-password"`. The Better Auth server callback does not send an email; it logs an email address and reset URL to the server console. The page accurately discloses this in its text, but it means a production user cannot receive a reset link through an email provider. The reset page reads `token` from the query string, refuses to submit without it, calls `authClient.resetPassword({ newPassword, token })`, and redirects to sign-in after 1.5 seconds on success.

| Flow component | Actual behavior | Evidence |
|---|---|---|
| Reset request | Calls `requestPasswordReset` with an internal relative redirect path. | `/home/ubuntu/work/BRIO/code/brioweb/app/forgot-password/page.tsx:20-42` |
| Reset delivery | Reset callback writes the user email and reset URL to server logs; no provider call exists in this callback. **The logged URL must be treated as secret-bearing and is not reproduced here.** | `/home/ubuntu/work/BRIO/code/brioweb/db/auth.ts:15-17` |
| User disclosure | The page states that no provider is wired and tells the user to inspect server logs. | `/home/ubuntu/work/BRIO/code/brioweb/app/forgot-password/page.tsx:54-58` |
| Reset execution | Reads `token`; calls `resetPassword`; on success schedules sign-in navigation. | `/home/ubuntu/work/BRIO/code/brioweb/app/reset-password/page.tsx:13-43` |
| Reset form | Requires a query token and enforces client-side `minLength={8}`. | `/home/ubuntu/work/BRIO/code/brioweb/app/reset-password/page.tsx:46-84` |

## Navigation and sign-out

The shared authenticated navigation contains Dashboard and Chat with Coach links for every logged-in user. It conditionally renders the Admin link only when the role prop equals `admin`; this is a UI convenience and is separately backed by `requireAdmin()` on the route. The profile menu exposes the supplied email address and a Profile link. Sign-out calls `authClient.signOut()` and then unconditionally navigates to `/sign-in`; it neither checks nor displays a sign-out error.

| Item | Actual behavior | Evidence |
|---|---|---|
| Shared navigation | Rendered by authenticated layout, not public pages. | `/home/ubuntu/work/BRIO/code/brioweb/app/(authenticated)/layout.tsx:11-20` |
| User links | Dashboard and Chat with Coach are always shown for the authenticated layout. | `/home/ubuntu/work/BRIO/code/brioweb/components/nav-bar.tsx:43-61` |
| Admin link | Rendered only for `user.role === "admin"`. | `/home/ubuntu/work/BRIO/code/brioweb/components/nav-bar.tsx:62-69` |
| Profile and sign out | Found in the user dropdown. | `/home/ubuntu/work/BRIO/code/brioweb/components/nav-bar.tsx:83-101` |
| Sign out | Calls Better Auth client sign-out, then pushes to `/sign-in` and refreshes. | `/home/ubuntu/work/BRIO/code/brioweb/components/sign-out-button.tsx:13-17` |

## Gaps and risks

1. **Reset URLs are logged instead of delivered.** The actual callback at `/home/ubuntu/work/BRIO/code/brioweb/db/auth.ts:15-17` logs both email identifier and reset URL. Reset URLs are credentials for password change. Production logs, log retention, access controls, and observability exports can therefore become a credential and personal-data exposure path. The page’s text at `/home/ubuntu/work/BRIO/code/brioweb/app/forgot-password/page.tsx:54-58` confirms this is current implementation, not a stale comment.

2. **Email verification is disabled.** `/home/ubuntu/work/BRIO/code/brioweb/db/auth.ts:12-15` explicitly sets `requireEmailVerification: false`. This is an implementation choice, not merely an omission in documentation. It permits sign-in after account creation without verified email ownership, subject to Better Auth’s other configured behavior.

3. **Authenticated users are not redirected away from public account forms.** None of the four public account pages reads a session or calls `redirect`; none is proxy matched. This can create confusing duplicate-account or redundant-reset experiences. It is not an authorization bypass of protected routes.

4. **Proxy authentication is cookie presence only.** `/home/ubuntu/work/BRIO/code/brioweb/proxy.ts:5-14` does not validate a session or role. The authoritative layout/DAL checks reduce the risk for page routes, but any future protected route outside the authenticated group or any new API route without a handler-level check could be exposed.

5. **No destination preservation is implemented.** Proxy and DAL redirects use a bare `/sign-in` (`proxy.ts:7`; `db/auth-dal.ts:13`), and sign-in always navigates to `/dashboard` (`app/sign-in/page.tsx:32-33`). A user who originally requested Profile, Chat, or Admin is not returned to that target.

6. **Admin UI relies on Better Auth endpoint authorization.** The UI correctly lives below `requireAdmin()`, but its user listing and role changes are browser calls to Better Auth admin APIs (`/home/ubuntu/work/BRIO/code/brioweb/app/(authenticated)/admin/page.tsx:19-45`). The local page has no additional target safeguards, such as preventing self-demotion. The configured admin plugin is the only evident API-level authorization policy in this repository.

7. **Application API input checks are structural, not bounded.** The health handler validates basic field types and dates but has no visible request-size, batch-size, rate, or metadata-schema limits (`/home/ubuntu/work/BRIO/code/brioweb/app/api/health-samples/route.ts:21-103`). This is separate from session/ownership enforcement.

8. **Comments and documentation must not be treated as execution.** For example, the `nextCookies()` ordering comment in `/home/ubuntu/work/BRIO/code/brioweb/db/auth.ts:26` expresses intent, while the array order is the verifiable behavior. The README calls the local Compose file “repo root” at `/home/ubuntu/work/BRIO/code/brioweb/README.md:127`, but the actual file is `/home/ubuntu/work/BRIO/code/brioweb/docker-compose.yml`; within the broader `/home/ubuntu/work/BRIO` repository this is not its root.

## Compatibility and deployment requirements

| Requirement | Reason and evidence |
|---|---|
| Preserve a stable `BETTER_AUTH_SECRET` and correct public `BETTER_AUTH_URL` across deployments. | These are the documented Better Auth runtime variables in `/home/ubuntu/work/BRIO/code/brioweb/.env.example:4-6`; the Dokploy app service passes both in `/home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml:16-20`. |
| Provide reachable PostgreSQL through `DATABASE_URL` and apply the Drizzle migrations before serving traffic. | Server database client uses `DATABASE_URL` and throws outside production build when it is absent (`/home/ubuntu/work/BRIO/code/brioweb/db/client.ts:6-14`). The Dokploy `migrate` service runs before app/worker (`docker-compose.dokploy.yml:2-10,25-28`). |
| Keep Better Auth config, installed plugin version, and auth schema/migrations aligned. | The config depends on username, admin, Expo, and cookie plugins (`db/auth.ts:22-27`) and schema has their relevant fields (`db/schema.ts:14-91`). Package manifest declares Better Auth and Expo plugin dependency series `^1.7.3` (`package.json:18-28`). |
| Keep `/api/auth/[...all]` mounted and preserve the server-only DAL boundary. | Client flows and session retrieval depend on the delegated handler and `auth.api.getSession` (`app/api/auth/[...all]/route.ts:1-4`; `db/auth-dal.ts:7-9`). The project rule prohibits `app/` imports of auth DB internals outside the DAL (`AGENTS.md:13-16`). |
| Preserve `briomobile://*` origin support and Expo plugin if the mobile client remains supported. | Both are active configuration, not documentation-only (`db/auth.ts:5-6,19-26`). |
| Do not move database session/role checks into the proxy. | The project instruction explicitly requires cookie-only proxy logic and DAL enforcement (`/home/ubuntu/work/BRIO/code/brioweb/AGENTS.md:33-35`), matching current implementation. |

## Recommended baseline checks

1. Run `npm run lint` and `npx tsc --noEmit` from `/home/ubuntu/work/BRIO/code/brioweb` after auth, route, schema, or plugin changes. Both passed in this audit.
2. Against a disposable database, verify anonymous and invalid-cookie requests to `/dashboard`, `/dashboard/chat`, `/profile`, and `/admin` redirect to sign-in; verify that a valid non-admin session is redirected from `/admin` to Dashboard; and verify a valid admin can access `/admin`.
3. Exercise `/api/health-samples` and `/api/chat` with no session and with two distinct test users. Confirm `401` without a session and confirm that one user cannot read or write another user’s health rows through the documented request shapes.
4. Test sign-up with the required username field, username/password sign-in, sign-out cookie invalidation, and home-page conditional links. Verify expected Better Auth error responses for duplicate email and duplicate username rather than relying only on UI state.
5. Before production use, replace the reset log callback with a transactional delivery mechanism and test expiration, single-use behavior, invalid/missing tokens, and log redaction. Do not use server logs as the reset-link delivery channel.
6. Validate deployment with production `BETTER_AUTH_URL`, stable auth secret, migrated schema, and the public origin. Also test the mobile client’s Expo session flow if it remains in scope.
7. Consider explicit guest-only handling for sign-in, sign-up, forgot-password, and reset-password pages and a validated return-to parameter for protected-route redirects.

## Environment-variable names observed

No values are reproduced in this report.

| Name | Observed purpose | Evidence |
|---|---|---|
| `DATABASE_URL` | Database connection for application and migrator. | `/home/ubuntu/work/BRIO/code/brioweb/db/client.ts:10-14`; `/home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml:6-7,17` |
| `BETTER_AUTH_SECRET` | Better Auth runtime secret, documented and passed to the app service. | `/home/ubuntu/work/BRIO/code/brioweb/.env.example:4-6`; `/home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml:16-20` |
| `BETTER_AUTH_URL` | Better Auth public application URL, documented and passed to the app service. | `/home/ubuntu/work/BRIO/code/brioweb/.env.example:4-6`; `/home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml:16-20` |
| `OPENAI_API_KEY` | Chat route/worker provider credential; not an authentication setting. | `/home/ubuntu/work/BRIO/code/brioweb/.env.example:8-10`; `/home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml:20,38-40` |
| `OPENAI_AGENTS_MODEL` | Optional chat/worker model selection. | `/home/ubuntu/work/BRIO/code/brioweb/.env.example:9-11` |
| `WORKER_INTERVAL_MINUTES` | Optional worker schedule setting. | `/home/ubuntu/work/BRIO/code/brioweb/.env.example:11-13`; `/home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml:37-40` |
| `NEXT_PHASE` | Build-phase guard for database configuration. | `/home/ubuntu/work/BRIO/code/brioweb/db/client.ts:4-11` |
| `NODE_ENV` | Runner image production setting. | `/home/ubuntu/work/BRIO/code/brioweb/Dockerfile:42-43` |

## References

All findings above are from direct inspection of the local source paths and line ranges cited in each table or paragraph. No external sources, live account data, secret values, reset tokens, or personal health data were used or reproduced.
