import { NextResponse } from "next/server";
import {
  VOCAB_ROW_SELECT,
  mapProfileRowToState,
  mapVocabRowToPersistedItem,
  type VocabRow,
} from "@/lib/persisted-state";
import { getAuthenticatedContext } from "@/lib/supabase/route";

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
      .select(VOCAB_ROW_SELECT)
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
      .select(VOCAB_ROW_SELECT)
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
