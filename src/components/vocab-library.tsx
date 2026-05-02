"use client";

import { useState } from "react";
import { useAppState } from "@/components/app-state-provider";
import { DefinitionLabelList } from "@/components/definition-label-list";
import { PronunciationList } from "@/components/pronunciation-list";
import { formatDueLabel, formatReviewInterval } from "@/lib/review";

type FilterMode = "all" | "active" | "archived";

export function VocabLibrary() {
  const {
    activeItems,
    archiveItem,
    archivedItems,
    deleteItem,
    remotePersistenceEnabled,
    restoreItem,
  } = useAppState();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [query, setQuery] = useState("");
  const [restoreMessage, setRestoreMessage] = useState("");

  const items = [...activeItems, ...archivedItems]
    .filter((item) => {
      if (filter === "active") {
        return item.status === "active";
      }
      if (filter === "archived") {
        return item.status === "archived";
      }
      return true;
    })
    .filter((item) => {
      const needle = query.trim().toLowerCase();
      if (!needle) {
        return true;
      }

      return (
        item.canonicalTerm.toLowerCase().includes(needle) ||
        item.definition.toLowerCase().includes(needle)
      );
    });

  return (
    <div className="space-y-6">
      <div className="soft-panel rounded-[32px] px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
              Filters
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["all", "active", "archived"] as FilterMode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    filter === value
                      ? "border-[color:var(--color-foreground)] bg-[color:var(--color-foreground)] text-white"
                      : "border-[color:var(--color-border)] bg-white text-[color:var(--color-foreground)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <label className="w-full lg:max-w-sm">
            <span className="sr-only">Search vocabulary</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by word or definition"
              className="h-12 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none transition-colors placeholder:text-[color:var(--color-muted)] focus:border-[color:var(--color-accent)]"
            />
          </label>
        </div>

        {restoreMessage ? (
          <p className="mt-4 rounded-[18px] bg-[rgba(17,32,57,0.08)] px-4 py-3 text-sm text-[color:var(--color-foreground)]">
            {restoreMessage}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="soft-panel rounded-[30px] px-6 py-6"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-[color:var(--color-foreground)]">
                    {item.canonicalTerm}
                  </h2>
                  <span className="rounded-full bg-[rgba(17,32,57,0.08)] px-3 py-1 text-xs font-medium text-[color:var(--color-foreground)]">
                    {item.status}
                  </span>
                  <span className="rounded-full bg-[rgba(221,107,63,0.12)] px-3 py-1 text-xs font-medium text-[color:var(--color-accent)]">
                    {item.partOfSpeech}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-[color:var(--color-foreground)]">
                  {item.definition}
                </p>
                <DefinitionLabelList labels={item.definitionLabels} />
                <PronunciationList
                  pronunciations={item.pronunciations}
                  compact
                />
                <p className="mt-3 text-sm italic leading-7 text-[color:var(--color-muted)]">
                  “{item.exampleSentence}”
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  <span>{item.searchCount} searches</span>
                  <span>{formatDueLabel(item.reviewState.dueAt)}</span>
                  <span>{formatReviewInterval(item.reviewState.intervalDays)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                {item.status === "active" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => archiveItem(item.id)}
                      className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-warning)] hover:text-[color:var(--color-warning)]"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const shouldDelete = window.confirm(
                          `Delete "${item.canonicalTerm}" permanently from your vocab library?`,
                        );
                        if (shouldDelete) {
                          void deleteItem(item.id);
                          setRestoreMessage(
                            remotePersistenceEnabled
                              ? `"${item.canonicalTerm}" was deleted from Supabase and removed from this review browser state.`
                              : `"${item.canonicalTerm}" was deleted from local preview data.`,
                          );
                        }
                      }}
                      className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        const response = await restoreItem(item.id);
                        setRestoreMessage(response.message);
                      }}
                      className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-accent-secondary)] hover:text-[color:var(--color-accent-secondary)]"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const shouldDelete = window.confirm(
                          `Delete "${item.canonicalTerm}" permanently from your vocab library?`,
                        );
                        if (shouldDelete) {
                          void deleteItem(item.id);
                          setRestoreMessage(
                            remotePersistenceEnabled
                              ? `"${item.canonicalTerm}" was deleted from Supabase and removed from this review browser state.`
                              : `"${item.canonicalTerm}" was deleted from local preview data.`,
                          );
                        }
                      }}
                      className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}

        {items.length === 0 ? (
          <div className="soft-panel rounded-[30px] px-6 py-8 text-sm leading-7 text-[color:var(--color-muted)]">
            No vocabulary items match the current filter.
          </div>
        ) : null}
      </div>
    </div>
  );
}
