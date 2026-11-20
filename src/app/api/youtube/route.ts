import { NextResponse } from "next/server"
import type {
  ChannelAnalytics,
  SentimentSummary,
  VideoAnalysis,
  VideoSummary,
} from "@/lib/youtube"
import { parseYouTubeVideoId } from "@/lib/youtube"

export const dynamic = "force-dynamic"

const API_BASE = "https://www.googleapis.com/youtube/v3"

interface YouTubeSnippet {
  title?: string
  description?: string
  channelTitle?: string
  channelId?: string
  publishedAt?: string
  customUrl?: string
  thumbnails?: {
    medium?: { url?: string }
    high?: { url?: string }
  }
}

interface YouTubeStatistics {
  viewCount?: string
  likeCount?: string
  commentCount?: string
  subscriberCount?: string
  videoCount?: string
  hiddenSubscriberCount?: boolean
}

interface YouTubeItem {
  id?: string | { videoId?: string }
  snippet?: YouTubeSnippet
  statistics?: YouTubeStatistics
}

interface YouTubeList<T> {
  items?: T[]
  error?: { message?: string }
}

interface YouTubeCommentThread {
  snippet?: {
    topLevelComment?: {
      snippet?: { textDisplay?: string; textOriginal?: string }
    }
  }
}

class YouTubeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "YouTubeRequestError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function youtubeRequest<T>(
  resource: string,
  params: Record<string, string>,
): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY?.trim()
  if (!key) throw new Error("Live YouTube analysis requires YOUTUBE_API_KEY.")

  const url = new URL(`${API_BASE}/${resource}`)
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value)
  }
  url.searchParams.set("key", key)

  const response = await fetch(url, { cache: "no-store" })
  const payload: unknown = await response.json()

  if (!response.ok) {
    const apiMessage =
      isRecord(payload) &&
      isRecord(payload.error) &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "The YouTube Data API request failed."
    throw new YouTubeRequestError(apiMessage, response.status)
  }

  return payload as T
}

function asCount(value: string | undefined): number {
  const count = Number(value ?? 0)
  return Number.isFinite(count) ? count : 0
}

function videoSummary(item: YouTubeItem): VideoSummary {
  const id =
    typeof item.id === "string"
      ? item.id
      : item.id?.videoId ?? ""
  const statistics = item.statistics ?? {}
  const views = asCount(statistics.viewCount)
  const likes = asCount(statistics.likeCount)
  const comments = asCount(statistics.commentCount)

  return {
    id,
    title: item.snippet?.title ?? "Untitled video",
    channelTitle: item.snippet?.channelTitle ?? "YouTube creator",
    publishedAt: item.snippet?.publishedAt ?? "",
    thumbnailUrl:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.medium?.url,
    views,
    likes,
    comments,
    engagementRate:
      views > 0 ? ((likes + comments) / views) * 100 : 0,
  }
}

function classifyComments(comments: string[]): SentimentSummary {
  const positiveWords =
    /\b(amazing|awesome|best|brilliant|enjoy|excellent|fun|good|great|love|perfect|thanks|thank you|wonderful)\b/i
  const negativeWords =
    /\b(awful|bad|boring|dislike|hate|poor|terrible|worse|worst)\b/i
  let positive = 0
  let negative = 0

  for (const comment of comments) {
    if (positiveWords.test(comment)) positive += 1
    else if (negativeWords.test(comment)) negative += 1
  }

  const total = comments.length
  if (total === 0) return { positive: 0, neutral: 0, negative: 0, total: 0 }

  const positivePercent = Math.round((positive / total) * 100)
  const negativePercent = Math.round((negative / total) * 100)
  return {
    positive: positivePercent,
    neutral: Math.max(0, 100 - positivePercent - negativePercent),
    negative: negativePercent,
    total,
  }
}

async function analyzeVideo(id: string): Promise<VideoAnalysis> {
  const videoResponse = await youtubeRequest<YouTubeList<YouTubeItem>>(
    "videos",
    { part: "snippet,statistics", id },
  )
  const item = videoResponse.items?.[0]
  if (!item) {
    throw new YouTubeRequestError(
      "No public video was found for that URL or video ID.",
      404,
    )
  }

  const summary = videoSummary(item)
  let comments: string[] = []
  let warning: string | null = null

  try {
    const commentResponse = await youtubeRequest<
      YouTubeList<YouTubeCommentThread>
    >("commentThreads", {
      part: "snippet",
      videoId: id,
      maxResults: "100",
      textFormat: "plainText",
      order: "relevance",
    })
    comments =
      commentResponse.items?.flatMap((entry) => {
        const snippet = entry.snippet?.topLevelComment?.snippet
        const text = snippet?.textOriginal ?? snippet?.textDisplay
        return text ? [text] : []
      }) ?? []
  } catch (error) {
    warning =
      error instanceof YouTubeRequestError
        ? `Video statistics loaded, but comments were unavailable (HTTP ${error.status}).`
        : "Video statistics loaded, but comments could not be retrieved."
  }

  const sentiment = classifyComments(comments)
  const recommendations =
    sentiment.positive >= 50
      ? [
          "Positive sentiment is leading; feature a strong viewer quote in your next community post.",
          "Add a specific comment prompt to turn strong audience interest into more conversation.",
        ]
      : [
          "Strengthen the first 15 seconds and add a specific comment prompt to lift interaction.",
          "Review recurring questions in the comments and answer them in your next video.",
        ]

  return {
    ...summary,
    sentiment,
    recommendations,
    warnings: warning ? [warning] : [],
    source: "youtube",
  }
}

async function compareVideos(ids: string[]): Promise<VideoSummary[]> {
  const response = await youtubeRequest<YouTubeList<YouTubeItem>>("videos", {
    part: "snippet,statistics",
    id: ids.join(","),
  })
  return (response.items ?? []).map(videoSummary)
}

async function searchVideos(query: string): Promise<VideoSummary[]> {
  const searchResponse = await youtubeRequest<YouTubeList<YouTubeItem>>(
    "search",
    {
      part: "snippet",
      type: "video",
      maxResults: "8",
      q: query,
    },
  )
  const ids = (searchResponse.items ?? [])
    .map((item) =>
      typeof item.id === "object" ? item.id.videoId : undefined,
    )
    .filter((id): id is string => Boolean(id))

  if (ids.length === 0) return []

  const details = await youtubeRequest<YouTubeList<YouTubeItem>>("videos", {
    part: "snippet,statistics",
    id: ids.join(","),
  })
  return (details.items ?? []).map(videoSummary)
}

async function getChannel(query: string): Promise<ChannelAnalytics> {
  const channelId = /^[A-Za-z0-9_-]{24}$/.test(query) ? query : null
  const handle = query.replace(/^@/, "").replace(/\/$/, "")
  const response = await youtubeRequest<YouTubeList<YouTubeItem>>(
    "channels",
    channelId
      ? { part: "snippet,statistics", id: channelId }
      : { part: "snippet,statistics", forHandle: handle },
  )
  const item = response.items?.[0]
  if (!item) {
    throw new YouTubeRequestError("No public channel was found.", 404)
  }

  const statistics = item.statistics ?? {}
  return {
    id: typeof item.id === "string" ? item.id : "",
    title: item.snippet?.title ?? "YouTube channel",
    handle: item.snippet?.customUrl ?? handle,
    description: item.snippet?.description ?? "",
    thumbnailUrl:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.medium?.url,
    subscribers: statistics.hiddenSubscriberCount
      ? null
      : asCount(statistics.subscriberCount),
    views: asCount(statistics.viewCount),
    videos: asCount(statistics.videoCount),
  }
}

export async function GET() {
  return NextResponse.json({
    liveConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
  })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  if (!isRecord(body) || typeof body.action !== "string") {
    return NextResponse.json({ error: "Choose a valid YouTube action." }, { status: 400 })
  }

  if (!process.env.YOUTUBE_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "Live YouTube data is not configured. Add YOUTUBE_API_KEY to the server environment, or use the sample video demo.",
      },
      { status: 503 },
    )
  }

  try {
    if (body.action === "analyze") {
      const id =
        typeof body.video === "string" ? parseYouTubeVideoId(body.video) : null
      if (!id) {
        return NextResponse.json(
          { error: "Enter a valid YouTube watch, Shorts, or youtu.be URL." },
          { status: 400 },
        )
      }
      return NextResponse.json({ analysis: await analyzeVideo(id) })
    }

    if (body.action === "compare") {
      const ids = Array.isArray(body.videos)
        ? body.videos
            .filter((video): video is string => typeof video === "string")
            .map(parseYouTubeVideoId)
            .filter((id): id is string => Boolean(id))
        : []
      if (ids.length < 2 || ids.length > 4) {
        return NextResponse.json(
          { error: "Compare between two and four valid YouTube videos." },
          { status: 400 },
        )
      }
      return NextResponse.json({ videos: await compareVideos(ids) })
    }

    if (body.action === "search") {
      const query = typeof body.query === "string" ? body.query.trim() : ""
      if (!query) {
        return NextResponse.json(
          { error: "Enter a search keyword first." },
          { status: 400 },
        )
      }
      return NextResponse.json({ videos: await searchVideos(query) })
    }

    if (body.action === "channel") {
      const query = typeof body.query === "string" ? body.query.trim() : ""
      if (!query) {
        return NextResponse.json(
          { error: "Enter a channel handle or channel ID first." },
          { status: 400 },
        )
      }
      return NextResponse.json({ channel: await getChannel(query) })
    }

    return NextResponse.json(
      { error: "Choose a valid YouTube action." },
      { status: 400 },
    )
  } catch (error) {
    const status =
      error instanceof YouTubeRequestError ? error.status : 502
    const message =
      error instanceof YouTubeRequestError
        ? `YouTube API request failed (HTTP ${error.status}): ${error.message}`
        : "The YouTube API could not be reached. Check the server logs and try again."
    return NextResponse.json({ error: message }, { status })
  }
}
