import { NextResponse } from "next/server";
import { type DictionaryEntry } from "@/lib/app-types";
import {
  VOCAB_ROW_SELECT,
  attachReviewState,
  mapProfileRowToState,
  mapVocabRowToPersistedItem,
  type VocabRow,
} from "@/lib/persisted-state";
import { getAuthenticatedContext } from "@/lib/supabase/route";
import {
  createFallbackReviewState,
  fetchCardForVocabItem,
  fetchReviewHydrationForUser,
  fetchReviewStateForCard,
} from "@/lib/supabase/review-data";
import {
  AI_VOCAB_PROMPT_VERSION,
} from "@/lib/vocab-enrichment";
import { lookupVocab } from "@/lib/vocab-lookup";
import { validateVocabQuery } from "@/lib/vocab-query";
import { isDue, NEW_WORD_DUE_CARD_LIMIT } from "@/lib/review";

function getPersistedContent(entry: DictionaryEntry) {
  return {
    canonical_term: entry.canonicalTerm,
    normalized_term: entry.normalizedTerm,
    definition: entry.definition,
    definition_labels: entry.definitionLabels ?? [],
    example_sentence: entry.exampleSentence,
    cloze_sentence: entry.clozeSentence,
    answer_lemma: entry.answerLemma,
    cloze_answer: entry.clozeAnswer,
    accepted_answers: entry.acceptedAnswers,
    part_of_speech: entry.partOfSpeech,
    grammatical_role: entry.grammaticalRole,
    usage_note: entry.usageNote,
    common_collocations: entry.commonCollocations,
    word_family_key: entry.wordFamilyKey,
    sense_key: entry.senseKey,
    pronunciations: entry.pronunciations ?? [],
    notes: entry.notes ?? null,
    dictionary_source: entry.contentProvider,
    content_provider: entry.contentProvider,
    content_model: entry.contentModel ?? null,
    content_prompt_version: entry.contentPromptVersion ?? null,
    content_generated_at: entry.contentGeneratedAt ?? null,
    content_edited_at: null,
  };
}

async function buildReviewBackedVocab(
  userId: string,
  supabase: Awaited<ReturnType<typeof getAuthenticatedContext>>["supabase"],
  row: VocabRow,
) {
  if (!supabase) {
    const vocab = attachReviewState(
      mapVocabRowToPersistedItem(row),
      createFallbackReviewState(row.created_at),
    );
    return {
      reviewCards: [],
      vocab,
    };
  }

  const card = await fetchCardForVocabItem(supabase, userId, row.id);
  const reviewState = card
    ? await fetchReviewStateForCard(supabase, card.id)
    : createFallbackReviewState(row.created_at);
  const vocab = attachReviewState(
    mapVocabRowToPersistedItem(row),
    reviewState ?? createFallbackReviewState(row.created_at),
  );

  return {
    reviewCards:
      card && reviewState
        ? [
            {
              id: card.id,
              vocabItemId: card.vocab_item_id,
              cardType: card.card_type,
              isActive: card.is_active,
              reviewState,
            },
          ]
        : [],
    vocab,
  };
}

export async function POST(request: Request) {
  try {
    const { errorResponse, profile, supabase, user } =
      await getAuthenticatedContext();

    if (errorResponse || !profile || !supabase || !user) {
      return errorResponse;
    }

    const body = (await request.json()) as {
      forceExact?: unknown;
      query?: string;
    };
    const originalQuery = body.query?.trim() ?? "";
    const forceExact = body.forceExact === true;
    const validation = validateVocabQuery(originalQuery);

    if (validation.message) {
      return NextResponse.json(
        {
          outcome: originalQuery ? "invalid_query" : "empty_query",
          entry: null,
          vocab: null,
          message: validation.message,
          profile: mapProfileRowToState(profile),
        },
        { status: 400 },
      );
    }
    const normalizedQuery = validation.normalizedQuery;

    const lookup = await lookupVocab(normalizedQuery, forceExact);
    const entry = lookup.entry;
    if (!entry) {
      if (lookup.suggestions.length > 0) {
        return NextResponse.json({
          outcome: "suggestion",
          entry: null,
          vocab: null,
          suggestions: lookup.suggestions,
          message: "No exact match. Did you mean one of these?",
          profile: mapProfileRowToState(profile),
        });
      }

      return NextResponse.json(
        {
          outcome: "not_found",
          entry: null,
          vocab: null,
          message: "No reliable English vocabulary entry was found.",
          profile: mapProfileRowToState(profile),
        },
        { status: 404 },
      );
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("vocab_items")
      .select(VOCAB_ROW_SELECT)
      .eq("user_id", user.id)
      .eq("normalized_term", entry.normalizedTerm)
      .order("status", { ascending: true })
      .returns<VocabRow[]>();

    if (existingError) {
      return NextResponse.json(
        { message: existingError.message },
        { status: 500 },
      );
    }

    const existing =
      existingRows?.find((item) => item.status === "active") ??
      existingRows?.[0] ??
      null;

    const nowIso = new Date().toISOString();

    if (existing) {
      const generatedByAi =
        entry.contentProvider === "gemini" ||
        entry.contentProvider === "openai";
      const shouldRefreshGeneratedContent =
        !existing.content_edited_at &&
        generatedByAi &&
        (existing.content_provider !== entry.contentProvider ||
          existing.content_prompt_version !== AI_VOCAB_PROMPT_VERSION);
      const { data: updated, error: updateError } = await supabase
        .from("vocab_items")
        .update({
          original_query: originalQuery,
          ...(shouldRefreshGeneratedContent ? getPersistedContent(entry) : {}),
          search_count: existing.search_count + 1,
          last_searched_at: nowIso,
        })
        .eq("id", existing.id)
        .select(VOCAB_ROW_SELECT)
        .single<VocabRow>();

      if (updateError) {
        return NextResponse.json(
          { message: updateError.message },
          { status: 500 },
        );
      }

      const reviewBackedVocab = await buildReviewBackedVocab(
        user.id,
        supabase,
        updated,
      );

      return NextResponse.json({
        outcome:
          updated.status === "active" ? "existing_active" : "existing_archived",
        entry,
        reviewCards: reviewBackedVocab.reviewCards,
        vocab: reviewBackedVocab.vocab,
        message:
          updated.status === "active"
            ? "Already in the active vocab list. Search count and freshness were updated."
            : "Already archived. Restore it from Vocabulary if you want it back in review.",
        profile: mapProfileRowToState(profile),
      });
    }

    const { reviewCards } = await fetchReviewHydrationForUser(supabase, user.id);
    const dueReviewCardCount = reviewCards.filter(
      (card) => card.isActive && isDue(card.reviewState),
    ).length;
    if (dueReviewCardCount >= NEW_WORD_DUE_CARD_LIMIT) {
      return NextResponse.json({
        outcome: "review_load_high",
        entry,
        vocab: null,
        reviewCards: [],
        message:
          "Review load is high. Clear due cards before adding more new words.",
        profile: mapProfileRowToState(profile),
      });
    }

    const { count, error: countError } = await supabase
      .from("vocab_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active");

    if (countError) {
      return NextResponse.json({ message: countError.message }, { status: 500 });
    }

    if ((count ?? 0) >= profile.active_vocab_limit) {
      return NextResponse.json({
        outcome: "limit_reached",
        entry,
        vocab: null,
        message:
          "Dictionary hit found, but the free-tier cap is full. Archive something or switch to Pro.",
        profile: mapProfileRowToState(profile),
      });
    }

    const { data: created, error: insertError } = await supabase
      .from("vocab_items")
      .insert({
        user_id: user.id,
        original_query: originalQuery,
        ...getPersistedContent(entry),
        status: "active",
        search_count: 1,
        last_searched_at: nowIso,
      })
      .select(VOCAB_ROW_SELECT)
      .single<VocabRow>();

    if (insertError) {
      return NextResponse.json({ message: insertError.message }, { status: 500 });
    }

    const reviewBackedVocab = await buildReviewBackedVocab(
      user.id,
      supabase,
      created,
    );

    return NextResponse.json({
      outcome: "saved",
      entry,
      reviewCards: reviewBackedVocab.reviewCards,
      vocab: reviewBackedVocab.vocab,
      message:
        entry.contentProvider === "gemini" ||
        entry.contentProvider === "openai"
          ? "Generated with AI and synced to Supabase."
          : "Saved from the dictionary fallback and synced to Supabase.",
      profile: mapProfileRowToState(profile),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Search persistence failed.",
      },
      { status: 500 },
    );
  }
}
