# ADR 0008: Zero-Cost Monthly Deck Backup and Progress Digest

- Status: proposed
- Date: 2026-09-28

## Context

Learners benefit from periodic, tangible confirmation of their progress and data sovereignty. While Jolito syncs deck snapshots to Supabase, learners often worry about platform lock-in, forgotten decks, or unexpected data loss. Spaced repetition habits are also slow-burn: daily push notifications induce guilt and notification fatigue, whereas a monthly milestone celebration provides gentle, non-coercive reflection.

Ongoing operating costs must remain strictly $0.00 while delivering a full JSON backup of the user's deck and key learning metrics (cards added, cards graduated, total reviews completed, and tough words / leeches to watch out for).

## Decision

1. **Email Provider & Cost Invariant ($0.00):**
   Use Resend's permanent free tier (3,000 emails/month, 100 emails/day) to deliver digests with attached JSON backups (`jolito-backup-YYYY-MM.json`) matching `deckBackupEnvelopeSchema`.
   Cloudflare Workers native `send_email` on the Workers Free plan is restricted to verified domain owner inboxes and rejects arbitrary learner addresses; upgrading to Workers Paid ($5/mo) would violate the $0.00 invariant. Resend is the zero-cost path to arbitrary learner inboxes.

2. **Scheduling & Staggered Throughput:**
   A scheduled Cloudflare Worker cron trigger runs daily at 06:00 UTC. Instead of bursting all emails on the 1st of the month (which would immediately breach Resend's 100/day limit once active accounts exceed 100), delivery is staggered across the month (~50–80 emails/day). This supports ~2,400 active monthly subscribers (~10,000+ registered accounts) at strictly $0.00.

3. **Metrics & Snapshot Computation:**
   Jolito's deck snapshot in Supabase PostgreSQL stores cards with FSRS metadata. Metrics are computed deterministically without heavy review logging:
   - **Cards added:** `card.createdAt >= monthStartTimestamp`.
   - **Cards graduated / mastered:** Cards reaching long-term memory (`cardMasteryLevel(schedule) === 3`, 3 bubbles) reviewed in the period.
   - **Total reviews:** Delta of lifetime reviews (`sum(card.schedule.reviews) - baselineReviews`). The digest recorder stores the user's lifetime review total on dispatch to advance the baseline.
   - **Words to watch out for:** Top 3–5 cards sorted by lapses descending and stability ascending.
   - **Freshly mastered words:** Top cards that reached 3 bubbles in the period.

4. **Anti-Spam & Proactive Inactivity Sunsetting:**
   - **Calm Footer & One-Click Headers:** Every email features standard RFC 8058 `List-Unsubscribe` headers (one-click via POST) and an unsubscribe link in the calm card footer. The web endpoint renders an interactive confirmation page on GET to protect against automated link prefetch crawlers, mutating database state only on POST.
   - **Inactivity Auto-Pause:** If a deck shows zero reviews in the past 45 days, Jolito sends one final polite notice ("We noticed you haven't been practicing recently on Jolito. To keep your inbox clean, we've paused your monthly digests. Attached is your latest backup. You can re-enable anytime in the app.") and marks the account `paused`. No subsequent emails are sent until the learner reviews cards or re-enables digests.

5. **Consent & Preference Management:**
   - Authenticated learners can toggle their digest preference in the sync/settings modal.
   - An unauthenticated 1-click unsubscribe endpoint (`/api/digest/unsubscribe`) validates an HMAC-SHA256 token signed by the server secret, supporting RFC 8058 POSTs and browser confirmation GETs.

## Consequences

- **Data Sovereignty:** Learners receive immutable offline copies of their decks in their personal email archives every month.
- **Zero Cost:** 100% within free tiers (Cloudflare Workers Free, Supabase Free PostgreSQL, Resend Free).
- **Clean Inboxes:** Inactive users never receive indefinite spam, protecting learner trust and domain deliverability reputation.
