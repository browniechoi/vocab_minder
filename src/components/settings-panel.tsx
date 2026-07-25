"use client";

import { useState } from "react";
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
  const [regenerationMessage, setRegenerationMessage] = useState<string | null>(
    null,
  );
  const [regenerationFailures, setRegenerationFailures] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);

  async function regenerateVocabulary(retryFailed = false) {
    if (
      !retryFailed &&
      !window.confirm(
        "Regenerate all existing vocabulary definitions and examples with AI? Review schedules and history will be preserved.",
      )
    ) {
      return;
    }

    setIsRegenerating(true);
    setRegenerationMessage("Regenerating vocabulary in small batches...");
    setRegenerationFailures(0);

    let regenerated = 0;
    let failed = 0;
    let hasMore = true;
    let firstRequest = true;
    let batchCount = 0;

    try {
      while (hasMore) {
        batchCount += 1;
        if (batchCount > 200) {
          throw new Error(
            "Regeneration stopped after 200 batches. Retry after checking server logs.",
          );
        }

        const response = await fetch("/api/vocabs/regenerate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            retryFailed: retryFailed && firstRequest,
          }),
        });
        const payload = (await response.json()) as {
          failed?: unknown[];
          hasMore?: boolean;
          message?: string;
          regenerated?: number;
        };

        if (!response.ok) {
          throw new Error(payload.message ?? "Vocabulary regeneration failed.");
        }

        regenerated += payload.regenerated ?? 0;
        failed += payload.failed?.length ?? 0;
        hasMore = Boolean(payload.hasMore);
        firstRequest = false;
        setRegenerationMessage(
          `Regenerated ${regenerated} vocabularies${
            failed ? `; ${failed} need retry` : ""
          }...`,
        );
      }

      setRegenerationFailures(failed);
      setRegenerationMessage(
        `Regeneration complete: ${regenerated} updated${
          failed ? `, ${failed} failed` : ""
        }. Reload to use the new content.`,
      );
    } catch (error) {
      setRegenerationMessage(
        error instanceof Error
          ? error.message
          : "Vocabulary regeneration failed.",
      );
    } finally {
      setIsRegenerating(false);
    }
  }

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

          {remotePersistenceEnabled ? (
            <div className="mt-6 rounded-[24px] border border-[color:var(--color-border)] bg-white px-5 py-5">
              <p className="text-sm font-medium text-[color:var(--color-foreground)]">
                AI vocabulary content
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
                Regenerate form-specific definitions, examples, roles, usage,
                collocations, lemmas, and cloze answers. Review schedules and
                history are not changed.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isRegenerating}
                  onClick={() => void regenerateVocabulary(false)}
                  className="rounded-full bg-[color:var(--color-foreground)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRegenerating ? "Regenerating..." : "Regenerate with AI"}
                </button>
                {regenerationFailures > 0 && !isRegenerating ? (
                  <button
                    type="button"
                    onClick={() => void regenerateVocabulary(true)}
                    className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)]"
                  >
                    Retry failures
                  </button>
                ) : null}
                {regenerationMessage?.includes("Reload") ? (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)]"
                  >
                    Reload
                  </button>
                ) : null}
              </div>
              {regenerationMessage ? (
                <p className="mt-3 text-sm leading-6 text-[color:var(--color-muted)]">
                  {regenerationMessage}
                </p>
              ) : null}
            </div>
          ) : null}
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
