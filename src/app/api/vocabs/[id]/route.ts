import { NextResponse } from "next/server";
import { normalizeDefinitionLabels } from "@/lib/definition-labels";
import {
  VOCAB_ROW_SELECT,
  mapVocabRowToPersistedItem,
  type VocabRow,
} from "@/lib/persisted-state";
import { normalizeQuery } from "@/lib/mock-state";
import { getAuthenticatedContext } from "@/lib/supabase/route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse, supabase } = await getAuthenticatedContext();
    if (errorResponse || !supabase) {
      return errorResponse;
    }

    const { id } = await params;
    const body = (await request.json()) as {
      canonicalTerm?: string;
      definition?: string;
      definitionLabels?: unknown;
      exampleSentence?: string;
      partOfSpeech?: string;
    };
    const canonicalTerm = body.canonicalTerm?.trim();
    const definition = body.definition?.trim() ?? "";
    const exampleSentence = body.exampleSentence?.trim() ?? "";
    const normalizedTerm = canonicalTerm ? normalizeQuery(canonicalTerm) : "";
    const partOfSpeech = body.partOfSpeech?.trim();

    if (body.canonicalTerm !== undefined && !canonicalTerm) {
      return NextResponse.json(
        { message: "Word is required." },
        { status: 400 },
      );
    }

    if (canonicalTerm && !normalizedTerm) {
      return NextResponse.json(
        { message: "Word needs at least one letter or number." },
        { status: 400 },
      );
    }

    if (!definition) {
      return NextResponse.json(
        { message: "Definition is required." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("vocab_items")
      .update({
        ...(canonicalTerm
          ? {
              canonical_term: canonicalTerm,
              normalized_term: normalizedTerm,
              pronunciations: [],
            }
          : {}),
        definition,
        definition_labels: normalizeDefinitionLabels(body.definitionLabels),
        example_sentence: exampleSentence || null,
        ...(body.partOfSpeech !== undefined
          ? { part_of_speech: partOfSpeech || null }
          : {}),
      })
      .eq("id", id)
      .select(VOCAB_ROW_SELECT)
      .single<VocabRow>();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ vocab: mapVocabRowToPersistedItem(data) });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Update failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse, supabase } = await getAuthenticatedContext();
    if (errorResponse || !supabase) {
      return errorResponse;
    }

    const { id } = await params;

    const { error } = await supabase.from("vocab_items").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Delete failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
