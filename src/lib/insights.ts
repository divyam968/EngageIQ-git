import type { SentimentSummary, VideoSummary } from "@/lib/youtube"

export interface SentimentCounts {
  positive: number
  neutral: number
  negative: number
}

export interface AudienceInsightResult {
  sentiment: SentimentSummary | null
  summary: string
  themes: string[]
  recommendations: string[]
}

const positiveTerms = [
  "amazing",
  "awesome",
  "best",
  "brilliant",
  "enjoy",
  "excellent",
  "fun",
  "good",
  "great",
  "helpful",
  "love",
  "perfect",
  "thank",
  "wonderful",
]

const negativeTerms = [
  "annoying",
  "awful",
  "bad",
  "boring",
  "confusing",
  "disappointing",
  "dislike",
  "hate",
  "poor",
  "terrible",
  "worse",
  "worst",
]

const stopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "been",
  "before",
  "being",
  "could",
  "from",
  "have",
  "just",
  "like",
  "more",
  "much",
  "only",
  "really",
  "should",
  "some",
  "than",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "very",
  "video",
  "watch",
  "what",
  "when",
  "where",
  "which",
  "while",
  "will",
  "with",
  "would",
  "youtube",
  "your",
])

function termCount(text: string, term: string): number {
  const expression = new RegExp(`\\b${term}\\b`, "gi")
  return [...text.matchAll(expression)].length
}

function classifyComment(comment: string): keyof SentimentCounts {
  const text = comment.toLowerCase()
  let positive = positiveTerms.reduce(
    (total, term) => total + termCount(text, term),
    0,
  )
  let negative = negativeTerms.reduce(
    (total, term) => total + termCount(text, term),
    0,
  )

  const negatedPositive = /\b(?:not|never|no)\s+(?:very\s+|really\s+)?(?:good|great|helpful|perfect|amazing|awesome)\b/gi
  const negatedNegative = /\b(?:not|never|no)\s+(?:very\s+|really\s+)?(?:bad|boring|terrible|awful)\b/gi
  const positiveNegations = [...text.matchAll(negatedPositive)].length
  const negativeNegations = [...text.matchAll(negatedNegative)].length
  positive = Math.max(0, positive - positiveNegations)
  negative = Math.max(0, negative - negativeNegations)
  negative += positiveNegations
  positive += negativeNegations

  if (positive > negative) return "positive"
  if (negative > positive) return "negative"
  return "neutral"
}

export function percentagesFromCounts(
  counts: SentimentCounts,
  total: number,
): SentimentSummary | null {
  if (total <= 0) return null
  const values = [counts.positive, counts.neutral, counts.negative]
  if (
    values.some((value) => !Number.isInteger(value) || value < 0) ||
    values.reduce((sum, value) => sum + value, 0) !== total
  ) {
    return null
  }

  const exact = values.map((value) => (value / total) * 100)
  const rounded = exact.map(Math.floor)
  let remaining = 100 - rounded.reduce((sum, value) => sum + value, 0)
  const remainderOrder = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction)
  for (let index = 0; index < remaining; index += 1) {
    rounded[remainderOrder[index].index] += 1
  }

  return {
    positive: rounded[0],
    neutral: rounded[1],
    negative: rounded[2],
    total,
  }
}

function recurringTerms(comments: string[]): string[] {
  const counts = new Map<string, number>()
  for (const comment of comments) {
    const terms = comment.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []
    for (const term of new Set(terms)) {
      if (!stopWords.has(term) && !/^\d+$/.test(term)) {
        counts.set(term, (counts.get(term) ?? 0) + 1)
      }
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([term]) => term)
}

export function buildRuleBasedInsights(
  video: Pick<
    VideoSummary,
    "views" | "likes" | "comments" | "engagementRate"
  >,
  comments: string[],
): AudienceInsightResult {
  if (comments.length === 0) {
    return {
      sentiment: null,
      summary:
        "No public comments were available to analyze. Public performance metrics are kept separate from audience sentiment.",
      themes: [],
      recommendations: [
        "Try a public video with comments enabled to analyze audience sentiment.",
        ...(video.engagementRate === null
          ? ["Some public engagement metrics are unavailable, so an engagement rate cannot be calculated."]
          : []),
      ],
    }
  }

  const counts: SentimentCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
  }
  for (const comment of comments) {
    counts[classifyComment(comment)] += 1
  }

  const sentiment = percentagesFromCounts(counts, comments.length)
  const themes = recurringTerms(comments)
  const summary = `Transparent keyword-based classification of ${comments.length} sampled public comments: ${sentiment?.positive ?? 0}% positive, ${sentiment?.neutral ?? 0}% neutral, and ${sentiment?.negative ?? 0}% negative.`
  const recommendations: string[] = []

  if ((sentiment?.negative ?? 0) >= 20) {
    recommendations.push(
      "Review representative negative comments for repeated friction before changing the content or format.",
    )
  } else if ((sentiment?.positive ?? 0) >= 60) {
    recommendations.push(
      "Use the recurring positive audience themes as hypotheses for a follow-up video, then compare its live results.",
    )
  } else {
    recommendations.push(
      "Ask one specific question in the next video to encourage comments that reveal what viewers want.",
    )
  }

  if (themes.length > 0) {
    recommendations.push(
      `Review the repeated audience terms (${themes.slice(0, 3).join(", ")}) in context before using them in titles or topics.`,
    )
  } else {
    recommendations.push(
      "The sampled comments did not contain a repeated keyword theme; collect a larger sample before drawing topic conclusions.",
    )
  }

  if (video.engagementRate === null) {
    recommendations.push(
      "The engagement rate is unavailable because at least one public metric is hidden or missing.",
    )
  }

  return { sentiment, summary, themes, recommendations }
}
