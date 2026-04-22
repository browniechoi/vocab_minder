import { createBrowserClient } from "@supabase/ssr";
import { getRequiredSupabaseEnv } from "@/lib/supabase/env";

export function createClient() {
  const { publishableKey, url } = getRequiredSupabaseEnv();

  return createBrowserClient(url, publishableKey);
}
