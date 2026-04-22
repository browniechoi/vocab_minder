# Vocab V0

V0 is a staging-ready vocabulary web app for English learners:

- every successful search auto-adds the word to the vocab list
- free users are capped at `500 active vocabs`
- archived items free a slot immediately
- vocab items can also be deleted permanently when they were just search noise
- review follows a simplified Anki-style scheduler

The current implementation is intentionally split in two:

- signed-in users sync profile state and vocab items through `Supabase`
- review scheduling state still lives in browser storage under `vocab-v0-local-state:<auth-scope>:review`
- guest mode still falls back to a runnable local preview data layer

## Run locally

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Current scope

- `/` search and dashboard
- `/review` flashcard review queue
- `/vocab` active and archived vocab management
- `/settings` plan controls, cloud service choices, and environment checklist
- `/login` Supabase email/password auth entry point
- `/auth/confirm` email confirmation handler

## Cloud wiring staged

- `.env.example` documents the environment contract
- `supabase/migrations` is now the source of truth for the initial database model
- `src/lib/supabase/*` wires SSR auth, middleware, and clients
- `src/app/api/app-state` and `src/app/api/vocabs/*` now back the signed-in vocab flow

## Recommended services

- frontend hosting: `Vercel`
- auth + database: `Supabase`
- learner dictionary: `Merriam-Webster Learner's Dictionary API`
- billing: `Stripe`

## Next implementation step

Replace the remaining local review adapter with:

1. `review_states` and `review_events` persistence in Supabase
2. due-card queries driven by the database instead of the browser cache
3. transactional quota enforcement in SQL or RPC instead of per-route counting
4. Stripe checkout and webhook plan syncing

## Recommended local workflow

1. Start Next.js: `pnpm dev`
2. Start Supabase locally when you are ready to exercise auth and migrations: `pnpm exec supabase start`
3. Apply migrations locally with `pnpm exec supabase db reset`
4. Link a hosted staging project, then push migrations with `pnpm exec supabase db push`

## Deployment guide

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the concrete Vercel + Supabase production setup, including the exact project ref and redirect URL pattern.

## Required hosted setup

- Create separate `staging` and `production` Supabase projects
- Add `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel for each environment
- In Supabase Auth URL configuration, set:
  - Site URL to your environment’s canonical domain
  - Additional redirect URLs for `http://localhost:3000/**` and your Vercel preview pattern
- Keep `MERRIAM_API_KEY` and Stripe secrets server-side only
