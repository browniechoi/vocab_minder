import type { PlanTier } from "@/lib/app-types";

export const PLAN_LIMITS: Record<PlanTier, number> = {
  free: 500,
  pro: 5000,
};

export const CLOUD_SERVICES = [
  {
    name: "Supabase",
    role: "Auth, Postgres, row-level security",
    v0Cost: "$0 on Free, $25/mo on Pro",
    reason:
      "The data model for vocab history, quotas, and review scheduling is SQL-shaped, and Supabase keeps the backend surface small.",
  },
  {
    name: "Vercel",
    role: "Next.js hosting and deployment",
    v0Cost: "$0 on Hobby, $20/mo on Pro",
    reason:
      "Fastest path to shipping the App Router frontend. Move to Pro once the app is public or commercial.",
  },
  {
    name: "Merriam-Webster Learner's API",
    role: "Reliable learner-oriented dictionary data",
    v0Cost: "$0 for non-commercial usage under the documented limit",
    reason:
      "Better fit than generic dictionary APIs because it is explicitly learner-focused and supports example-rich entries.",
  },
  {
    name: "Stripe",
    role: "Paid tier checkout and billing portal",
    v0Cost: "$0 fixed, then per transaction",
    reason:
      "Keep subscriptions self-serve instead of manual admin work once the free cap starts creating upgrade demand.",
  },
];

export const ENV_CHECKLIST = [
  {
    name: "NEXT_PUBLIC_SITE_URL",
    purpose: "Canonical app URL used for auth redirects and email confirmation links.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    purpose: "Client-side Supabase project URL for authenticated app traffic.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    purpose:
      "Public publishable key used by Supabase clients. Legacy anon keys still work as a fallback.",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    purpose: "Server-side elevated key for trusted route handlers and admin tasks.",
  },
  {
    name: "MERRIAM_API_KEY",
    purpose: "Server-side dictionary lookup key. Never expose this in the browser.",
  },
  {
    name: "STRIPE_SECRET_KEY",
    purpose: "Checkout and customer portal creation on the server.",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    purpose: "Webhook verification for plan changes and invoice events.",
  },
];
