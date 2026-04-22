"use client";

import type { Pronunciation } from "@/lib/app-types";

export function PronunciationList({
  pronunciations,
  compact = false,
}: {
  pronunciations?: Pronunciation[];
  compact?: boolean;
}) {
  if (!pronunciations?.length) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "mt-3" : "mt-4"}`}>
      {pronunciations.map((pronunciation, index) => {
        const label = pronunciation.text ?? pronunciation.ipa ?? "Pronunciation";
        const hasDistinctIpa =
          pronunciation.ipa && pronunciation.ipa !== pronunciation.text;

        return (
          <div
            key={`${label}-${pronunciation.audioUrl ?? "silent"}-${index}`}
            className={`inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[rgba(17,32,57,0.05)] ${
              compact ? "px-3 py-1.5 text-xs" : "px-3 py-2 text-sm"
            } text-[color:var(--color-foreground)]`}
          >
            <span className="font-mono">{label}</span>
            {hasDistinctIpa ? (
              <span className="text-[color:var(--color-muted)]">
                /{pronunciation.ipa}/
              </span>
            ) : null}
            {pronunciation.audioUrl ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const audio = new Audio(pronunciation.audioUrl);
                    await audio.play();
                  } catch {
                    // Ignore playback failures in V0; the button remains a best-effort helper.
                  }
                }}
                className="rounded-full border border-[color:var(--color-border)] bg-white px-2 py-0.5 text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
                aria-label={`Play pronunciation for ${label}`}
              >
                Play
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
