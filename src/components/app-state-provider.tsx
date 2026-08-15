"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
import { attachReviewState, createEmptyState } from "@/lib/persisted-state";
import { isDue, normalizeReviewState } from "@/lib/review";
import { normalizeVocabTerm, validateVocabQuery } from "@/lib/vocab-query";

type SearchResult = {
  outcome: SearchOutcome;
  entry: DictionaryEntry | null;
  vocab: VocabItem | null;
  message: string;
  suggestions?: string[];
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
  search: (query: string, forceExact?: boolean) => Promise<SearchResult>;
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
  resetReviewData: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

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

export function AppStateProvider({
  authenticated,
  children,
}: {
  authenticated: boolean;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AppState>(createEmptyState);

  useEffect(() => {
    let cancelled = false;

    if (!authenticated) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/app-state", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setState(createEmptyState());
          }
          return;
        }

        const payload = (await response.json()) as BootstrapResponse;
        if (cancelled) {
          return;
        }

        setState(normalizeClientState({
          planTier: payload.profile.planTier,
          activeLimit: payload.profile.activeLimit,
          items: payload.items,
          reviewCards: payload.reviewCards,
          reviewEvents: payload.reviewEvents,
        }));
      } catch {
        if (!cancelled) {
          setState(createEmptyState());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated]);

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
    async search(query, forceExact = false) {
      const validation = validateVocabQuery(query);
      if (validation.message) {
        return {
          outcome: query.trim() ? "invalid_query" : "empty_query",
          entry: null,
          vocab: null,
          message: validation.message,
        };
      }
      try {
        const response = await fetch("/api/vocabs/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ forceExact, query: query.trim() }),
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
          message:
            "Review answer failed because the network request did not complete.",
        };
      }
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
      const normalizedTerm = canonicalTerm
        ? normalizeVocabTerm(canonicalTerm)
        : "";
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
    async resetReviewData() {
      try {
        const response = await fetch("/api/review/reset", {
          method: "POST",
        });

        if (!response.ok) {
          return;
        }
        window.location.reload();
      } catch {
        return;
      }
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
