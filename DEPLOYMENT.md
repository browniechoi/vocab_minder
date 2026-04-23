# Deployment Guide

This app should be deployed as:

- frontend/app server: `Vercel`
- auth + database: `Supabase`
- dictionary lookup: `Merriam-Webster Learner's Dictionary API`

For your current hosted backend, the Supabase project ref is:

- `yikdonnnuggljrayzqup`

## 1. Create the Git Remote

Create a GitHub repository and push this local repo to it.

Suggested branch model:

- `main` for production
- short-lived feature branches for changes

## 2. Create the Vercel Project

1. Import the GitHub repository into Vercel.
2. Framework should auto-detect as `Next.js`.
3. Keep the default build and output settings.

Use:

- `Hobby` only for personal testing
- `Pro` once the app is public or commercial

How preview deploys work:

- every push to a non-`main` branch gets its own Vercel preview URL
- pull requests point at that preview deployment automatically
- this app now builds auth confirmation links against the live preview URL during preview runs, so email sign-up flows do not bounce back to production
- preview deploys are still real apps, so if Preview env vars point at production Supabase they will mutate production data

## 3. Set Vercel Environment Variables

In the Vercel project, set these environment variables.

Required for all environments:

- `MERRIAM_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Required for production:

- `NEXT_PUBLIC_SITE_URL`

Optional for later billing work:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_ID`

Recommended values:

- `Production`
  - `NEXT_PUBLIC_SITE_URL=https://<your-production-domain>`
  - `NEXT_PUBLIC_SUPABASE_URL=https://<your-production-project-ref>.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production-publishable-key>`
- `Preview`
  - leave `NEXT_PUBLIC_SITE_URL` unset so preview auth links use the branch deployment URL automatically
  - `NEXT_PUBLIC_SUPABASE_URL=https://<your-staging-project-ref>.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>`
- `Development`
  - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
  - `NEXT_PUBLIC_SUPABASE_URL=https://<your-staging-project-ref>.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>`

Notes:

- `NEXT_PUBLIC_SITE_URL` should be a stable canonical domain, not a preview branch URL.
- Vercel exposes runtime system env vars such as `VERCEL_URL` and `VERCEL_BRANCH_URL`; the app uses those automatically for preview auth flows.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in Vercel unless you actually add server-only admin workflows that require it.

## 4. Configure Supabase Auth URLs

In the Supabase dashboard for project `yikdonnnuggljrayzqup`, go to Auth URL configuration.

Set for production:

- `Site URL`
  - `https://<your-production-domain>`

Add redirect URLs:

- `http://localhost:3000/**`
- `https://*-<your-vercel-team-or-account>.vercel.app/**`
- `https://<your-production-domain>/**`

If you create a separate staging Supabase project, repeat the same redirect pattern there and use the same preview wildcard URL.

This app uses:

- `/auth/confirm`
- `/login`

So those URLs must remain valid under the configured domains.

## 5. Link the Local Repo to Supabase

Run:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref yikdonnnuggljrayzqup
```

If prompted for a database password, use the remote database password from the Supabase dashboard.

## 6. Push the Schema

From this repo:

```bash
pnpm exec supabase db push
```

If you want to inspect first:

```bash
pnpm exec supabase db push --dry-run
```

## 7. Local Environment

Create `.env.local` with:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://yikdonnnuggljrayzqup.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<from-supabase-dashboard>
MERRIAM_API_KEY=<your-merriam-key>
```

Then run:

```bash
pnpm dev
```

## 8. First Production Smoke Test

After the first Vercel deploy:

1. Open the production URL on desktop.
2. Create an account.
3. Confirm email.
4. Sign in.
5. Search for a word and confirm it appears in `Vocabulary`.
6. Archive and restore a word.
7. Open the same production URL on your phone.
8. Sign in there and confirm the same vocab library is visible.
9. Review a card on desktop, then refresh on phone and confirm the updated due date is reflected there too.

Expected behavior right now:

- vocab items sync through Supabase
- plan changes sync through Supabase
- review schedules and review history sync through Supabase

## 9. Next Engineering Slice

To harden the deployment pipeline further, do these next:

- move due-card session queries into SQL or RPC instead of hydrating the full vocab list client-side
- enforce active-vocab limits transactionally in the database
- split Preview and Production onto separate Supabase projects if you are not already doing that
- add Stripe and webhook-driven plan changes once billing starts
