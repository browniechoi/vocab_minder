import { NextResponse } from "next/server";
import { lookupMerriamEntry } from "@/lib/merriam";
import { lookupVocabEntry } from "@/lib/vocab-lookup";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const pronunciationOnly = searchParams.get("pronunciationOnly") === "1";

  if (!query) {
    return NextResponse.json(
      { entry: null, message: "Missing query." },
      { status: 400 },
    );
  }

  try {
    const entry = pronunciationOnly
      ? process.env.MERRIAM_API_KEY
        ? await lookupMerriamEntry(query, process.env.MERRIAM_API_KEY)
        : null
      : await lookupVocabEntry(query);

    return NextResponse.json({
      entry,
      message: null,
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
