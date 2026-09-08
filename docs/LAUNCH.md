# Jolito's first learners

Keep practice light. Privacy details live behind Privacy, terms and credits use
expandable sections, and no tracking, age database or consent wall is added.
Owner: Steffen Smolka. Support and privacy contact: a@joli.to.

## Before opening the beta

- Supply the responsible person's full contact address in `src/content/LegalContent.tsx`.
  “Mexico City, Mexico” is location context, **not a complete Article 15 address**.
  The notice remains incomplete until the owner supplies an address suitable for publication.
- Confirm the speech integration's permission with Microsoft or obtain focused legal advice.
  The consumer Edge endpoint is still in use; the privacy fixes do not establish
  permission to offer it in Jolito. See the [Microsoft terms, section 8](https://www.microsoft.com/en-us/servicesagreement).
  Keeping the existing voice experience while this is resolved is an explicit product
  choice for review, not a claim of legal clearance. Device speech already exists
  as a fallback, but its quality and offline availability vary by installed voice.
- Verify hosted signup settings with `npm run launch:preflight` using
  `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` from a private environment.
  This sends **no email** and prints no credentials. The same check is available
  through the manual Launch preflight workflow once merged.
- With permission from a non-team recipient, send one actual sign-in email.
  Verify sender identity, delivery, expired-link recovery and opening the link
  in another tab. Repeat the handoff on iOS Safari and a Home Screen install.
  Email Routing for feedback is separate from Supabase SMTP for login.
- Review the provider agreements, processing regions, security-log retention,
  account recovery and free-tier settings for Supabase, Cloudflare, Microsoft
  and the actual email provider. Record the SMTP provider here once verified.
  Enable owner MFA and retain recovery codes privately. Ensure domain renewal
  and a@joli.to forwarding reach an inbox the owner actually monitors.
- Take a private cloud backup and complete a restore rehearsal described below.
  Browser backup/restore tests do not prove cloud disaster recovery.

No provider credentials are available in the authoring environment. GitHub has
Supabase secrets, but their existence alone does not verify SMTP configuration,
successful external delivery, provider agreements or recoverable backups.

## A small beta

Invite 10–20 adult language learners personally. This is the initial recruitment
plan, not an assertion that the public app verifies ages. Do not market to children
or schools without revisiting parental consent and the relevant countries' rules.
An age statement by itself does not discharge those obligations.

Watch five people make a card, finish a short practice and return the next day.
Ask where they hesitated and whether they trust their words to be there tomorrow.
Do not add analytics or record sessions by default. Fix observed friction before
adding features. The current Practice label stays short; we will evaluate whether
people actually mistake the guest sample for a personal deck.

## Support and privacy requests

Check a@joli.to during the beta. Use the account email to verify ownership; do not
ask for identity documents by default. Keep a private record of the request,
verification, action, reply and due date. Under Mexico's current law, ARCO
decisions generally have a 20-business-day response window, followed by 15
business days to implement an approved request (Article 31; check exceptions).
The owner handles access, rectification, cancellation and objection requests.

The account deletion RPC removes the auth record and cascades to its deck and
linked feedback. A missing RPC or failed deletion must leave a retryable session
and must not report success. The active database deletion is atomic. Email copies,
guest feedback, provider logs, exported files and offline devices are separate.
For an erasure request, locate relevant support emails and remove them too;
identify guest feedback with the requester rather than guessing by display name.

Review retained feedback and support email at least every 90 days. Remove resolved
material no longer needed, unless a concrete legal/security obligation requires it.
Record any exception and the next review date. The notice promises retention
based on purpose, not an unimplemented automatic purge deadline.

For a suspected incident: stop the affected operation, preserve minimal evidence
privately, determine what users/data were affected, revoke compromised credentials,
fix the cause and contact affected people as required. Mexico's Article 19 requires
immediate notice for breaches significantly affecting patrimonial or moral rights.
Do not put personal data, deck contents or credentials into GitHub issues or CI logs.

## Recovery without a paid service

Use the [Supabase-supported CLI backup and restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
to export roles, schema, data and migration history. Use a private directory on an
encrypted device, outside Git and outside CI artifacts. Back up weekly during the
beta and before a data migration. Retain four weekly copies, then remove older
ones. Record the backup date, source project and a checksum privately.

Rehearse against an isolated local Supabase project using fabricated accounts and
decks first. Restore into a separate disposable target, never over production.
Check row counts, two-user RLS isolation, restored card/progress contents and
account deletion cascades. Auth/provider configuration and any encryption keys
need the separate handling documented by Supabase. A fresh sign-in may be required.
Record the restore date and result; “the dump command succeeded” is insufficient.

Local rehearsal, September 8, 2026: dumped the isolated
`jolito-launch-readiness` local Postgres database with `pg_dump --format=custom`,
restored with `pg_restore --no-owner` into a separate local database using the
local superuser, and verified both fabricated decks and their progress, one-deck
visibility as each learner, and all 27 pgTAP schema/RLS/deletion/bounds checks on
the restored database. This proves local application data recovery, not hosted
auth settings, production roles, email delivery or a production backup.

For a user-level recovery, Manage deck → Backup & export produces portable JSON.
The existing browser suite tests export, restore and schedules. Sync alone cannot
recover a mistake that has propagated to every device.

Retained backups may contain deleted records until they expire. If restoring an
older cloud backup, replay subsequent erasure requests before reopening access.
Do not expose archived data through the running app.

## Limits and migration recovery

Speech: 240 requests/minute per IP and hostname at each Cloudflare location.
Feedback notifications: 10/minute with the same scope. IPs can be shared, so these
are deliberately generous and are not global billing caps. Worker bindings are
declared in `wrangler.jsonc`; failed/missing bindings fail visibly. Body bytes are
bounded before JSON parsing. Old GET speech clients remain supported during the
transition; new clients POST phrases and neither response uses shared HTTP caching.
Previously cached public speech may still exist until removed or expired at providers.

Direct Supabase feedback inserts are also bounded: 5,000 message characters,
8 KiB context, 320 email characters; 10 submissions/minute per authenticated user,
30/minute shared by guests. The database owns timestamps and serializes each bucket.
The shared guest limit trades anonymous burst capacity for bounded anonymous writes
without storing IPs or adding another service. Botnets can still consume provider
quotas. Check free-tier usage during the beta; avoid auto-upgrades and paid add-ons.

Migration `20260908000000_feedback_bounds.sql` does not rewrite or delete old rows.
Its NOT VALID checks enforce new writes while preserving old data. If rollback is
needed, first remove the new insert trigger, then its function, constraints and index;
the previous feedback behavior returns and no user data needs restoration. Keep the
protections unless a measured compatibility problem justifies that rollback.

Pending sign-in cards use a new version-1 local envelope and stable card IDs.
There is no previous draft format to migrate. Existing deck/audio formats remain
readable. The shell cache version changes so stale navigation responses are retired.

## Sources for the notice

- [Mexico's LFPDPPP](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), current text: Articles 14–16, 19 and 31.
- [Supabase production SMTP](https://supabase.com/docs/guides/auth/auth-smtp): default delivery is restricted to team recipients.
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod): free-plan pause and backup limitations.
- [Wikimedia reuse requirements](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content) and [FrequencyWords content license](https://github.com/hermitdave/FrequencyWords#license).
- [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions): audience and actual knowledge matter; not a universal mandate to collect birth dates.

This runbook records implementation and open decisions. It is not a claim that
every jurisdiction's requirements have been satisfied.
