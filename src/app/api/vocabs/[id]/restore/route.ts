import { NextResponse } from "next/server";
import { mapProfileRowToState, mapVocabRowToPersistedItem } from "@/lib/persisted-state";
import { getAuthenticatedContext } from "@/lib/supabase/route";

type VocabRow = {
  id: string;
  original_query: string;
  canonical_term: string;
  normalized_term: string;
  definition: string;
  example_sentence: string | null;
  part_of_speech: string | null;
  pronunciations: unknown;
  notes: string | null;
  status: "active" | "archived";
  search_count: number;
  last_searched_at: string;
  created_at: string;
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse, profile, supabase, user } =
      await getAuthenticatedContext();
    if (errorResponse || !profile || !supabase || !user) {
      return errorResponse;
    }

    const { id } = await params;
    const { data: current, error: currentError } = await supabase
      .from("vocab_items")
      .select(
        "id, normalized_term, status, original_query, canonical_term, definition, example_sentence, part_of_speech, pronunciations, notes, search_count, last_searched_at, created_at",
      )
      .eq("id", id)
      .single<VocabRow>();

    if (currentError) {
      return NextResponse.json(
        { message: currentError.message },
        { status: 500 },
      );
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
      return NextResponse.json(
        {
          success: false,
          message: "Restore blocked because the active vocab cap is already full.",
          profile: mapProfileRowToState(profile),
        },
        { status: 409 },
      );
    }

    const { data: duplicateActive, error: duplicateError } = await supabase
      .from("vocab_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("normalized_term", current.normalized_term)
      .eq("status", "active")
      .neq("id", id)
      .maybeSingle();

    if (duplicateError) {
      return NextResponse.json(
        { message: duplicateError.message },
        { status: 500 },
      );
    }

    if (duplicateActive) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Restore blocked because an active copy of this word already exists.",
          profile: mapProfileRowToState(profile),
        },
        { status: 409 },
      );
    }

    const { data: restored, error: restoreError } = await supabase
      .from("vocab_items")
      .update({ status: "active" })
      .eq("id", id)
      .select(
        "id, original_query, canonical_term, normalized_term, definition, example_sentence, part_of_speech, pronunciations, notes, status, search_count, last_searched_at, created_at",
      )
      .single<VocabRow>();

    if (restoreError) {
      return NextResponse.json(
        { message: restoreError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Restored to active vocabulary.",
      profile: mapProfileRowToState(profile),
      vocab: mapVocabRowToPersistedItem(restored),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Restore failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
