# Recovering across cloud protocol updates

The installed app and the database deploy independently. Snapshot reads use
`read_deck_snapshot`; CAS remains the only client write path. The PostgREST
`check_deck_client` hook rejects obsolete client `/decks` requests before the old
client can parse newer data or try an unconditional write. Its `message` field
contains save/backup guidance and the hosted `https://joli.to/update` route, which
already-shipped adapters display. It neither restores DML grants nor modifies data.
The read RPC is security-invoker and retains the table's owner RLS policy.

The hosted guide stays outside the cached app shell. Current sync failures link to
it in a new tab, preserving the running editor/practice session. Native iOS uses
the production HTTPS guide rather than the Capacitor asset origin. Nothing activates
a waiting worker, clears storage, or reloads a session automatically. Users finish
or save drafts, export a backup, then close all Jolito windows to let the browser
activate the complete waiting build. Native installations need an app update from
their distribution channel; they cannot acquire new bundled code by reloading.

## Rollout and recovery

- Database first: all older table clients receive actionable update guidance. Local
  cards remain usable; the new browser build arrives through the normal worker lifecycle.
- Client first: a missing RPC (`PGRST202`) gives a visible deployment/retry message.
  There is no fallback to the obsolete table route or unconditional writes.
- The migration fails if an existing authenticator/database pre-request hook would
  be replaced. Reconcile it explicitly in code before deployment. The hook is
  configured using Supabase's documented `ALTER ROLE authenticator` setting and
  schema/config reload notifications.
- Roll forward if the web deployment fails. Reverting to an obsolete web bundle
  cannot restore sync; retain local data and deploy the matching client. To remove
  this hook in a future migration, reset its authenticator setting before dropping
  the function, and retain the revoked direct-write privileges and read RPC.

No new bundle can retroactively execute inside an already open old page. Guidance
reaches it through the existing error display when the user next attempts sync.
An offline client cannot receive a new server message until it reconnects.

## Escaped defect analysis

**Root cause:** database compatibility was treated as a permission change rather
than an interaction contract spanning independently deployed, cached clients.

**Escape vector:** #305 revoked legacy table writes to prevent lost updates but
left only a database permission error. #303's v4 payload also caused older readers
to fail locally before they could reach that write. #302 correctly preserved old
working shells but did not supply a discoverable transition out of an obsolete
cloud protocol.

**Testing blind spot:** current-client CAS/owner tests and offline shell update
contracts passed independently; no test exercised an old read/write protocol against
the migrated backend and then recovered with the same local cards. The new live
protocol transition test covers reads, writes, no mutation on rejection, owner
isolation and resumed current-client sync. Browser tests retain a draft across a
waiting update and open hosted guidance without replacing the running app.

References: [Supabase pre-request configuration](https://supabase.com/docs/guides/api/securing-your-api)
and [PostgREST request transactions](https://docs.postgrest.org/en/v13/references/transactions.html).

An additional manual verification executed the unchanged pre-#303 adapter from
`e00d077` against the migrated local server: its original read/error path displayed
the update message before the old v3 parser ran. The archived adapter is not a
second maintained implementation; the permanent CI test exercises its HTTP
contract against the real server.
