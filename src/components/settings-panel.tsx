"use client";

import { useAppState } from "@/components/app-state-provider";
import { CLOUD_SERVICES, ENV_CHECKLIST, PLAN_LIMITS } from "@/lib/plan";
import { LOCAL_STORAGE_KEY } from "@/lib/preview-config";

export function SettingsPanel() {
  const {
    activeCount,
    remotePersistenceEnabled,
    resetDemo,
    setPlanTier,
    state,
  } = useAppState();

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="grid gap-6">
        <div className="soft-panel rounded-[32px] px-6 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Plan Mode
          </p>
          <div className="mt-5 grid gap-4">
            {(["free", "pro"] as const).map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => setPlanTier(plan)}
                className={`rounded-[24px] border px-5 py-5 text-left transition-colors ${
                  state.planTier === plan
                    ? "border-[color:var(--color-foreground)] bg-[color:var(--color-foreground)] text-white"
                    : "border-[color:var(--color-border)] bg-white text-[color:var(--color-foreground)]"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em]">
                      {plan}
                    </p>
                    <p className="mt-2 text-sm leading-6 opacity-80">
                      {PLAN_LIMITS[plan]} active vocabs
                    </p>
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                    {plan === "free" ? "default" : "upgrade"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] border border-[color:var(--color-border)] bg-white px-5 py-5">
            <p className="text-sm font-medium text-[color:var(--color-foreground)]">
              Current usage
            </p>
            <p className="mt-2 text-3xl font-semibold text-[color:var(--color-foreground)]">
              {activeCount}/{state.activeLimit}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
              Downgrades do not delete vocab. They only block new adds and
              restores until the count is back under the cap.
            </p>
          </div>

          <button
            type="button"
            onClick={resetDemo}
            className="mt-6 rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          >
            {remotePersistenceEnabled
              ? "Reset synced review data"
              : "Reset preview data"}
          </button>
        </div>

        <div className="soft-panel rounded-[32px] px-6 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Environment Contract
          </p>
          <div className="mt-5 rounded-[20px] border border-[color:var(--color-border)] bg-white px-4 py-4">
            <p className="text-sm font-medium text-[color:var(--color-foreground)]">
              Storage mode
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
              {remotePersistenceEnabled ? (
                <>
                  Signed-in mode now syncs vocab items, plan state, review
                  schedules, and review history to Supabase.
                </>
              ) : (
                <>
                  Guest mode still stores the full app state in browser storage
                  under the scoped key pattern
                  <span className="mx-1 font-mono text-[color:var(--color-foreground)]">
                    {LOCAL_STORAGE_KEY}:&lt;auth-scope&gt;
                  </span>
                  until you sign in and use the Supabase-backed data path.
                </>
              )}
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {ENV_CHECKLIST.map((item) => (
              <div
                key={item.name}
                className="rounded-[20px] border border-[color:var(--color-border)] bg-white px-4 py-4"
              >
                <p className="font-mono text-sm text-[color:var(--color-foreground)]">
                  {item.name}
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                  {item.purpose}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="soft-panel rounded-[32px] px-6 py-6">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
          Production Services
        </p>
        <div className="mt-5 grid gap-4">
          {CLOUD_SERVICES.map((service) => (
            <div
              key={service.name}
              className="rounded-[24px] border border-[color:var(--color-border)] bg-white px-5 py-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[color:var(--color-foreground)]">
                    {service.name}
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                    {service.role}
                  </p>
                </div>
                <span className="rounded-full bg-[rgba(17,32,57,0.08)] px-3 py-1 text-xs font-medium text-[color:var(--color-foreground)]">
                  {service.v0Cost}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-[color:var(--color-foreground)]">
                {service.reason}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
