"use client";

import { VocabLibrary } from "@/components/vocab-library";

export default function VocabPage() {
  return (
    <section className="space-y-6">
      <h1 className="sr-only">Vocabulary</h1>
      <VocabLibrary />
    </section>
  );
}
