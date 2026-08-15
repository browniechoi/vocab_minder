"use client";

import { useAppState } from "@/components/app-state-provider";

export function SettingsPanel() {
  const { activeCount, resetReviewData, state } = useAppState();

  return (
    <div className="soft-panel rounded-[32px] px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Account
          </p>
          <p className="mt-3 text-2xl font-semibold capitalize text-[color:var(--color-foreground)]">
            {state.planTier} plan
          </p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            {activeCount} of {state.activeLimit} active vocabulary slots used
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Reset every review schedule and delete review history?",
              )
            ) {
              void resetReviewData();
            }
          }}
          className="rounded-full border border-[color:var(--color-danger)] px-4 py-2 text-sm font-medium text-[color:var(--color-danger)] hover:bg-[rgba(187,79,59,0.08)]"
        >
          Reset review data
        </button>
      </div>
    </div>
  );
}
