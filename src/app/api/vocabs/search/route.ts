import { NextResponse } from "next/server";
import { type DictionaryEntry } from "@/lib/app-types";
import { lookupMerriamEntry } from "@/lib/merriam";
import {
  VOCAB_ROW_SELECT,
  attachReviewState,
  mapProfileRowToState,
  mapVocabRowToPersistedItem,
  type VocabRow,
} from "@/lib/persisted-state";
import { normalizeQuery } from "@/lib/mock-state";
import { getAuthenticatedContext } from "@/lib/supabase/route";
import {
  createFallbackReviewState,
  fetchCardForVocabItem,
  fetchReviewStateForCard,
} from "@/lib/supabase/review-data";

async function lookupEntry(query: string): Promise<DictionaryEntry | null> {
  const apiKey = process.env.MERRIAM_API_KEY;
  if (!apiKey) {
    throw new Error("MERRIAM_API_KEY is not configured. Add it to .env.local.");
  }

  return lookupMerriamEntry(query, apiKey);
}

async function buildReviewBackedVocab(
  userId: string,
  supabase: Awaited<ReturnType<typeof getAuthenticatedContext>>["supabase"],
  row: VocabRow,
) {
  if (!supabase) {
    return attachReviewState(
      mapVocabRowToPersistedItem(row),
      createFallbackReviewState(row.created_at),
    );
  }

  const card = await fetchCardForVocabItem(supabase, userId, row.id);
  const reviewState = card
    ? await fetchReviewStateForCard(supabase, card.id)
    : createFallbackReviewState(row.created_at);

  return attachReviewState(
    mapVocabRowToPersistedItem(row),
    reviewState ?? createFallbackReviewState(row.created_at),
  );
}

export async function POST(request: Request) {
  try {
    const { errorResponse, profile, supabase, user } =
      await getAuthenticatedContext();

    if (errorResponse || !profile || !supabase || !user) {
      return errorResponse;
    }

    const body = (await request.json()) as { query?: string };
    const originalQuery = body.query?.trim() ?? "";
    const normalizedQuery = normalizeQuery(originalQuery);

    if (!normalizedQuery) {
      return NextResponse.json(
        {
          outcome: "empty_query",
          entry: null,
          vocab: null,
          message: "Type a word or short phrase before searching.",
          profile: mapProfileRowToState(profile),
        },
        { status: 400 },
      );
    }

    const entry = await lookupEntry(normalizedQuery);
    if (!entry) {
      return NextResponse.json(
        {
          outcome: "not_found",
          entry: null,
          vocab: null,
          message: "No Merriam-Webster Learner's Dictionary match was found.",
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
      const { data: updated, error: updateError } = await supabase
        .from("vocab_items")
        .update({
          original_query: originalQuery,
          canonical_term: entry.canonicalTerm,
          normalized_term: entry.normalizedTerm,
          definition: entry.definition,
          definition_labels: entry.definitionLabels ?? [],
          example_sentence: entry.exampleSentence,
          part_of_speech: entry.partOfSpeech,
          pronunciations: entry.pronunciations ?? [],
          notes: entry.notes ?? null,
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

      return NextResponse.json({
        outcome:
          updated.status === "active" ? "existing_active" : "existing_archived",
        entry,
        vocab: await buildReviewBackedVocab(user.id, supabase, updated),
        message:
          updated.status === "active"
            ? "Already in the active vocab list. Search count and freshness were updated."
            : "Already archived. Restore it from Vocabulary if you want it back in review.",
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
        canonical_term: entry.canonicalTerm,
        normalized_term: entry.normalizedTerm,
        definition: entry.definition,
        definition_labels: entry.definitionLabels ?? [],
        example_sentence: entry.exampleSentence,
        part_of_speech: entry.partOfSpeech,
        pronunciations: entry.pronunciations ?? [],
        notes: entry.notes ?? null,
        status: "active",
        search_count: 1,
        last_searched_at: nowIso,
      })
      .select(VOCAB_ROW_SELECT)
      .single<VocabRow>();

    if (insertError) {
      return NextResponse.json({ message: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      outcome: "saved",
      entry,
      vocab: await buildReviewBackedVocab(user.id, supabase, created),
      message: "Saved and synced to Supabase. Definition data came from Merriam-Webster.",
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
