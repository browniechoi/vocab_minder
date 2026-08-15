export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url,
    publishableKey,
  };
}

export function hasSupabaseEnv() {
  const { url, publishableKey } = getSupabaseEnv();

  if (!url || !publishableKey?.trim()) {
    return false;
  }

  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function getRequiredSupabaseEnv() {
  const { url, publishableKey } = getSupabaseEnv();

  if (!hasSupabaseEnv() || !url || !publishableKey) {
    throw new Error(
      "Invalid Supabase environment. Set a valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return {
    url,
    publishableKey,
  };
}
