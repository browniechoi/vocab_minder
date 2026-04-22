import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { PLAN_LIMITS } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  plan_tier: "free" | "pro";
  active_vocab_limit: number;
};

export async function getAuthenticatedContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      errorResponse: NextResponse.json(
        { message: "Authentication required." },
        { status: 401 },
      ),
      profile: null,
      supabase: null,
      user: null,
    };
  }

  const profile = await ensureProfile(supabase, user);

  return {
    errorResponse: null,
    profile,
    supabase,
    user,
  };
}

async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id }, { onConflict: "user_id" })
    .select("plan_tier, active_vocab_limit")
    .single<ProfileRow>();

  if (error) {
    throw error;
  }

  return {
    plan_tier: data.plan_tier ?? "free",
    active_vocab_limit: data.active_vocab_limit ?? PLAN_LIMITS.free,
  } satisfies ProfileRow;
}
