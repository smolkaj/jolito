# ADR 0007: Signup alerts from verified accounts

- Status: proposed
- Date: 2026-09-10

Send the maintainer an email after a learner verifies their email and signs in
for the first time. Nothing in the app should wait for, initiate, or retry this
notification. Unverified accounts are not signups for this purpose.

Supabase Auth is the durable source of truth. Deployment enforces email
confirmation before applying the rollout baseline; auto-confirmed password
accounts would otherwise impersonate verified learners. The same code-based
email template serves new and returning users. A separate, private Cloudflare
Worker checks every five minutes and claims pending notifications through
service-role-only database functions. Database leases coordinate concurrent
runs. A successful provider acceptance is recorded before the next run; failed
or interrupted attempts become eligible again. Existing verified accounts are
suppressed when the migration is installed, avoiding a launch-time email flood.

There is no trigger on Auth: notification code cannot break the learner's
signup transaction. There is no public notification endpoint, browser storage
marker, or client background activity. Production credentials belong only to
the dedicated worker, never the app or branch previews.

Cloudflare sends directly to the maintainer's verified Email Routing destination.
The deployment script must verify that destination and restrict the binding to
it. [Sends to verified destinations are free](https://developers.cloudflare.com/email-service/platform/pricing/).
The schedule uses 288 invocations per day on Workers Free and the existing
Supabase Free database. There is no paid-provider fallback.

Email is at-least-once: a crash after provider acceptance but before recording
the receipt may cause a duplicate. Atomic database claims prevent simultaneous
normal sends; they cannot make an external mail provider transaction atomic.
Alerts usually arrive within five minutes, with longer delays during outages.

This replaces the browser-owned approach in PR #279. Its separate mocks missed
cross-boundary failures and concurrency. This implementation requires real
database lifecycle tests (claim, failure, lease expiry, reclaim, receipt),
concurrent claims, authorization tests, and worker tests for provider and
database outages. Account creation and verification must work while delivery
is unavailable.
