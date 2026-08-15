import assert from "node:assert/strict";
import test from "node:test";
import { hasSupabaseEnv } from "@/lib/supabase/env";

test("rejects placeholder Supabase configuration", (context) => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  context.after(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
    }
  });

  process.env.NEXT_PUBLIC_SUPABASE_URL = "your-url-here";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "your-key-here";
  assert.equal(hasSupabaseEnv(), false);

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  assert.equal(hasSupabaseEnv(), true);
});
