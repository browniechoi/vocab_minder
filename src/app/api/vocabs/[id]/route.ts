import { NextResponse } from "next/server";
import { normalizeDefinitionLabels } from "@/lib/definition-labels";
import { CLOZE_BLANK } from "@/lib/cloze";
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
      acceptedAnswers?: unknown;
      answerLemma?: string;
      canonicalTerm?: string;
      clozeAnswer?: string;
      clozeSentence?: string;
      commonCollocations?: unknown;
      definition?: string;
      definitionLabels?: unknown;
      exampleSentence?: string;
      grammaticalRole?: string;
      partOfSpeech?: string;
      usageNote?: string;
    };
    const answerLemma = body.answerLemma?.trim();
    const canonicalTerm = body.canonicalTerm?.trim();
    const clozeAnswer = body.clozeAnswer?.trim();
    const clozeSentence = body.clozeSentence?.trim();
    const definition = body.definition?.trim() ?? "";
    const exampleSentence = body.exampleSentence?.trim() ?? "";
    const grammaticalRole = body.grammaticalRole?.trim();
    const normalizedTerm = canonicalTerm ? normalizeQuery(canonicalTerm) : "";
    const partOfSpeech = body.partOfSpeech?.trim();
    const usageNote = body.usageNote?.trim();
    const acceptedAnswers = Array.isArray(body.acceptedAnswers)
      ? [
          ...new Set(
            body.acceptedAnswers.flatMap((answer) =>
              typeof answer === "string" && answer.trim()
                ? [answer.trim()]
                : [],
            ),
          ),
        ]
      : [];
    const commonCollocations = Array.isArray(body.commonCollocations)
      ? [
          ...new Set(
            body.commonCollocations.flatMap((collocation) =>
              typeof collocation === "string" && collocation.trim()
                ? [collocation.trim()]
                : [],
            ),
          ),
        ]
      : [];

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

    if (body.answerLemma !== undefined && !answerLemma) {
      return NextResponse.json(
        { message: "Answer lemma is required." },
        { status: 400 },
      );
    }

    if (body.clozeAnswer !== undefined && !clozeAnswer) {
      return NextResponse.json(
        { message: "Cloze answer is required." },
        { status: 400 },
      );
    }

    if (
      body.acceptedAnswers !== undefined &&
      acceptedAnswers.length === 0
    ) {
      return NextResponse.json(
        { message: "At least one accepted answer is required." },
        { status: 400 },
      );
    }

    if (
      body.clozeSentence !== undefined &&
      (!clozeSentence ||
        clozeSentence.split(CLOZE_BLANK).length !== 2)
    ) {
      return NextResponse.json(
        { message: "Cloze sentence must contain exactly one _____ blank." },
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
        ...(answerLemma
          ? {
              answer_lemma: answerLemma,
              word_family_key: answerLemma
                .toLowerCase()
                .replace(/[^a-z0-9]+/gu, "-"),
            }
          : {}),
        ...(clozeAnswer || canonicalTerm
          ? { cloze_answer: clozeAnswer ?? canonicalTerm }
          : {}),
        ...(body.acceptedAnswers !== undefined
          ? { accepted_answers: acceptedAnswers }
          : canonicalTerm
            ? { accepted_answers: [canonicalTerm] }
            : {}),
        definition,
        definition_labels: normalizeDefinitionLabels(body.definitionLabels),
        ...(body.clozeSentence !== undefined
          ? { cloze_sentence: clozeSentence || null }
          : {}),
        example_sentence: exampleSentence || null,
        ...(body.grammaticalRole !== undefined
          ? { grammatical_role: grammaticalRole || "unknown" }
          : {}),
        ...(body.usageNote !== undefined
          ? { usage_note: usageNote || "" }
          : {}),
        ...(body.commonCollocations !== undefined
          ? { common_collocations: commonCollocations }
          : {}),
        ...(body.partOfSpeech !== undefined
          ? { part_of_speech: partOfSpeech || null }
          : {}),
        content_provider: "manual",
        content_edited_at: new Date().toISOString(),
        content_generation_error: null,
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
