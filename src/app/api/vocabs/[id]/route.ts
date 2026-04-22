import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/route";

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
