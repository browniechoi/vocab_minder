"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  type AppState,
  type DictionaryEntry,
  type PersistedVocabItem,
  type ProfileState,
  type ReviewCard,
  type ReviewEvent,
  type ReviewQueueItem,
  type ReviewRating,
  type SearchOutcome,
  type VocabItem,
} from "@/lib/app-types";
import { normalizeDefinitionLabels } from "@/lib/definition-labels";
import { CLOZE_BLANK } from "@/lib/cloze";
import {
  attachReviewState,
  createEmptyState,
} from "@/lib/persisted-state";
import {
  createInitialReviewCardsForItem,
  createReviewCardForItem,
  createSeedState,
  createVocabItem,
  normalizeQuery,
} from "@/lib/mock-state";
import { PLAN_LIMITS } from "@/lib/plan";
import { getPreviewStorageKey } from "@/lib/preview-config";
import {
  applyReview,
  isDue,
  NEW_WORD_DUE_CARD_LIMIT,
  normalizeReviewState,
  shouldUnlockProduction,
} from "@/lib/review";
import { validateVocabQuery } from "@/lib/vocab-query";

type SearchResult = {
  outcome: SearchOutcome;
  entry: DictionaryEntry | null;
  vocab: VocabItem | null;
  message: string;
  suggestions?: string[];
};

type DictionaryLookupResponse = {
  entry: DictionaryEntry | null;
  message: string | null;
  ok: boolean;
  suggestions: string[];
};

type BootstrapResponse = {
  items: VocabItem[];
  profile: ProfileState;
  reviewCards: ReviewCard[];
  reviewEvents: ReviewEvent[];
};

type RemoteSearchResponse = {
  outcome: SearchOutcome;
  entry: DictionaryEntry | null;
  reviewCards?: ReviewCard[];
  vocab: VocabItem | null;
  message: string;
  profile: ProfileState;
  suggestions?: string[];
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
  reviewCard: ReviewCard;
  reviewEvent: ReviewEvent;
  unlockedCard?: ReviewCard;
};

type VocabBackUpdate = {
  acceptedAnswers?: string[];
  answerLemma?: string;
  canonicalTerm?: string;
  clozeAnswer?: string;
  clozeSentence?: string;
  commonCollocations?: string[];
  definition: string;
  definitionLabels?: string[];
  exampleSentence: string;
  grammaticalRole?: string;
  partOfSpeech?: string;
  usageNote?: string;
};

type AnswerCardResult = {
  message?: string;
  success: boolean;
};

type AppStateContextValue = {
  state: AppState;
  activeItems: VocabItem[];
  archivedItems: VocabItem[];
  dueItems: ReviewQueueItem[];
  activeCount: number;
  reviewsToday: number;
  remotePersistenceEnabled: boolean;
  search: (query: string) => Promise<SearchResult>;
  archiveItem: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<{ success: boolean; message: string }>;
  answerCard: (
    cardId: string,
    rating: ReviewRating,
  ) => Promise<AnswerCardResult>;
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

function normalizeClientState(state: AppState): AppState {
  return {
    ...state,
    items: state.items.map((item) => ({
      ...item,
      answerLemma:
        item.answerLemma || item.canonicalTerm.replace(/:\d+$/u, ""),
      clozeAnswer:
        item.clozeAnswer ||
        item.canonicalTerm.replace(/:\d+$/u, ""),
      clozeSentence:
        item.clozeSentence || "Use this word in context: _____.",
      acceptedAnswers:
        item.acceptedAnswers?.length > 0
          ? item.acceptedAnswers
          : [item.canonicalTerm.replace(/:\d+$/u, "")],
      grammaticalRole:
        item.grammaticalRole || item.partOfSpeech || "unknown",
      usageNote: item.usageNote ?? "",
      commonCollocations: item.commonCollocations ?? [],
      wordFamilyKey:
        item.wordFamilyKey ||
        (item.answerLemma || item.canonicalTerm)
          .toLowerCase()
          .replace(/[^a-z0-9]+/gu, "-"),
      senseKey: item.senseKey || "primary",
      contentProvider: item.contentProvider ?? "manual",
      reviewState: normalizeReviewState(
        item.reviewState,
        new Date(item.createdAt),
      ),
    })),
    reviewCards: (state.reviewCards ?? []).map((card) => ({
      ...card,
      reviewState: normalizeReviewState(card.reviewState),
    })),
    reviewEvents: state.reviewEvents ?? [],
  };
}

function readFullPreviewState(storageKey: string) {
  try {
    const stored = window.localStorage?.getItem(storageKey);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as AppState;
    if (!parsed.items || !parsed.reviewEvents) {
      return null;
    }

    return ensureReviewCards(
      normalizeClientState({
        ...parsed,
        reviewCards: parsed.reviewCards ?? [],
      }),
    );
  } catch {
    return null;
  }
}

function writeFullPreviewState(storageKey: string, state: AppState) {
  try {
    window.localStorage?.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in embedded browsers or privacy-restricted contexts.
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

function getRecognitionCard(item: VocabItem, reviewCards: ReviewCard[]) {
  return reviewCards.find(
    (card) => card.vocabItemId === item.id && card.cardType === "recognition",
  );
}

function withPrimaryReviewStates(state: AppState) {
  return state.items.map((item) => {
    const fallbackReviewState = normalizeReviewState(
      item.reviewState,
      new Date(item.createdAt),
    );

    return {
      ...item,
      reviewState: normalizeReviewState(
        getRecognitionCard(item, state.reviewCards)?.reviewState ??
          fallbackReviewState,
        new Date(item.createdAt),
      ),
    };
  });
}

function ensureReviewCards(state: AppState): AppState {
  const existingCards = (state.reviewCards ?? []).map((card) => ({
    ...card,
    reviewState: normalizeReviewState(card.reviewState),
  }));
  const nextCards = [...existingCards];

  for (const item of state.items) {
    if (!getRecognitionCard(item, nextCards)) {
      nextCards.push(createReviewCardForItem(item, "recognition", item.reviewState));
    }

    const recognitionState =
      getRecognitionCard(item, nextCards)?.reviewState ?? item.reviewState;
    const hasProductionCard = nextCards.some(
      (card) => card.vocabItemId === item.id && card.cardType === "production",
    );

    if (!hasProductionCard && shouldUnlockProduction(recognitionState)) {
      nextCards.push(createReviewCardForItem(item, "production"));
    }
  }

  return {
    ...state,
    items: withPrimaryReviewStates({
      ...state,
      reviewCards: nextCards,
    }),
    reviewCards: nextCards,
  };
}

function buildDueItems(items: VocabItem[], reviewCards: ReviewCard[]) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const seenVocabIds = new Set<string>();

  return reviewCards
    .map((card) => ({
      ...card,
      reviewState: normalizeReviewState(card.reviewState),
    }))
    .filter((card) => card.isActive && isDue(card.reviewState))
    .sort(
      (left, right) =>
        new Date(left.reviewState.dueAt).getTime() -
        new Date(right.reviewState.dueAt).getTime(),
    )
    .flatMap((card) => {
      const item = itemById.get(card.vocabItemId);
      if (!item || item.status !== "active" || seenVocabIds.has(item.id)) {
        return [];
      }

      seenVocabIds.add(item.id);
      return [
        {
          ...item,
          reviewCard: card,
          reviewState: card.reviewState,
        } satisfies ReviewQueueItem,
      ];
    });
}

function upsertReviewCards(
  reviewCards: ReviewCard[],
  nextCards: Array<ReviewCard | undefined>,
) {
  let cards = [...reviewCards];

  for (const nextCard of nextCards) {
    if (!nextCard) {
      continue;
    }

    const existingIndex = cards.findIndex((card) => card.id === nextCard.id);
    if (existingIndex === -1) {
      cards = [nextCard, ...cards];
      continue;
    }

    cards = cards.map((card) => (card.id === nextCard.id ? nextCard : card));
  }

  return cards;
}

async function lookupDictionaryEntry(
  query: string,
  options: { pronunciationOnly?: boolean } = {},
): Promise<DictionaryLookupResponse> {
  const searchParams = new URLSearchParams({ q: query });
  if (options.pronunciationOnly) {
    searchParams.set("pronunciationOnly", "1");
  }

  const response = await fetch(
    `/api/dictionary/search?${searchParams.toString()}`,
    {
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as {
    entry: DictionaryEntry | null;
    message?: string | null;
    suggestions?: string[];
  };

  return {
    entry: payload.entry,
    message: payload.message ?? null,
    ok: response.ok,
    suggestions: payload.suggestions ?? [],
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
        setState(normalizeClientState({
          planTier: payload.profile.planTier,
          activeLimit: payload.profile.activeLimit,
          items: payload.items,
          reviewCards: payload.reviewCards,
          reviewEvents: payload.reviewEvents,
        }));
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

    writeFullPreviewState(previewStorageKey, state);
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
          const { entry, ok } = await lookupDictionaryEntry(lookup, {
            pronunciationOnly: true,
          });
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
                pronunciations: entry.pronunciations,
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

  const currentReviewCards = state.reviewCards ?? [];
  const itemsWithPrimaryReviewStates = withPrimaryReviewStates({
    ...state,
    reviewCards: currentReviewCards,
  });
  const activeItems = itemsWithPrimaryReviewStates
    .filter((item) => item.status === "active")
    .sort(
      (left, right) =>
        new Date(left.reviewState.dueAt).getTime() -
        new Date(right.reviewState.dueAt).getTime(),
    );
  const archivedItems = itemsWithPrimaryReviewStates
    .filter((item) => item.status === "archived")
    .sort(
      (left, right) =>
        new Date(right.lastSearchedAt).getTime() -
        new Date(left.lastSearchedAt).getTime(),
    );
  const dueItems = buildDueItems(
    activeItems,
    currentReviewCards,
  );
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
      const validation = validateVocabQuery(query);
      if (validation.message) {
        return {
          outcome: query.trim() ? "invalid_query" : "empty_query",
          entry: null,
          vocab: null,
          message: validation.message,
        };
      }
      const normalizedQuery = validation.normalizedQuery;

      if (!remotePersistenceEnabled) {
        let entry: DictionaryEntry | null = null;

        try {
          const { entry: lookupEntry, message, ok, suggestions } =
            await lookupDictionaryEntry(normalizedQuery);

          if (!ok) {
            return {
              outcome: "not_found",
              entry: null,
              vocab: null,
              message:
                message ??
                "Vocabulary generation failed. Check the server configuration.",
            };
          }

          entry = lookupEntry;
          if (!entry && suggestions.length > 0) {
            return {
              outcome: "suggestion",
              entry: null,
              vocab: null,
              message: "No exact match. Did you mean one of these?",
              suggestions,
            };
          }
        } catch {
          return {
            outcome: "not_found",
            entry: null,
            vocab: null,
            message:
              "Vocabulary generation failed. Check your network connection and server configuration.",
          };
        }

        if (!entry) {
          return {
            outcome: "not_found",
            entry: null,
            vocab: null,
            message: "No reliable English vocabulary entry was found.",
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
              ...(!existing.contentEditedAt
                ? {
                    canonicalTerm: entry.canonicalTerm,
                    normalizedTerm: entry.normalizedTerm,
                    definition: entry.definition,
                    definitionLabels: entry.definitionLabels,
                    exampleSentence: entry.exampleSentence,
                    clozeSentence: entry.clozeSentence,
                    answerLemma: entry.answerLemma,
                    clozeAnswer: entry.clozeAnswer,
                    acceptedAnswers: entry.acceptedAnswers,
                    partOfSpeech: entry.partOfSpeech,
                    grammaticalRole: entry.grammaticalRole,
                    usageNote: entry.usageNote,
                    commonCollocations: entry.commonCollocations,
                    wordFamilyKey: entry.wordFamilyKey,
                    senseKey: entry.senseKey,
                    pronunciations: entry.pronunciations,
                    notes: entry.notes,
                    contentProvider: entry.contentProvider,
                    contentModel: entry.contentModel,
                    contentPromptVersion: entry.contentPromptVersion,
                    contentGeneratedAt: entry.contentGeneratedAt,
                  }
                : {}),
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

          const activeItemIds = new Set(
            current.items
              .filter((item) => item.status === "active")
              .map((item) => item.id),
          );
          const dueReviewCardCount = current.reviewCards.filter(
            (card) =>
              card.isActive &&
              activeItemIds.has(card.vocabItemId) &&
              isDue(card.reviewState),
          ).length;
          if (dueReviewCardCount >= NEW_WORD_DUE_CARD_LIMIT) {
            result = {
              outcome: "review_load_high",
              entry,
              vocab: null,
              message:
                "Review load is high. Clear due cards before adding more new words.",
            };
            return current;
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
            reviewCards: [
              ...createInitialReviewCardsForItem(created),
              ...current.reviewCards,
            ],
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
              reviewCards: upsertReviewCards(nextState.reviewCards, [
                ...(remotePayload.reviewCards ?? []),
              ]),
            };
          }

          return nextState;
        });

        return {
          outcome: remotePayload.outcome,
          entry: remotePayload.entry,
          vocab: remotePayload.vocab,
          message: remotePayload.message,
          suggestions: remotePayload.suggestions,
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
          reviewCards: current.reviewCards.map((card) =>
            card.vocabItemId === id ? { ...card, isActive: false } : card,
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
          reviewCards: current.reviewCards.map((card) =>
            card.vocabItemId === id ? { ...card, isActive: false } : card,
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
          reviewCards: current.reviewCards.filter(
            (card) => card.vocabItemId !== id,
          ),
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
          reviewCards: current.reviewCards.filter(
            (card) => card.vocabItemId !== id,
          ),
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
            reviewCards: current.reviewCards.map((card) =>
              card.vocabItemId === id ? { ...card, isActive: true } : card,
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
              reviewCards: current.reviewCards.map((card) =>
                card.vocabItemId === id ? { ...card, isActive: true } : card,
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
    async answerCard(cardId, rating) {
      if (remotePersistenceEnabled) {
        try {
          const response = await fetch("/api/review/answer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ cardId, rating }),
          });
          const payload = (await response.json()) as
            | RemoteReviewAnswerResponse
            | { message?: string };

          if (
            !response.ok ||
            !("reviewEvent" in payload) ||
            !("reviewCard" in payload)
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
              item.id === payload.reviewCard.vocabItemId &&
              payload.reviewCard.cardType === "recognition"
                ? { ...item, reviewState: payload.reviewCard.reviewState }
                : item,
            ),
            reviewCards: upsertReviewCards(current.reviewCards, [
              payload.reviewCard,
              payload.unlockedCard,
            ]),
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
        const targetCard = current.reviewCards.find((card) => card.id === cardId);
        if (!targetCard) {
          return current;
        }

        const target = current.items.find(
          (item) => item.id === targetCard.vocabItemId,
        );
        if (!target) {
          return current;
        }

        const nextReviewState = applyReview(
          targetCard.reviewState,
          rating,
          reviewedAt,
        );
        const updatedCard = {
          ...targetCard,
          reviewState: nextReviewState,
        };
        const shouldCreateProduction =
          targetCard.cardType === "recognition" &&
          shouldUnlockProduction(nextReviewState) &&
          !current.reviewCards.some(
            (card) =>
              card.vocabItemId === target.id &&
              card.cardType === "production",
          );
        const unlockedCard = shouldCreateProduction
          ? createReviewCardForItem(target, "production")
          : undefined;
        const reviewEvent = {
          id: crypto.randomUUID(),
          cardId,
          cardType: targetCard.cardType,
          vocabItemId: target.id,
          rating,
          reviewedAt: reviewedIso,
          previousDueAt: targetCard.reviewState.dueAt,
          newDueAt: nextReviewState.dueAt,
        };

        return {
          ...current,
          items: current.items.map((item) =>
            item.id === target.id && targetCard.cardType === "recognition"
              ? { ...item, reviewState: nextReviewState }
              : item,
          ),
          reviewCards: upsertReviewCards(current.reviewCards, [
            updatedCard,
            unlockedCard,
          ]),
          reviewEvents: [reviewEvent, ...current.reviewEvents].slice(0, 100),
        };
      });
      return { success: true };
    },
    async updateVocabBack(id, update) {
      const answerLemma = update.answerLemma?.trim();
      const clozeAnswer = update.clozeAnswer?.trim();
      const canonicalTerm = update.canonicalTerm?.trim();
      const clozeSentence = update.clozeSentence?.trim();
      const commonCollocations = [
        ...new Set(
          (update.commonCollocations ?? [])
            .map((collocation) => collocation.trim())
            .filter(Boolean),
        ),
      ];
      const definition = update.definition.trim();
      const exampleSentence = update.exampleSentence.trim();
      const acceptedAnswers = [
        ...new Set(
          (update.acceptedAnswers ?? [])
            .map((answer) => answer.trim())
            .filter(Boolean),
        ),
      ];
      const definitionLabels = normalizeDefinitionLabels(
        update.definitionLabels ?? [],
      );
      const normalizedTerm = canonicalTerm ? normalizeQuery(canonicalTerm) : "";
      const grammaticalRole = update.grammaticalRole?.trim();
      const partOfSpeech = update.partOfSpeech?.trim();
      const usageNote = update.usageNote?.trim();

      if (update.canonicalTerm !== undefined && !canonicalTerm) {
        return {
          success: false,
          message: "Word is required.",
        };
      }

      if (canonicalTerm && !normalizedTerm) {
        return {
          success: false,
          message: "Word needs at least one letter or number.",
        };
      }

      if (update.answerLemma !== undefined && !answerLemma) {
        return {
          success: false,
          message: "Answer lemma is required.",
        };
      }

      if (update.clozeAnswer !== undefined && !clozeAnswer) {
        return {
          success: false,
          message: "Cloze answer is required.",
        };
      }

      if (
        update.acceptedAnswers !== undefined &&
        acceptedAnswers.length === 0
      ) {
        return {
          success: false,
          message: "At least one accepted answer is required.",
        };
      }

      if (
        update.clozeSentence !== undefined &&
        (!clozeSentence ||
          clozeSentence.split(CLOZE_BLANK).length !== 2)
      ) {
        return {
          success: false,
          message: "Cloze sentence must contain exactly one _____ blank.",
        };
      }

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
              ? (() => {
                  const nextCanonicalTerm =
                    canonicalTerm ?? item.canonicalTerm;
                  const nextAnswerLemma =
                    answerLemma ?? item.answerLemma;

                  return {
                    ...item,
                    canonicalTerm: nextCanonicalTerm,
                    normalizedTerm: normalizedTerm || item.normalizedTerm,
                    answerLemma: nextAnswerLemma,
                    clozeAnswer:
                      clozeAnswer ??
                      (canonicalTerm ? canonicalTerm : item.clozeAnswer),
                    acceptedAnswers:
                      update.acceptedAnswers !== undefined
                        ? acceptedAnswers
                        : canonicalTerm
                          ? [nextCanonicalTerm]
                          : item.acceptedAnswers,
                    wordFamilyKey:
                      answerLemma !== undefined
                        ? answerLemma
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/gu, "-")
                        : item.wordFamilyKey,
                    definition,
                    definitionLabels,
                    grammaticalRole:
                      update.grammaticalRole !== undefined
                        ? grammaticalRole || "unknown"
                        : item.grammaticalRole,
                    usageNote:
                      update.usageNote !== undefined
                        ? usageNote ?? ""
                        : item.usageNote,
                    commonCollocations:
                      update.commonCollocations !== undefined
                        ? commonCollocations
                        : item.commonCollocations,
                    clozeSentence:
                      update.clozeSentence !== undefined
                        ? clozeSentence!
                        : item.clozeSentence,
                    exampleSentence:
                      exampleSentence || "No example sentence available.",
                    partOfSpeech:
                      update.partOfSpeech !== undefined
                        ? partOfSpeech || "unknown"
                        : item.partOfSpeech,
                    pronunciations:
                      canonicalTerm && normalizedTerm !== item.normalizedTerm
                        ? []
                        : item.pronunciations,
                    contentProvider: "manual",
                    contentEditedAt: new Date().toISOString(),
                  };
                })()
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
            ...(update.acceptedAnswers !== undefined
              ? { acceptedAnswers }
              : {}),
            answerLemma,
            canonicalTerm,
            clozeAnswer,
            clozeSentence,
            ...(update.commonCollocations !== undefined
              ? { commonCollocations }
              : {}),
            definition,
            definitionLabels,
            exampleSentence,
            grammaticalRole,
            partOfSpeech,
            usageNote,
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
        items: current.items.map((item) => {
          const reviewState = attachReviewState(item, null).reviewState;
          return {
            ...item,
            reviewState,
          };
        }),
        reviewCards: current.items.flatMap((item) => {
          const reviewState = attachReviewState(item, null).reviewState;
          return createInitialReviewCardsForItem({
            ...item,
            reviewState,
          });
        }),
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
