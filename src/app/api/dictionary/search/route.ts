import { NextResponse } from "next/server";
import { lookupMerriamEntry } from "@/lib/merriam";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json(
      { entry: null, message: "Missing query." },
      { status: 400 },
    );
  }

  const apiKey = process.env.MERRIAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        entry: null,
        message: "MERRIAM_API_KEY is not configured. Add it to .env.local.",
      },
      { status: 500 },
    );
  }

  try {
    const entry = await lookupMerriamEntry(query, apiKey);

    return NextResponse.json({ entry, message: null });
  } catch (error) {
    return NextResponse.json(
      {
        entry: null,
        message:
          error instanceof Error
            ? error.message
            : "Dictionary lookup failed unexpectedly.",
      },
      { status: 502 },
    );
  }
}
