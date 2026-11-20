import { NextResponse } from "next/server"
import type {
  ChannelAnalytics,
  VideoAnalysis,
  VideoSummary,
} from "@/lib/youtube"
import {
  calculateEngagementRate,
  parseYouTubeVideoId,
} from "@/lib/youtube"
import { buildRuleBasedInsights } from "@/lib/insights"
import {
  configuredOpenAIModel,
  generateOpenAIInsights,
  isOpenAIConfigured,
  OpenAIInsightError,
} from "@/lib/openai-insights"
import { checkRequestRateLimit } from "@/lib/rate-limit"

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
  contentDetails?: {
    relatedPlaylists?: { uploads?: string }
  }
}

interface YouTubeList<T> {
  items?: T[]
  nextPageToken?: string
  error?: { message?: string }
}

interface YouTubePlaylistItem {
  contentDetails?: { videoId?: string }
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

  let response: Response
  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new YouTubeRequestError(
      "The YouTube Data API request timed out or could not connect.",
      502,
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new YouTubeRequestError(
      "The YouTube Data API returned an unreadable response.",
      502,
    )
  }

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

function asCount(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null
  const count = Number(value)
  return Number.isSafeInteger(count) && count >= 0 ? count : null
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
    engagementRate: calculateEngagementRate(views, likes, comments),
  }
}

async function collectComments(
  videoId: string,
): Promise<{ comments: string[]; warning?: string }> {
  const comments: string[] = []
  let pageToken: string | undefined

  try {
    for (let page = 0; page < 2; page += 1) {
      const params: Record<string, string> = {
        part: "snippet",
        videoId,
        maxResults: "100",
        textFormat: "plainText",
        order: "relevance",
      }
      if (pageToken) params.pageToken = pageToken

      const response = await youtubeRequest<
        YouTubeList<YouTubeCommentThread>
      >("commentThreads", params)
      comments.push(
        ...(response.items?.flatMap((entry) => {
          const snippet = entry.snippet?.topLevelComment?.snippet
          const text = snippet?.textOriginal ?? snippet?.textDisplay
          return text ? [text.slice(0, 1000)] : []
        }) ?? []),
      )
      pageToken = response.nextPageToken
      if (!pageToken || comments.length >= 200) break
    }
    return { comments: comments.slice(0, 200) }
  } catch (error) {
    const warning =
      error instanceof YouTubeRequestError
        ? `Some public comments could not be collected (HTTP ${error.status}: ${error.message.slice(0, 160)}); sentiment uses the comments collected so far.`
        : "Some public comments could not be collected; sentiment uses the comments collected so far."
    return { comments, warning }
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
  const { comments, warning: commentsWarning } = await collectComments(id)
  const ruleInsights = buildRuleBasedInsights(summary, comments)
  const warnings = commentsWarning ? [commentsWarning] : []
  let insight = ruleInsights
  let insightSource: VideoAnalysis["insightSource"] = "rules"

  if (isOpenAIConfigured() && comments.length > 0) {
    try {
      const generated = await generateOpenAIInsights(
        summary,
        comments.slice(0, 100),
      )
      if (generated) {
        insight = generated
        insightSource = "openai"
      }
    } catch (error) {
      warnings.push(
        error instanceof OpenAIInsightError
          ? `${error.message} Transparent rule-based insights are shown instead.`
          : "OpenAI analysis failed. Transparent rule-based insights are shown instead.",
      )
    }
  } else if (!isOpenAIConfigured()) {
    warnings.push(
      "OpenAI is not configured; sentiment and recommendations use transparent keyword-based rules.",
    )
  }

  return {
    ...summary,
    sentiment: insight.sentiment,
    commentsAnalyzed: insight.sentiment?.total ?? 0,
    insightSummary: insight.summary,
    themes: insight.themes,
    recommendations: insight.recommendations,
    warnings,
    insightSource,
    source: "youtube",
  }
}

async function compareVideos(ids: string[]): Promise<VideoSummary[]> {
  return getVideoSummaries(ids)
}

async function getVideoSummaries(ids: string[]): Promise<VideoSummary[]> {
  if (ids.length === 0) return []
  const response = await youtubeRequest<YouTubeList<YouTubeItem>>("videos", {
    part: "snippet,statistics",
    id: ids.join(","),
  })
  const byId = new Map(
    (response.items ?? []).map((item) => {
      const summary = videoSummary(item)
      return [summary.id, summary] as const
    }),
  )
  return ids.flatMap((id) => {
    const video = byId.get(id)
    return video ? [video] : []
  })
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
  const ids = [
    ...new Set(
      (searchResponse.items ?? [])
        .map((item) =>
          typeof item.id === "object" ? item.id.videoId : undefined,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  return getVideoSummaries(ids)
}

async function getTrendingVideos(
  regionCode: string,
  categoryId: string | null,
): Promise<VideoSummary[]> {
  const params: Record<string, string> = {
    part: "snippet,statistics",
    chart: "mostPopular",
    regionCode,
    maxResults: "10",
  }
  if (categoryId) params.videoCategoryId = categoryId
  const response = await youtubeRequest<YouTubeList<YouTubeItem>>(
    "videos",
    params,
  )
  return (response.items ?? []).map(videoSummary)
}

async function getChannel(query: string): Promise<ChannelAnalytics> {
  const channelId = /^UC[A-Za-z0-9_-]{22}$/.test(query) ? query : null
  const handle = query.replace(/^@/, "").replace(/\/$/, "")
  const response = await youtubeRequest<YouTubeList<YouTubeItem>>(
    "channels",
    channelId
      ? { part: "snippet,statistics,contentDetails", id: channelId }
      : { part: "snippet,statistics,contentDetails", forHandle: handle },
  )
  const item = response.items?.[0]
  if (!item) {
    throw new YouTubeRequestError("No public channel was found.", 404)
  }

  const statistics = item.statistics ?? {}
  const channelIdValue = typeof item.id === "string" ? item.id : ""
  const uploadsPlaylistId =
    item.contentDetails?.relatedPlaylists?.uploads
  let recentVideos: VideoSummary[] = []
  let recentVideosWarning: string | undefined
  if (uploadsPlaylistId) {
    try {
      const uploadResponse = await youtubeRequest<
        YouTubeList<YouTubePlaylistItem>
      >("playlistItems", {
        part: "contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: "8",
      })
      const ids = (uploadResponse.items ?? [])
        .map((playlistItem) => playlistItem.contentDetails?.videoId)
        .filter((videoId): videoId is string => Boolean(videoId))
      recentVideos = await getVideoSummaries(ids)
    } catch (error) {
      recentVideosWarning =
        error instanceof YouTubeRequestError
          ? `Channel statistics loaded, but recent videos were unavailable (HTTP ${error.status}).`
          : "Channel statistics loaded, but recent videos could not be retrieved."
    }
  }

  return {
    id: channelIdValue,
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
    recentVideos,
    recentVideosWarning,
  }
}

export async function GET() {
  return NextResponse.json({
    liveConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
    aiConfigured: isOpenAIConfigured(),
    aiModel: configuredOpenAIModel(),
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

  const actions = ["analyze", "compare", "search", "channel", "trending"]
  if (!actions.includes(body.action)) {
    return NextResponse.json(
      { error: "Choose a valid YouTube action." },
      { status: 400 },
    )
  }

  const forwardedIp = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim()
  const clientIp =
    forwardedIp || request.headers.get("x-real-ip")?.trim() || "unknown"
  const requestLimit = checkRequestRateLimit(`api:${clientIp}`, 30)
  if (!requestLimit.allowed) {
    return NextResponse.json(
      { error: "Too many analytics requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(requestLimit.retryAfterSeconds) },
      },
    )
  }

  if (body.action === "analyze" && isOpenAIConfigured()) {
    const aiLimit = checkRequestRateLimit(`openai:${clientIp}`, 5)
    if (!aiLimit.allowed) {
      return NextResponse.json(
        { error: "OpenAI analysis is rate-limited. Try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(aiLimit.retryAfterSeconds) },
        },
      )
    }
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
      const inputs = Array.isArray(body.videos)
        ? body.videos.filter((video): video is string => typeof video === "string")
        : []
      const ids = inputs.map(parseYouTubeVideoId)
      if (
        !Array.isArray(body.videos) ||
        inputs.length !== body.videos.length ||
        ids.length < 2 ||
        ids.length > 4
      ) {
        return NextResponse.json(
          { error: "Compare between two and four valid YouTube videos." },
          { status: 400 },
        )
      }
      if (ids.some((id) => !id)) {
        return NextResponse.json(
          { error: "Every comparison entry must be a valid YouTube video URL." },
          { status: 400 },
        )
      }
      const validIds = ids.filter((id): id is string => Boolean(id))
      if (new Set(validIds).size !== validIds.length) {
        return NextResponse.json(
          { error: "Choose a different video for each comparison entry." },
          { status: 400 },
        )
      }
      return NextResponse.json({ videos: await compareVideos(validIds) })
    }

    if (body.action === "search") {
      const query = typeof body.query === "string" ? body.query.trim() : ""
      if (!query || query.length > 100) {
        return NextResponse.json(
          { error: "Enter a search keyword of 1 to 100 characters." },
          { status: 400 },
        )
      }
      return NextResponse.json({ videos: await searchVideos(query) })
    }

    if (body.action === "channel") {
      const query = typeof body.query === "string" ? body.query.trim() : ""
      if (!query || query.length > 100) {
        return NextResponse.json(
          { error: "Enter a channel handle or ID of 1 to 100 characters." },
          { status: 400 },
        )
      }
      return NextResponse.json({ channel: await getChannel(query) })
    }

    if (body.action === "trending") {
      const regionCode =
        typeof body.regionCode === "string"
          ? body.regionCode.trim().toUpperCase()
          : "IN"
      const categoryInput =
        typeof body.categoryId === "string" ? body.categoryId.trim() : ""
      if (!/^[A-Z]{2}$/.test(regionCode)) {
        return NextResponse.json(
          { error: "Choose a valid two-letter country code." },
          { status: 400 },
        )
      }
      if (categoryInput && !/^\d{1,3}$/.test(categoryInput)) {
        return NextResponse.json(
          { error: "Choose a valid YouTube category." },
          { status: 400 },
        )
      }
      return NextResponse.json({
        regionCode,
        videos: await getTrendingVideos(regionCode, categoryInput || null),
      })
    }

    return NextResponse.json({ error: "Choose a valid YouTube action." }, { status: 400 })
  } catch (error) {
    const status =
      error instanceof YouTubeRequestError ? error.status : 502
    const message =
      error instanceof YouTubeRequestError
        ? `YouTube API request failed (HTTP ${error.status}): ${error.message}`
        : "The YouTube API could not be reached. Check the server logs and try again."
    console.error(
      "YouTube analytics request failed:",
      error instanceof Error ? error.name : "Unknown error",
    )
    return NextResponse.json({ error: message }, { status })
  }
}
