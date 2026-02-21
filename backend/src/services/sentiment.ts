import type { ConversationSentiment } from "../types/models";

const frustratedPatterns = [
  /\bfuck\b/i,
  /\bbitch\b/i,
  /\bdamn\b/i,
  /\bstupid\b/i,
  /\bpathetic\b/i,
  /\bunacceptable\b/i,
  /\bridiculous\b/i,
  /\babsurd\b/i,
  /!{2,}/, // multiple exclamation marks
  /\b[A-Z]{4,}\b/ // shouting (word in all caps)
];

const negativePatterns = [
  /\bangry\b/i,
  /\bfrustrated\b/i,
  /\bannoyed\b/i,
  /\bdisappointed\b/i,
  /\bterrible\b/i,
  /\bawful\b/i,
  /\bhorrible\b/i,
  /\bhate\b/i,
  /\bworst\b/i,
  /\bbroken\b/i,
  /\bnot working\b/i,
  /\bdoesn't work\b/i,
  /\bfed up\b/i
];

const positivePatterns = [
  /\bthank you\b/i,
  /\bthanks\b/i,
  /\bgreat\b/i,
  /\bperfect\b/i,
  /\bhelpful\b/i,
  /\bappreciate\b/i,
  /\bexcellent\b/i,
  /\bresolved\b/i,
  /\bfixed\b/i
];

/**
 * Derive conversation sentiment from the latest client message (keyword-based).
 * Used to update conversation.sentiment so the dashboard shows non-neutral when appropriate.
 */
export function sentimentFromContent(content: string): ConversationSentiment {
  const text = content.trim();
  if (!text) return "neutral";

  if (frustratedPatterns.some((p) => p.test(text))) {
    return "frustrated";
  }
  if (negativePatterns.some((p) => p.test(text))) {
    return "negative";
  }
  if (positivePatterns.some((p) => p.test(text))) {
    return "positive";
  }

  return "neutral";
}
