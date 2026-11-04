# Base Sepolia event indexing

## Status

The repository includes a Supabase migration and a server-only Next.js indexer endpoint. The
indexer has not been run against a configured Supabase project or deployed POT factory. It is not
the financial source of truth; contract reads and events remain authoritative.

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
- `SUPABASE_ANON_KEY`: Supabase anon/public key for read-only pot metadata and events. It may be
  used by this server route; do not treat it as an authorization secret.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service role key. Never use a `NEXT_PUBLIC_` prefix.
- `INDEXER_CRON_SECRET`: random secret of at least 32 characters.

Apply migrations before invoking the endpoint. The Supabase service role bypasses RLS; it is only
used by the protected server route. Never send it to the browser.

## Run a batch

Send a `POST` to `/api/indexer` from a trusted scheduler:

```http
POST /api/indexer
Authorization: Bearer <INDEXER_CRON_SECRET>
```

The endpoint verifies the RPC chain ID, indexes only confirmed-through blocks, claims one cursor
batch, upserts logs using `(chain_id, transaction_hash, log_index)`, and commits the cursor only
after the event writes and final block hash succeed. Failed batches release their lease where
possible and may be safely retried.

If the recorded batch-tip hash no longer matches the canonical chain, the indexer rewinds to the
configured factory start block and rebuilds its cached pot/event records. This favors correctness
over speed and can take multiple scheduled batches to catch up again.

## Access control and privacy

- Anonymous users may read public pot metadata and its indexed events.
- Authenticated organizers may update only description, cover image URL, and visibility, and only
  when the JWT `app_metadata.wallet_address` matches the onchain organizer.
- Only the service role can create pot rows, write chain events, or move indexer state.
- The wallet-authentication service that verifies a wallet signature and sets trusted
  `app_metadata.wallet_address` is not implemented yet; organizer metadata updates remain
  unavailable until it exists.
- Onchain contributor addresses and amounts are public. Hiding an address in the UI is not
  onchain privacy.

## Validation and operational limits

The web project lint/build validates the route and TypeScript types. Authentication and missing
configuration responses were smoke-tested locally. A live end-to-end indexing run still requires
a configured Supabase project, a deployed factory, its deployment block, and an HTTPS RPC endpoint.
No live database or chain data is included in the repository.

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
