/**
 * Builds a plausible "LLM reply" from the labels of a live anonymize run, so
 * the anonymize -> reply -> restore round-trip is clickable end to end without
 * leaving the page. Generating from the actual mapping guarantees every label
 * in the reply resolves on restore (no unresolved-label warning).
 */

import { LABELS, type Language } from "@prompt-anonymizer/core";

/** Entity types mentioned first in the simulated reply, most name-like first. */
const ENTITY_PRIORITY = ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER"];

const MAX_LABELS = 4;

/**
 * Entity type for a placeholder such as `<人名_1>` or `<Name_1_First_Name>`,
 * resolved against the label words of `lang`. Null for unrecognized shapes —
 * still usable in a reply, just not prioritized.
 */
export function classifyLabel(label: string, lang: Language): string | null {
  const match = /^<(.+)_\d{1,6}(?:_[^<>\s]{1,32})?>$/u.exec(label);
  if (!match) return null;
  const word = match[1];
  for (const [entityType, labelWord] of Object.entries(LABELS[lang])) {
    if (labelWord === word) return entityType;
  }
  return null;
}

function joinLabels(labels: string[], locale: Language): string {
  if (typeof Intl !== "undefined" && typeof Intl.ListFormat === "function") {
    try {
      return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(labels);
    } catch {
      // Fall through to the plain join below.
    }
  }
  return labels.join(", ");
}

export interface SimulatedReplyOptions {
  /** Language whose label words classify the mapping's placeholders. */
  labelLanguage: Language;
  /** UI locale: joins the label list and matches the template's language. */
  uiLanguage: Language;
  /** Reply sentence with a single `{labels}` slot. */
  template: string;
}

/**
 * Render `template` with up to four labels from `mapping`, preferring person
 * labels, then emails, then phones (first-appearance order within each group).
 * Every emitted label is a key of `mapping`, so restore resolves them all.
 */
export function buildSimulatedReply(
  mapping: Record<string, string>,
  options: SimulatedReplyOptions,
): string {
  const labels = Object.keys(mapping);
  const byPriority = (label: string): number => {
    const entityType = classifyLabel(label, options.labelLanguage);
    const rank = entityType === null ? -1 : ENTITY_PRIORITY.indexOf(entityType);
    return rank === -1 ? ENTITY_PRIORITY.length : rank;
  };
  // Stable sort keeps first-appearance order inside each priority group.
  const picked = [...labels].sort((a, b) => byPriority(a) - byPriority(b)).slice(0, MAX_LABELS);
  return options.template.replace("{labels}", joinLabels(picked, options.uiLanguage));
}
