export function getBaseUrl() {
  const vercelEnv = process.env.VERCEL_ENV;
  const configuredUrl =
    (vercelEnv === "preview"
      ? process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL
      : undefined) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";

  const baseUrl = configuredUrl.startsWith("http")
    ? configuredUrl
    : `https://${configuredUrl}`;

  return baseUrl.replace(/\/$/, "");
}
