export const CLOZE_BLANK = "_____";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripHeadwordSuffix(term: string) {
  return term.trim().replace(/:\d+$/u, "");
}

function getTermVariants(term: string) {
  const baseTerm = stripHeadwordSuffix(term);
  if (!baseTerm) {
    return [];
  }

  const variants = new Set([
    baseTerm,
    `${baseTerm}s`,
    `${baseTerm}es`,
    `${baseTerm}ed`,
    `${baseTerm}ing`,
  ]);

  if (baseTerm.endsWith("e")) {
    variants.add(`${baseTerm}d`);
    variants.add(`${baseTerm.slice(0, -1)}ing`);
  }

  if (/[bcdfghjklmnpqrstvwxyz]y$/iu.test(baseTerm)) {
    variants.add(`${baseTerm.slice(0, -1)}ies`);
    variants.add(`${baseTerm.slice(0, -1)}ied`);
  }

  return [...variants].filter(Boolean).sort((a, b) => b.length - a.length);
}

function getTermPattern(term: string) {
  const variants = getTermVariants(term);
  if (variants.length === 0) {
    return null;
  }

  const alternatives = variants.map((variant) =>
    escapeRegExp(variant).replace(/\s+/g, "\\s+"),
  );

  return new RegExp(`\\b(?:${alternatives.join("|")})\\b`, "giu");
}

export function containsClozeAnswer(value: string, term: string) {
  const termPattern = getTermPattern(term);
  return termPattern ? termPattern.test(value) : false;
}

export function isSafeClozeSentence(value: string, term: string) {
  return (
    value.split(CLOZE_BLANK).length === 2 && !containsClozeAnswer(value, term)
  );
}

export function buildClozeFromAnswer(
  exampleSentence: string,
  clozeAnswer: string,
) {
  const answer = clozeAnswer.trim();
  if (!answer) {
    return null;
  }

  const answerPattern = escapeRegExp(answer).replace(/\s+/g, "\\s+");
  const pattern = new RegExp(
    `(^|[^a-z0-9'])(${answerPattern})(?=$|[^a-z0-9'])`,
    "iu",
  );
  const match = pattern.exec(exampleSentence);

  if (!match) {
    return null;
  }

  const answerStart = match.index + match[1].length;
  return `${exampleSentence.slice(0, answerStart)}${CLOZE_BLANK}${exampleSentence.slice(
    answerStart + match[2].length,
  )}`;
}

export function buildClozeSentence({
  clozeSentence,
  exampleSentence,
  term,
}: {
  clozeSentence?: string;
  exampleSentence: string;
  term: string;
}) {
  if (clozeSentence && isSafeClozeSentence(clozeSentence, term)) {
    return clozeSentence;
  }

  if (isSafeClozeSentence(exampleSentence, term)) {
    return exampleSentence;
  }

  const termPattern = getTermPattern(term);
  if (termPattern) {
    const maskedSentence = exampleSentence.replace(termPattern, CLOZE_BLANK);
    if (maskedSentence !== exampleSentence) {
      return maskedSentence;
    }
  }

  return `Use this word in context: ${CLOZE_BLANK}.`;
}
