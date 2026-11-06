# Base Sepolia event indexing

## Status

The repository includes Supabase migrations and a server-only Next.js indexer endpoint. A
Base Sepolia Supabase project has been provisioned and all migrations have been applied. The
POT factory is deployed and configured, and a Vercel Schedule invokes the indexer every fifteen
minutes.
Supabase is not the financial source of truth; contract reads and events remain authoritative.

The migration creates:

- `pots`: contract-created pot configuration plus editable display metadata.
- `pot_events`: idempotently indexed creation, contribution, payout, and refund events.
- `indexer_state`: a leased block cursor for sequential, recoverable indexing.

Contribution and settlement amounts in `pot_events.event_data` are raw token base units encoded as
decimal strings. The database never converts them using an assumed token decimal count.

## Configuration

Set these server-side environment variables in `apps/web`:

- `BASE_SEPOLIA_RPC_URL`: HTTPS Base Sepolia RPC endpoint. Do not expose provider credentials.
- `POT_FACTORY_ADDRESS`: deployed factory address, verified for chain ID `84532`.
- `POT_INDEXER_START_BLOCK`: factory deployment block, greater than zero.
- `POT_INDEXER_CONFIRMATIONS`: number of blocks kept behind the current head; defaults to `64`.
- `POT_INDEXER_BATCH_SIZE`: blocks claimed per request; defaults to `500`, maximum `2000`.
- `SUPABASE_URL`: HTTPS Supabase project URL.
- `SUPABASE_ANON_KEY`: Supabase publishable or legacy anon key for read-only pot metadata and
  events. It may be used by this server route; do not treat it as an authorization secret.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase secret or legacy service-role key. Never use a
  `NEXT_PUBLIC_` prefix. The metadata API sends modern `sb_secret_` keys as `apikey` only; legacy
  service-role JWTs also use the `Authorization: Bearer` header.
- `INDEXER_CRON_SECRET`: random secret of at least 32 characters.

Apply migrations before invoking the indexer or publishing pot descriptions. Migrations are
currently applied to the configured project. The metadata editor also requires the service role
key; it is used only by server routes and never sent to the browser.

The schedule in `apps/web/vercel.json` invokes `POST /api/indexer` every fifteen minutes in
production, with up to 15 minutes of schedule jitter on the Hobby plan. Vercel sends the
`CRON_SECRET` bearer token automatically; set it to the same value as `INDEXER_CRON_SECRET` so the
route's existing authorization check protects scheduled requests. Each run processes at most five
confirmed batches (up to 10,000 blocks with a batch size of 2,000) and safely resumes on the next
run. Check Vercel function logs if indexing falls behind.

## Run a batch

Send a `POST` to `/api/indexer` from a trusted scheduler:

```http
POST /api/indexer
Authorization: Bearer <INDEXER_CRON_SECRET>
```

The endpoint verifies the RPC chain ID, indexes only confirmed-through blocks, and claims up to five
cursor batches per request. It upserts logs using `(chain_id, transaction_hash, log_index)` and
commits each cursor only after the event writes and final block hash succeed. Failed batches release
their lease where possible and may be safely retried.

If the recorded batch-tip hash no longer matches the canonical chain, the indexer rewinds to the
configured factory start block and rebuilds its cached pot/event records. This favors correctness
over speed and can take multiple scheduled batches to catch up again.

## Access control and privacy

- Anonymous users may read public pot metadata and its indexed events.
- Organizers may publish a description only for a public, indexed pot. The server verifies the
  wallet's one-time signature over the exact proposed description, Base Sepolia chain, factory
  registration, and onchain organizer before consuming the nonce and updating only that pot's
  description.
- Challenge nonces expire after five minutes, are single-use, and are limited to five per wallet
  in ten minutes. Nonces are retained after use until the rate-limit window expires.
- Only the service role can create pot rows, write chain events, or move indexer state.
- The metadata API is not a general wallet-authentication service and does not create Supabase
  sessions. The editor requires explicit consent because the description is public.
- Onchain contributor addresses and amounts are public. Hiding an address in the UI is not
  onchain privacy.

## Validation and operational limits

The web project lint/build validates the route and TypeScript types. Authentication and missing
configuration responses were smoke-tested locally. The configured Supabase REST API was checked
with its server secret and publishable keys after migrations; it currently contains no indexed pot
or chain data. A live end-to-end indexing run still requires a deployed factory, its deployment
block, and an HTTPS RPC endpoint.

## Public pot reads

`GET /api/pots/{address}` verifies that the address is registered in the configured factory,
checks the configured RPC chain ID, reads the pot's current state and token metadata directly
from Base Sepolia, then loads display metadata and indexed events using the Supabase anon key.
Balances, deadlines, payout/refund eligibility, and token decimals are never inferred from cached
database rows. The matching public UI is `/pot/{address}`.

`GET /api/pots?organizer={address}` returns up to 25 indexed public pot identity rows for the
requested Base Sepolia organizer. It uses only the Supabase anon key and public RLS policy, and
does not return balances or private pots. `/dashboard` uses this endpoint after wallet connection;
the indexer may not yet include a recently created pot.

`GET /api/pots/participating?contributor={address}` searches the 250 latest indexed
`ContributionMade` events for that Base Sepolia wallet and returns up to 25 distinct public pots
ordered by the latest matching contribution block. The `20261104000000_add_contributor_activity_index.sql`
migration adds an expression index for that lookup. Results use the Supabase anon key and public
RLS policies; private pots and contributions that have not yet passed the indexer's confirmation
depth are excluded. The dashboard does not calculate an all-time contribution total from this
bounded activity query.

`POST /api/pots/metadata/challenge` and `POST /api/pots/metadata` issue and consume the short-lived
wallet-signature authorization used by the public-pot description editor. Apply
`20261104180000_authorize_wallet_metadata.sql` before enabling this feature. A newly created pot
must first appear in the indexer before its description can be published.
