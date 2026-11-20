export interface SentimentSummary {
  positive: number
  neutral: number
  negative: number
  total: number
}

export interface VideoSummary {
  id: string
  title: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl?: string
  views: number | null
  likes: number | null
  comments: number | null
  engagementRate: number | null
}

export interface VideoAnalysis extends VideoSummary {
  sentiment: SentimentSummary | null
  commentsAnalyzed: number
  insightSummary: string
  themes: string[]
  recommendations: string[]
  warnings: string[]
  insightSource: "openai" | "rules" | "demo"
  source: "demo" | "youtube"
}

export interface ChannelAnalytics {
  id: string
  title: string
  handle: string
  description: string
  thumbnailUrl?: string
  subscribers: number | null
  views: number | null
  videos: number | null
  recentVideos: VideoSummary[]
  recentVideosWarning?: string
}

export interface AnalysisHistoryEntry {
  id: string
  title: string
  views: number | null
  engagementRate: number | null
  positiveSentiment: number | null
  analyzedAt: string
}

export const demoAnalysis: VideoAnalysis = {
  id: "dQw4w9WgXcQ",
  title: "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
  channelTitle: "Rick Astley",
  publishedAt: "2009-10-25T00:00:00.000Z",
  views: 1_800_000_000,
  likes: 19_500_000,
  comments: 2_500_000,
  engagementRate: 1.19,
  sentiment: { positive: 7, neutral: 92, negative: 1, total: 100 },
  commentsAnalyzed: 100,
  insightSummary:
    "This is a clearly labeled sample snapshot. Its figures and recommendations are illustrative, not live YouTube data.",
  themes: ["Sample audience theme"],
  recommendations: [
    "Strengthen the first 15 seconds and add a specific comment prompt to lift interaction.",
    "Positive sentiment is leading; feature a strong viewer quote in your next community post.",
  ],
  warnings: [],
  insightSource: "demo",
  source: "demo",
}

export function calculateEngagementRate(
  views: number | null,
  likes: number | null,
  comments: number | null,
): number | null {
  if (
    views === null ||
    likes === null ||
    comments === null ||
    views <= 0 ||
    !Number.isFinite(views) ||
    !Number.isFinite(likes) ||
    !Number.isFinite(comments)
  ) {
    return null
  }
  return ((likes + comments) / views) * 100
}

export function parseYouTubeVideoId(value: string): string | null {
  const input = value.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input

  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`)
    const host = url.hostname.replace(/^www\./, "").toLowerCase()
    let id: string | null = null

    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] ?? null
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      id =
        url.searchParams.get("v") ??
        url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] ??
        null
    }

    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export function formatCompactNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export function isHistoryEntry(value: unknown): value is AnalysisHistoryEntry {
  if (typeof value !== "object" || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    (typeof entry.views === "number" || entry.views === null) &&
    (typeof entry.engagementRate === "number" || entry.engagementRate === null) &&
    (typeof entry.positiveSentiment === "number" ||
      entry.positiveSentiment === null) &&
    typeof entry.analyzedAt === "string"
  )
}
