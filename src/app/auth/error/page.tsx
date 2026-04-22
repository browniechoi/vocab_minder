import Link from "next/link";

type AuthErrorPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const params = await searchParams;

  return (
    <section className="space-y-6">
      <div className="rounded-[32px] border border-[color:var(--color-danger)] bg-[rgba(187,79,59,0.08)] px-6 py-7 shadow-[0_18px_60px_rgba(16,27,54,0.08)] sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--color-danger)]">
          Auth Error
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-[color:var(--color-foreground)]">
          The confirmation flow did not complete.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--color-foreground)]">
          {params.message ??
            "The email link was invalid or expired. Start again from the login page."}
        </p>
      </div>

      <Link
        href="/login"
        className="inline-flex rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
      >
        Back to login
      </Link>
    </section>
  );
}
