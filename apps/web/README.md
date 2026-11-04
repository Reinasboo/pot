# POT web application

The Next.js app provides the POT landing page, Base Sepolia wallet onboarding, and a protected
server-side event indexer endpoint.

## Local development

Requirements: Node.js 20.9 or later and npm.

```powershell
npm install
npm run dev
```

The landing page and `/connect` route can be used without external configuration. The `/api/indexer`
endpoint remains unavailable until its server-side environment variables are set.

## Validation

```powershell
npm run lint
npm run build
```

## Indexer

Copy `.env.example` to `.env.local` and fill in the server-only values after the Supabase migration
has been applied and the factory has been deployed. Do not expose the Supabase service-role key,
RPC provider credentials, or indexer secret with a `NEXT_PUBLIC_` prefix.

See [../../docs/INDEXING.md](../../docs/INDEXING.md) for required configuration and operations.
