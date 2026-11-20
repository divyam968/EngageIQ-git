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
  views: number
  likes: number
  comments: number
  engagementRate: number
}

export interface VideoAnalysis extends VideoSummary {
  sentiment: SentimentSummary
  recommendations: string[]
  warnings: string[]
  source: "demo" | "youtube"
}

export interface ChannelAnalytics {
  id: string
  title: string
  handle: string
  description: string
  thumbnailUrl?: string
  subscribers: number | null
  views: number
  videos: number
}

export interface AnalysisHistoryEntry {
  id: string
  title: string
  views: number
  engagementRate: number
  positiveSentiment: number
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
  recommendations: [
    "Strengthen the first 15 seconds and add a specific comment prompt to lift interaction.",
    "Positive sentiment is leading; feature a strong viewer quote in your next community post.",
  ],
  warnings: [],
  source: "demo",
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

export function formatCompactNumber(value: number): string {
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
    typeof entry.views === "number" &&
    typeof entry.engagementRate === "number" &&
    typeof entry.positiveSentiment === "number" &&
    typeof entry.analyzedAt === "string"
  )
}
