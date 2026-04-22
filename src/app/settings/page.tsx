"use client";

import { SettingsPanel } from "@/components/settings-panel";

export default function SettingsPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-[32px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-7 shadow-[0_18px_60px_rgba(16,27,54,0.08)] sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--color-accent)]">
          Settings and Rollout
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-[color:var(--color-foreground)]">
          Keep the product loop simple, but keep the deployment path real.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--color-muted)]">
          This page shows the current plan cap, the cloud services chosen for
          the production version, and the env contract for the live auth and
          staged rollout path.
        </p>
      </div>

      <SettingsPanel />
    </section>
  );
}
