import { NextResponse } from "next/server";
import { lookupMerriamEntry } from "@/lib/merriam";
import { lookupVocab } from "@/lib/vocab-lookup";
import { validateVocabQuery } from "@/lib/vocab-query";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const pronunciationOnly = searchParams.get("pronunciationOnly") === "1";

  const validation = validateVocabQuery(query);
  if (validation.message) {
    return NextResponse.json(
      { entry: null, message: validation.message, suggestions: [] },
      { status: 400 },
    );
  }

  try {
    if (pronunciationOnly) {
      const entry = process.env.MERRIAM_API_KEY
        ? await lookupMerriamEntry(
            validation.normalizedQuery,
            process.env.MERRIAM_API_KEY,
          )
        : null;

      return NextResponse.json({ entry, message: null, suggestions: [] });
    }

    const lookup = await lookupVocab(validation.normalizedQuery);
    return NextResponse.json({
      entry: lookup.entry,
      message: lookup.entry
        ? null
        : lookup.suggestions.length > 0
          ? "No exact match. Did you mean one of these?"
          : null,
      suggestions: lookup.suggestions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        entry: null,
        message:
          error instanceof Error
            ? error.message
            : "Vocabulary generation failed unexpectedly.",
      },
      { status: 502 },
    );
  }
}
