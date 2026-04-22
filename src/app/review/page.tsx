"use client";

import { ReviewStudio } from "@/components/review-studio";

export default function ReviewPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-[32px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-7 shadow-[0_18px_60px_rgba(16,27,54,0.08)] sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--color-accent)]">
          Review Session
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-[color:var(--color-foreground)]">
          Due cards first, friction second.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--color-muted)]">
          The queue is driven by the same scheduling rules the cloud version
          will use. Each answer updates interval, ease, lapse count, and due
          date.
        </p>
      </div>

      <ReviewStudio />
    </section>
  );
}
