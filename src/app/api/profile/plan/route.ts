import { NextResponse } from "next/server";
import { PLAN_LIMITS } from "@/lib/plan";
import { mapProfileRowToState } from "@/lib/persisted-state";
import { getAuthenticatedContext } from "@/lib/supabase/route";

type ProfileRow = {
  plan_tier: "free" | "pro";
  active_vocab_limit: number;
};

export async function POST(request: Request) {
  try {
    const { errorResponse, supabase, user } = await getAuthenticatedContext();
    if (errorResponse || !supabase || !user) {
      return errorResponse;
    }

    const body = (await request.json()) as { planTier?: "free" | "pro" };
    const planTier = body.planTier;

    if (!planTier || !(planTier in PLAN_LIMITS)) {
      return NextResponse.json(
        { message: "Invalid plan tier." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        plan_tier: planTier,
        active_vocab_limit: PLAN_LIMITS[planTier],
      })
      .eq("user_id", user.id)
      .select("plan_tier, active_vocab_limit")
      .single<ProfileRow>();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: mapProfileRowToState(data),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Plan update failed.",
      },
      { status: 500 },
    );
  }
}
