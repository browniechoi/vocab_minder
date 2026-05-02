"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  type AppState,
  type DictionaryEntry,
  type PersistedVocabItem,
  type ProfileState,
  type ReviewEvent,
  type ReviewRating,
  type ReviewState,
  type SearchOutcome,
  type VocabItem,
} from "@/lib/app-types";
import { normalizeDefinitionLabels } from "@/lib/definition-labels";
import {
  attachReviewState,
  createEmptyState,
} from "@/lib/persisted-state";
import { createSeedState, createVocabItem, normalizeQuery } from "@/lib/mock-state";
import { PLAN_LIMITS } from "@/lib/plan";
import { getPreviewStorageKey } from "@/lib/preview-config";
import { applyReview, isDue } from "@/lib/review";

type SearchResult = {
  outcome: SearchOutcome;
  entry: DictionaryEntry | null;
  vocab: VocabItem | null;
  message: string;
};

type DictionaryLookupResponse = {
  entry: DictionaryEntry | null;
  message: string | null;
  ok: boolean;
};

type BootstrapResponse = {
  items: VocabItem[];
  profile: ProfileState;
  reviewEvents: ReviewEvent[];
};

type RemoteSearchResponse = {
  outcome: SearchOutcome;
  entry: DictionaryEntry | null;
  vocab: VocabItem | null;
  message: string;
  profile: ProfileState;
};

type RemotePlanResponse = {
  profile: ProfileState;
  message?: string;
};

type RemoteRestoreResponse = {
  success: boolean;
  message: string;
  profile?: ProfileState;
  vocab?: PersistedVocabItem | null;
};

type RemoteReviewAnswerResponse = {
  reviewEvent: ReviewEvent;
  reviewState: ReviewState;
};

type VocabBackUpdate = {
  definition: string;
  definitionLabels?: string[];
  exampleSentence: string;
};

type AnswerCardResult = {
  message?: string;
  success: boolean;
};

type AppStateContextValue = {
  state: AppState;
  activeItems: VocabItem[];
  archivedItems: VocabItem[];
  dueItems: VocabItem[];
  activeCount: number;
  reviewsToday: number;
  remotePersistenceEnabled: boolean;
  search: (query: string) => Promise<SearchResult>;
  archiveItem: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<{ success: boolean; message: string }>;
  answerCard: (id: string, rating: ReviewRating) => Promise<AnswerCardResult>;
  updateVocabBack: (
    id: string,
    update: VocabBackUpdate,
  ) => Promise<{ success: boolean; message?: string }>;
  setPlanTier: (planTier: AppState["planTier"]) => Promise<void>;
  resetDemo: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

function countActive(items: VocabItem[]) {
  return items.filter((item) => item.status === "active").length;
}

function countReviewsToday(state: AppState) {
  const today = new Date().toDateString();
  return state.reviewEvents.filter(
    (event) => new Date(event.reviewedAt).toDateString() === today,
  ).length;
}

function readFullPreviewState(storageKey: string) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as AppState;
    if (!parsed.items || !parsed.reviewEvents) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function upsertItem(items: VocabItem[], nextItem: VocabItem) {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex === -1) {
    return [nextItem, ...items];
  }

  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function applyProfileState(
  current: AppState,
  profile?: ProfileState | null,
): AppState {
  if (!profile) {
    return current;
  }

  return {
    ...current,
    planTier: profile.planTier,
    activeLimit: profile.activeLimit,
  };
}

async function lookupDictionaryEntry(
  query: string,
): Promise<DictionaryLookupResponse> {
  const response = await fetch(
    `/api/dictionary/search?q=${encodeURIComponent(query)}`,
    {
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as {
    entry: DictionaryEntry | null;
    message?: string | null;
  };

  return {
    entry: payload.entry,
    message: payload.message ?? null,
    ok: response.ok,
  };
}

export function AppStateProvider({
  remotePersistenceEnabled,
  storageScope,
  children,
}: {
  remotePersistenceEnabled: boolean;
  storageScope: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AppState>(() =>
    remotePersistenceEnabled ? createEmptyState() : createSeedState(),
  );
  const canPersistRef = useRef(false);
  const pronunciationRefreshRef = useRef(new Set<string>());
  const previewStorageKey = getPreviewStorageKey(storageScope);

  useEffect(() => {
    let frameId: number | null = null;
    let cancelled = false;

    if (!remotePersistenceEnabled) {
      const stored = readFullPreviewState(previewStorageKey);
      if (stored) {
        frameId = window.requestAnimationFrame(() => {
          canPersistRef.current = true;
          setState(stored);
        });
        return () => {
          if (frameId !== null) {
            window.cancelAnimationFrame(frameId);
          }
        };
      }

      canPersistRef.current = true;
      return;
    }

    canPersistRef.current = false;

    void (async () => {
      try {
        const response = await fetch("/api/app-state", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            canPersistRef.current = true;
            setState(createEmptyState());
          }
          return;
        }

        const payload = (await response.json()) as BootstrapResponse;
        if (cancelled) {
          return;
        }

        canPersistRef.current = true;
        setState({
          planTier: payload.profile.planTier,
          activeLimit: payload.profile.activeLimit,
          items: payload.items,
          reviewEvents: payload.reviewEvents,
        });
      } catch {
        if (!cancelled) {
          canPersistRef.current = true;
          setState(createEmptyState());
        }
      }
    })();

    return () => {
      cancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [previewStorageKey, remotePersistenceEnabled]);

  useEffect(() => {
    if (!canPersistRef.current) {
      return;
    }

    if (remotePersistenceEnabled) {
      return;
    }

    window.localStorage.setItem(previewStorageKey, JSON.stringify(state));
  }, [previewStorageKey, remotePersistenceEnabled, state]);

  useEffect(() => {
    if (remotePersistenceEnabled || !canPersistRef.current) {
      return;
    }

    const candidates = state.items.filter(
      (item) =>
        !item.pronunciations?.length &&
        !pronunciationRefreshRef.current.has(item.normalizedTerm),
    );

    if (candidates.length === 0) {
      return;
    }

    let cancelled = false;
    const uniqueCandidates = candidates.filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) => candidate.normalizedTerm === item.normalizedTerm,
        ) === index,
    );

    uniqueCandidates.forEach((item) => {
      pronunciationRefreshRef.current.add(item.normalizedTerm);
    });

    void Promise.all(
      uniqueCandidates.map(async (item) => {
        try {
          const lookup =
            item.canonicalTerm || item.originalQuery || item.normalizedTerm;
          const { entry, ok } = await lookupDictionaryEntry(lookup);
          if (!ok || !entry?.pronunciations?.length || cancelled) {
            return;
          }

          setState((current) => {
            let changed = false;
            const items = current.items.map((existing) => {
              if (
                existing.normalizedTerm !== item.normalizedTerm ||
                existing.pronunciations?.length
              ) {
                return existing;
              }

              changed = true;
              return {
                ...existing,
                canonicalTerm: entry.canonicalTerm,
                normalizedTerm: entry.normalizedTerm,
                partOfSpeech: entry.partOfSpeech,
                definition: entry.definition,
                definitionLabels: entry.definitionLabels,
                exampleSentence: entry.exampleSentence,
                pronunciations: entry.pronunciations,
                notes: entry.notes,
              };
            });

            return changed ? { ...current, items } : current;
          });
        } catch {
          // Leave the stale preview row alone if the background refresh fails.
        }
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [remotePersistenceEnabled, state.items]);

  const activeItems = state.items
    .filter((item) => item.status === "active")
    .sort(
      (left, right) =>
        new Date(left.reviewState.dueAt).getTime() -
        new Date(right.reviewState.dueAt).getTime(),
    );
  const archivedItems = state.items
    .filter((item) => item.status === "archived")
    .sort(
      (left, right) =>
        new Date(right.lastSearchedAt).getTime() -
        new Date(left.lastSearchedAt).getTime(),
    );
  const dueItems = activeItems.filter((item) => isDue(item.reviewState));
  const activeCount = activeItems.length;
  const reviewsToday = countReviewsToday(state);

  const value: AppStateContextValue = {
    state,
    activeItems,
    archivedItems,
    dueItems,
    activeCount,
    reviewsToday,
    remotePersistenceEnabled,
    async search(query) {
      const normalizedQuery = normalizeQuery(query);
      if (!normalizedQuery) {
        return {
          outcome: "empty_query",
          entry: null,
          vocab: null,
          message: "Type a word or short phrase before searching.",
        };
      }

      if (!remotePersistenceEnabled) {
        let entry: DictionaryEntry | null = null;

        try {
          const { entry: lookupEntry, message, ok } =
            await lookupDictionaryEntry(normalizedQuery);

          if (!ok) {
            return {
              outcome: "not_found",
              entry: null,
              vocab: null,
              message:
                message ??
                "Dictionary lookup failed. Check your Merriam configuration.",
            };
          }

          entry = lookupEntry;
        } catch {
          return {
            outcome: "not_found",
            entry: null,
            vocab: null,
            message:
              "Dictionary lookup failed. Check your network connection and Merriam configuration.",
          };
        }

        if (!entry) {
          return {
            outcome: "not_found",
            entry: null,
            vocab: null,
            message: "No Merriam-Webster Learner's Dictionary match was found.",
          };
        }

        const nowIso = new Date().toISOString();
        let result: SearchResult = {
          outcome: "saved",
          entry,
          vocab: null,
          message: "",
        };

        setState((current) => {
          const existing = current.items.find(
            (item) => item.normalizedTerm === entry.normalizedTerm,
          );

          if (existing) {
            const updated = {
              ...existing,
              originalQuery: query.trim(),
              definition: entry.definition,
              definitionLabels: entry.definitionLabels,
              exampleSentence: entry.exampleSentence,
              partOfSpeech: entry.partOfSpeech,
              pronunciations: entry.pronunciations,
              notes: entry.notes,
              searchCount: existing.searchCount + 1,
              lastSearchedAt: nowIso,
            };

            result = {
              outcome:
                existing.status === "active"
                  ? "existing_active"
                  : "existing_archived",
              entry,
              vocab: updated,
              message:
                existing.status === "active"
                  ? "Already in the active vocab list. Search count and freshness were updated."
                  : "Already archived. Restore it from Vocabulary if you want it back in review.",
            };

            return {
              ...current,
              items: current.items.map((item) =>
                item.id === existing.id ? updated : item,
              ),
            };
          }

          if (countActive(current.items) >= current.activeLimit) {
            result = {
              outcome: "limit_reached",
              entry,
              vocab: null,
              message:
                "Dictionary hit found, but the free-tier cap is full. Archive something or switch to Pro.",
            };
            return current;
          }

          const created = createVocabItem(entry, query.trim());
          result = {
            outcome: "saved",
            entry,
            vocab: created,
            message:
              "Saved and queued for review. Definition data came from Merriam-Webster.",
          };

          return {
            ...current,
            items: [created, ...current.items],
          };
        });

        return result;
      }

      try {
        const response = await fetch("/api/vocabs/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: query.trim() }),
        });
        const payload = (await response.json()) as
          | RemoteSearchResponse
          | { message?: string };

        if (!response.ok && !("outcome" in payload)) {
          return {
            outcome: "not_found",
            entry: null,
            vocab: null,
            message:
              payload.message ??
              "Search failed before Supabase could persist the vocab item.",
          };
        }

        const remotePayload = payload as RemoteSearchResponse;

        setState((current) => {
          let nextState = applyProfileState(current, remotePayload.profile);

          if (remotePayload.vocab) {
            nextState = {
              ...nextState,
              items: upsertItem(nextState.items, remotePayload.vocab),
            };
          }

          return nextState;
        });

        return {
          outcome: remotePayload.outcome,
          entry: remotePayload.entry,
          vocab: remotePayload.vocab,
          message: remotePayload.message,
        };
      } catch {
        return {
          outcome: "not_found",
          entry: null,
          vocab: null,
          message:
            "Cloud search failed. Check your Supabase session and network connection.",
        };
      }
    },
    async archiveItem(id) {
      if (!remotePersistenceEnabled) {
        setState((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === id ? { ...item, status: "archived" } : item,
          ),
        }));
        return;
      }

      try {
        const response = await fetch(`/api/vocabs/${id}/archive`, {
          method: "POST",
        });
        const payload = (await response.json()) as
          | { vocab?: PersistedVocabItem; message?: string }
          | { message?: string };

        if (!response.ok || !("vocab" in payload) || !payload.vocab) {
          return;
        }

        const nextVocab = payload.vocab;
        setState((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === id
              ? attachReviewState(nextVocab, item.reviewState)
              : item,
          ),
        }));
      } catch {
        // Keep the current view stable if the archive request fails.
      }
    },
    async deleteItem(id) {
      if (!remotePersistenceEnabled) {
        setState((current) => ({
          ...current,
          items: current.items.filter((item) => item.id !== id),
          reviewEvents: current.reviewEvents.filter(
            (event) => event.vocabItemId !== id,
          ),
        }));
        return;
      }

      try {
        const response = await fetch(`/api/vocabs/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          return;
        }

        setState((current) => ({
          ...current,
          items: current.items.filter((item) => item.id !== id),
          reviewEvents: current.reviewEvents.filter(
            (event) => event.vocabItemId !== id,
          ),
        }));
      } catch {
        // Keep the current view stable if the delete request fails.
      }
    },
    async restoreItem(id) {
      if (!remotePersistenceEnabled) {
        let response = {
          success: true,
          message: "Restored to active vocabulary.",
        };

        setState((current) => {
          if (countActive(current.items) >= current.activeLimit) {
            response = {
              success: false,
              message:
                "Restore blocked because the active vocab cap is already full.",
            };
            return current;
          }

          return {
            ...current,
            items: current.items.map((item) =>
              item.id === id ? { ...item, status: "active" } : item,
            ),
          };
        });

        return response;
      }

      try {
        const response = await fetch(`/api/vocabs/${id}/restore`, {
          method: "POST",
        });
        const payload = (await response.json()) as RemoteRestoreResponse;

        setState((current) => {
          let nextState = applyProfileState(current, payload.profile);

          if (payload.success && payload.vocab) {
            const updated = attachReviewState(
              payload.vocab,
              current.items.find((item) => item.id === payload.vocab?.id)?.reviewState,
            );
            nextState = {
              ...nextState,
              items: current.items.map((item) =>
                item.id === id ? updated : item,
              ),
            };
          }

          return nextState;
        });

        return {
          success: payload.success,
          message: payload.message,
        };
      } catch {
        return {
          success: false,
          message: "Restore failed unexpectedly.",
        };
      }
    },
    async answerCard(id, rating) {
      if (remotePersistenceEnabled) {
        try {
          const response = await fetch("/api/review/answer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ rating, vocabItemId: id }),
          });
          const payload = (await response.json()) as
            | RemoteReviewAnswerResponse
            | { message?: string };

          if (
            !response.ok ||
            !("reviewEvent" in payload) ||
            !("reviewState" in payload)
          ) {
            const errorMessage =
              "message" in payload ? payload.message : undefined;
            return {
              success: false,
              message:
                errorMessage ??
                "Review answer failed before the new schedule could be saved.",
            };
          }

          setState((current) => ({
            ...current,
            items: current.items.map((item) =>
              item.id === id
                ? { ...item, reviewState: payload.reviewState }
                : item,
            ),
            reviewEvents: [payload.reviewEvent, ...current.reviewEvents].slice(
              0,
              100,
            ),
          }));
          return { success: true };
        } catch {
          return {
            success: false,
            message: "Review answer failed because the network request did not complete.",
          };
        }
      }

      const reviewedAt = new Date();
      const reviewedIso = reviewedAt.toISOString();

      setState((current) => {
        const target = current.items.find((item) => item.id === id);
        if (!target) {
          return current;
        }

        const nextReviewState = applyReview(target.reviewState, rating, reviewedAt);
        const reviewEvent = {
          id: crypto.randomUUID(),
          vocabItemId: id,
          rating,
          reviewedAt: reviewedIso,
          previousDueAt: target.reviewState.dueAt,
          newDueAt: nextReviewState.dueAt,
        };

        return {
          ...current,
          items: current.items.map((item) =>
            item.id === id ? { ...item, reviewState: nextReviewState } : item,
          ),
          reviewEvents: [reviewEvent, ...current.reviewEvents].slice(0, 100),
        };
      });
      return { success: true };
    },
    async updateVocabBack(id, update) {
      const definition = update.definition.trim();
      const exampleSentence = update.exampleSentence.trim();
      const definitionLabels = normalizeDefinitionLabels(
        update.definitionLabels ?? [],
      );

      if (!definition) {
        return {
          success: false,
          message: "Definition is required.",
        };
      }

      if (!remotePersistenceEnabled) {
        setState((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  definition,
                  definitionLabels,
                  exampleSentence:
                    exampleSentence || "No example sentence available.",
                }
              : item,
          ),
        }));
        return { success: true };
      }

      try {
        const response = await fetch(`/api/vocabs/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            definition,
            definitionLabels,
            exampleSentence,
          }),
        });
        const payload = (await response.json()) as
          | { vocab?: PersistedVocabItem; message?: string }
          | { message?: string };

        if (!response.ok || !("vocab" in payload) || !payload.vocab) {
          return {
            success: false,
            message:
              payload.message ?? "Back update failed before it could be saved.",
          };
        }

        const nextVocab = payload.vocab;
        setState((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === id
              ? attachReviewState(nextVocab, item.reviewState)
              : item,
          ),
        }));
        return { success: true };
      } catch {
        return {
          success: false,
          message: "Back update failed because the network request did not complete.",
        };
      }
    },
    async setPlanTier(planTier) {
      if (!remotePersistenceEnabled) {
        setState((current) => ({
          ...current,
          planTier,
          activeLimit: PLAN_LIMITS[planTier],
        }));
        return;
      }

      try {
        const response = await fetch("/api/profile/plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planTier }),
        });
        const payload = (await response.json()) as
          | RemotePlanResponse
          | { message?: string };

        if (!response.ok || !("profile" in payload)) {
          return;
        }

        setState((current) => applyProfileState(current, payload.profile));
      } catch {
        // Leave the current plan untouched if the network request fails.
      }
    },
    async resetDemo() {
      if (!remotePersistenceEnabled) {
        setState(createSeedState());
        return;
      }

      try {
        const response = await fetch("/api/review/reset", {
          method: "POST",
        });

        if (!response.ok) {
          return;
        }
      } catch {
        return;
      }

      setState((current) => ({
        ...current,
        items: current.items.map((item) => ({
          ...item,
          reviewState: attachReviewState(item, null).reviewState,
        })),
        reviewEvents: [],
      }));
    },
  };

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider.");
  }

  return context;
}
