# Production browser defect found and corrected

The first production HTTPS signup submission at 2026-09-12 22:34 +01:00 returned `Invalid origin`. The production server had inherited the local-only `BETTER_AUTH_URL` from ignored `.env.local`, while the browser Origin was the sandbox HTTPS hostname. This was not accepted as a passing signup. The code already relies on Better Auth's base URL as the trusted web origin; the production process must be restarted with `BETTER_AUTH_URL` set to the exact public HTTPS origin. The deployment runbook and environment example will make this requirement explicit, then the browser flow will be rerun.

Screenshot: `/home/ubuntu/screenshots/3000-im8ky65uk1j0vyp_2026-09-12_21-34-08_2269.webp`.
