# BRIO known gaps and external blocks

| Gap | Status | User impact | Required next action |
|---|---|---|---|
| Permission-priming copy approval | Partial | Functional copy is present but may need legal/product wording changes. | Owner reviews the step labelled `copy pending review`; retain signal-level specificity. |
| Physical iPhone HealthKit run | Blocked externally | Source code cannot prove Apple authorization, device networking, or real accepted samples. | Provision an iPhone development build, set deployed HTTPS API URL, enable selected web consent, sync, and record accepted/skipped/error counts. |
| Dokploy deployment | Blocked externally | Sandbox preview is temporary and not the final host. | Configure Dokploy Compose and exact public `BETTER_AUTH_URL`, deploy, then rerun browser signup and smoke tests. |
| Docker image execution | Blocked by sandbox | Dockerfile/Compose were not executed here. | Run `docker compose -f docker-compose.dokploy.yml build` in a Docker-capable environment. |
| Live agent credentials | Conditional, verified when configured | The four-specialist chat path is unavailable without consent and credentials; deterministic operation is unaffected. | Supply an official OpenAI key or a compatible base URL. The young-athlete ECP live review is already verified with the configured compatible API. |
| Worker scheduling | Known limitation | Schedule is interval-since-restart, with no catch-up. | Keep current worker for hackathon; move `worker/run-once.ts` to a platform scheduler if fixed wall-clock timing becomes required. |
| Password reset delivery | Not configured | Users cannot receive reset email. | Connect an email provider before claiming delivery. Current UI states the limitation. |
| Food catalogue search | Deferred by wireframe | Nutrition supports durable totals, not catalogue lookup. | Add a verified provider later; never fabricate restriction-safe search results. |
| Plan browser | Deferred by wireframe | Training supports manual sessions and saved history, not template browsing. | Add only after plans and provenance are defined. |
| Coach/reviewer multi-user view | Deferred by wireframe | No coach access or shared accounts. | Requires a separate authorization model and is outside this release. |
| Mobile background delivery | Not implemented | Helper sync runs foreground/manual; the web is the primary PWA. | Add only with native background-delivery design, OS constraints, and consent review. |
| Automated authenticated browser matrix | Partial | Core production signup/onboarding/Today path is browser-tested; every authenticated route is API/build-tested rather than exhaustively clicked at every breakpoint. | Add Playwright/Cypress when the project adopts a browser-test dependency. |

No gap is represented in the UI as available specialist execution, live provenance, or verified device behavior.
