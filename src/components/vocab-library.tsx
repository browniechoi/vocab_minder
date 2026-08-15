"use client";

import { useState } from "react";
import { useAppState } from "@/components/app-state-provider";
import { DefinitionLabelList } from "@/components/definition-label-list";
import { PronunciationList } from "@/components/pronunciation-list";
import type { VocabItem } from "@/lib/app-types";
import { parseDefinitionLabelText } from "@/lib/definition-labels";
import { formatDueLabel, formatReviewInterval } from "@/lib/review";

type FilterMode = "all" | "active" | "archived";

export function VocabLibrary() {
  const {
    activeItems,
    archiveItem,
    archivedItems,
    deleteItem,
    restoreItem,
    updateVocabBack,
  } = useAppState();
  const [editAcceptedAnswers, setEditAcceptedAnswers] = useState("");
  const [editAnswerLemma, setEditAnswerLemma] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editClozeAnswer, setEditClozeAnswer] = useState("");
  const [editClozeSentence, setEditClozeSentence] = useState("");
  const [editCommonCollocations, setEditCommonCollocations] = useState("");
  const [editDefinition, setEditDefinition] = useState("");
  const [editDefinitionLabels, setEditDefinitionLabels] = useState("");
  const [editExampleSentence, setEditExampleSentence] = useState("");
  const [editGrammaticalRole, setEditGrammaticalRole] = useState("");
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [editPartOfSpeech, setEditPartOfSpeech] = useState("");
  const [editTerm, setEditTerm] = useState("");
  const [editUsageNote, setEditUsageNote] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [query, setQuery] = useState("");
  const [restoreMessage, setRestoreMessage] = useState("");

  function startEditing(item: VocabItem) {
    setEditMessage(null);
    setEditingItemId(item.id);
    setEditAcceptedAnswers(item.acceptedAnswers.join(", "));
    setEditAnswerLemma(item.answerLemma);
    setEditClozeAnswer(item.clozeAnswer);
    setEditClozeSentence(item.clozeSentence);
    setEditCommonCollocations(item.commonCollocations.join(", "));
    setEditDefinition(item.definition);
    setEditDefinitionLabels(item.definitionLabels?.join(", ") ?? "");
    setEditExampleSentence(item.exampleSentence);
    setEditGrammaticalRole(item.grammaticalRole);
    setEditPartOfSpeech(item.partOfSpeech);
    setEditTerm(item.canonicalTerm);
    setEditUsageNote(item.usageNote);
  }

  const items = [...activeItems, ...archivedItems]
    .filter((item) => {
      if (filter === "active") {
        return item.status === "active";
      }
      if (filter === "archived") {
        return item.status === "archived";
      }
      return true;
    })
    .filter((item) => {
      const needle = query.trim().toLowerCase();
      if (!needle) {
        return true;
      }

      return (
        item.canonicalTerm.toLowerCase().includes(needle) ||
        item.definition.toLowerCase().includes(needle)
      );
    });

  return (
    <div className="space-y-6">
      <div className="soft-panel rounded-[32px] px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
              Filters
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["all", "active", "archived"] as FilterMode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    filter === value
                      ? "border-[color:var(--color-foreground)] bg-[color:var(--color-foreground)] text-white"
                      : "border-[color:var(--color-border)] bg-white text-[color:var(--color-foreground)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <label className="w-full lg:max-w-sm">
            <span className="sr-only">Search vocabulary</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by word or definition"
              className="h-12 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none transition-colors placeholder:text-[color:var(--color-muted)] focus:border-[color:var(--color-accent)]"
            />
          </label>
        </div>

        {restoreMessage ? (
          <p className="mt-4 rounded-[18px] bg-[rgba(17,32,57,0.08)] px-4 py-3 text-sm text-[color:var(--color-foreground)]">
            {restoreMessage}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const isEditing = editingItemId === item.id;

          return (
            <article
              key={item.id}
              className="soft-panel rounded-[30px] px-6 py-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl flex-1">
                  {isEditing ? (
                    <form
                      className="space-y-4"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        setEditMessage(null);
                        setIsSavingEdit(true);
                        try {
                          const result = await updateVocabBack(item.id, {
                            acceptedAnswers: editAcceptedAnswers
                              .split(",")
                              .map((answer) => answer.trim())
                              .filter(Boolean),
                            answerLemma: editAnswerLemma,
                            canonicalTerm:
                              editTerm.trim() === item.canonicalTerm
                                ? undefined
                                : editTerm,
                            clozeAnswer: editClozeAnswer,
                            clozeSentence: editClozeSentence,
                            commonCollocations: editCommonCollocations
                              .split(",")
                              .map((collocation) => collocation.trim())
                              .filter(Boolean),
                            definition: editDefinition,
                            definitionLabels:
                              parseDefinitionLabelText(editDefinitionLabels),
                            exampleSentence: editExampleSentence,
                            grammaticalRole: editGrammaticalRole,
                            partOfSpeech: editPartOfSpeech,
                            usageNote: editUsageNote,
                          });

                          if (!result.success) {
                            setEditMessage(
                              result.message ?? "Vocabulary update failed.",
                            );
                            return;
                          }

                          setEditingItemId(null);
                        } finally {
                          setIsSavingEdit(false);
                        }
                      }}
                    >
                      <div className="grid gap-4 md:grid-cols-[1fr_0.45fr]">
                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                            Learning target
                          </span>
                          <input
                            required
                            value={editTerm}
                            onChange={(event) => setEditTerm(event.target.value)}
                            className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                            Part of speech
                          </span>
                          <input
                            value={editPartOfSpeech}
                            onChange={(event) =>
                              setEditPartOfSpeech(event.target.value)
                            }
                            className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                          />
                        </label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                            Family lemma
                          </span>
                          <input
                            required
                            value={editAnswerLemma}
                            onChange={(event) =>
                              setEditAnswerLemma(event.target.value)
                            }
                            className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                            Cloze answer
                          </span>
                          <input
                            required
                            value={editClozeAnswer}
                            onChange={(event) =>
                              setEditClozeAnswer(event.target.value)
                            }
                            className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                          Accepted target answers
                        </span>
                        <input
                          required
                          value={editAcceptedAnswers}
                          onChange={(event) =>
                            setEditAcceptedAnswers(event.target.value)
                          }
                          placeholder="color, colour"
                          className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                          Grammatical role
                        </span>
                        <input
                          value={editGrammaticalRole}
                          onChange={(event) =>
                            setEditGrammaticalRole(event.target.value)
                          }
                          placeholder="adjective derived from a past participle"
                          className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                          Labels
                        </span>
                        <input
                          value={editDefinitionLabels}
                          onChange={(event) =>
                            setEditDefinitionLabels(event.target.value)
                          }
                          placeholder="formal, literary"
                          className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                          Usage note
                        </span>
                        <textarea
                          value={editUsageNote}
                          onChange={(event) => setEditUsageNote(event.target.value)}
                          className="mt-2 min-h-20 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm leading-7 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                          Common collocations
                        </span>
                        <input
                          value={editCommonCollocations}
                          onChange={(event) =>
                            setEditCommonCollocations(event.target.value)
                          }
                          placeholder="subsidized housing, subsidized loans"
                          className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                          Definition
                        </span>
                        <textarea
                          required
                          value={editDefinition}
                          onChange={(event) =>
                            setEditDefinition(event.target.value)
                          }
                          className="mt-2 min-h-24 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm leading-7 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                          Example
                        </span>
                        <textarea
                          value={editExampleSentence}
                          onChange={(event) =>
                            setEditExampleSentence(event.target.value)
                          }
                          className="mt-2 min-h-24 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm italic leading-7 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                          Cloze
                        </span>
                        <textarea
                          value={editClozeSentence}
                          onChange={(event) =>
                            setEditClozeSentence(event.target.value)
                          }
                          placeholder="Use _____ for the hidden word."
                          className="mt-2 min-h-24 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm italic leading-7 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                        />
                      </label>
                      {editMessage ? (
                        <p className="rounded-[18px] border border-[color:var(--color-danger)] bg-[rgba(187,79,59,0.08)] px-4 py-3 text-sm text-[color:var(--color-foreground)]">
                          {editMessage}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          disabled={isSavingEdit}
                          className="rounded-full bg-[color:var(--color-foreground)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingEdit ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          disabled={isSavingEdit}
                          onClick={() => {
                            setEditMessage(null);
                            setEditingItemId(null);
                          }}
                          className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-semibold text-[color:var(--color-foreground)]">
                          {item.canonicalTerm}
                        </h2>
                        <span className="rounded-full bg-[rgba(17,32,57,0.08)] px-3 py-1 text-xs font-medium text-[color:var(--color-foreground)]">
                          {item.status}
                        </span>
                        <span className="rounded-full bg-[rgba(221,107,63,0.12)] px-3 py-1 text-xs font-medium text-[color:var(--color-accent)]">
                          {item.grammaticalRole || item.partOfSpeech}
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-7 text-[color:var(--color-foreground)]">
                        {item.definition}
                      </p>
                      {item.answerLemma !== item.canonicalTerm ? (
                        <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                          Related lemma: {item.answerLemma}
                        </p>
                      ) : null}
                      <DefinitionLabelList labels={item.definitionLabels} />
                      <PronunciationList
                        pronunciations={item.pronunciations}
                        compact
                      />
                      <p className="mt-3 text-sm italic leading-7 text-[color:var(--color-muted)]">
                        “{item.exampleSentence}”
                      </p>
                      {item.usageNote ? (
                        <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                          {item.usageNote}
                        </p>
                      ) : null}
                      {item.commonCollocations.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.commonCollocations.map((collocation) => (
                            <span
                              key={collocation}
                              className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-xs text-[color:var(--color-muted)]"
                            >
                              {collocation}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {item.clozeSentence ? (
                        <p className="mt-2 text-sm italic leading-7 text-[color:var(--color-muted)]">
                          Cloze: “{item.clozeSentence}”
                        </p>
                      ) : null}
                      <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                        <span>{item.searchCount} searches</span>
                        <span>{formatDueLabel(item.reviewState.dueAt)}</span>
                        <span>
                          {formatReviewInterval(item.reviewState.intervalDays)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => startEditing(item)}
                      className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
                    >
                      Edit
                    </button>
                  ) : null}
                  {item.status === "active" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => archiveItem(item.id)}
                        className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-warning)] hover:text-[color:var(--color-warning)]"
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const shouldDelete = window.confirm(
                            `Delete "${item.canonicalTerm}" permanently from your vocab library?`,
                          );
                          if (shouldDelete) {
                            void deleteItem(item.id);
                            setRestoreMessage(
                              `"${item.canonicalTerm}" was permanently deleted.`,
                            );
                          }
                        }}
                        className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          const response = await restoreItem(item.id);
                          setRestoreMessage(response.message);
                        }}
                        className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-accent-secondary)] hover:text-[color:var(--color-accent-secondary)]"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const shouldDelete = window.confirm(
                            `Delete "${item.canonicalTerm}" permanently from your vocab library?`,
                          );
                          if (shouldDelete) {
                            void deleteItem(item.id);
                            setRestoreMessage(
                              `"${item.canonicalTerm}" was permanently deleted.`,
                            );
                          }
                        }}
                        className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {items.length === 0 ? (
          <div className="soft-panel rounded-[30px] px-6 py-8 text-sm leading-7 text-[color:var(--color-muted)]">
            No vocabulary items match the current filter.
          </div>
        ) : null}
      </div>
    </div>
  );
}
