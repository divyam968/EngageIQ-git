import { afterEach, describe, expect, it, vi } from "vitest"
import { GET, POST } from "./route"

const firstVideoId = "dQw4w9WgXcQ"
const secondVideoId = "aBcdEfGhIJK"

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function videoItem(id: string, statistics = {}) {
  return {
    id,
    snippet: {
      title: `Video ${id}`,
      channelTitle: "Test channel",
      publishedAt: "2025-01-01T00:00:00Z",
      thumbnails: { high: { url: "https://example.test/thumbnail.jpg" } },
    },
    statistics: { viewCount: "1000", likeCount: "40", commentCount: "10", ...statistics },
  }
}

function post(payload: unknown): Request {
  return new Request("http://localhost/api/youtube", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("YouTube route handler", () => {
  it("reports configuration without exposing credentials", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-youtube-key")
    vi.stubEnv("GEMINI_API_KEY", "")

    const result = await (await GET()).json()

    expect(result).toEqual({
      liveConfigured: true,
      aiConfigured: false,
      aiModel: "gemini-3.5-flash-lite",
    })
    expect(JSON.stringify(result)).not.toContain("test-youtube-key")
  })

  it("returns a clear missing-YouTube-key error", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "")

    const result = await POST(post({ action: "analyze", video: firstVideoId }))

    expect(result.status).toBe(503)
    expect(await result.json()).toMatchObject({
      error: expect.stringContaining("YOUTUBE_API_KEY"),
    })
  })

  it("analyzes real-shaped video statistics and public comments with explicit rule fallback", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-youtube-key")
    vi.stubEnv("GEMINI_API_KEY", "")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        )
        if (url.pathname.endsWith("/videos")) {
          return response({ items: [videoItem(firstVideoId)] })
        }
        if (url.pathname.endsWith("/commentThreads")) {
          return response({
            items: [
              { snippet: { topLevelComment: { snippet: { textOriginal: "Great video, amazing story" } } } },
              { snippet: { topLevelComment: { snippet: { textOriginal: "This was boring" } } } },
              { snippet: { topLevelComment: { snippet: { textOriginal: "A thoughtful explanation" } } } },
            ],
          })
        }
        throw new Error("Unexpected test URL")
      }),
    )

    const result = await POST(
      post({ action: "analyze", video: `https://youtu.be/${firstVideoId}` }),
    )
    const payload = await result.json()

    expect(result.status).toBe(200)
    expect(payload.analysis).toMatchObject({
      id: firstVideoId,
      views: 1000,
      likes: 40,
      comments: 10,
      engagementRate: 5,
      commentsAnalyzed: 3,
      insightSource: "rules",
      source: "youtube",
    })
    expect(payload.analysis.sentiment.total).toBe(3)
    expect(payload.analysis.warnings.join(" ")).toContain("Gemini is not configured")
  })

  it("uses Gemini only through a server-side key and validates its structured response", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-youtube-key")
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key")
    const requestedHeaders: Headers[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        )
        if (url.hostname === "generativelanguage.googleapis.com") {
          requestedHeaders.push(new Headers(init?.headers))
          return response({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        sentiment: { positive: 1, negative: 0 },
                        summary: "Viewers praise the explanation and ask for examples.",
                        themes: ["clear explanation"],
                        recommendations: [
                          "Add one worked example to the next video.",
                          "Reply to questions with a pinned comment.",
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          })
        }
        if (url.pathname.endsWith("/videos")) {
          return response({ items: [videoItem(firstVideoId)] })
        }
        if (url.pathname.endsWith("/commentThreads")) {
          return response({
            items: [
              { snippet: { topLevelComment: { snippet: { textOriginal: "Great explanation" } } } },
              { snippet: { topLevelComment: { snippet: { textOriginal: "Please add an example" } } } },
            ],
          })
        }
        throw new Error("Unexpected test URL")
      }),
    )

    const result = await POST(post({ action: "analyze", video: firstVideoId }))
    const payload = await result.json()

    expect(result.status).toBe(200)
    expect(payload.analysis.insightSource).toBe("gemini")
    expect(payload.analysis.sentiment).toMatchObject({
      positive: 50,
      neutral: 50,
      negative: 0,
      total: 2,
    })
    expect(payload.analysis.recommendations[0]).toContain("worked example")
    expect(requestedHeaders).toHaveLength(1)
    expect(requestedHeaders[0].get("x-goog-api-key")).toBe("test-gemini-key")
  })

  it("loads real-shaped trending results with the selected region and category", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-youtube-key")
    const requestUrls: URL[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        requestUrls.push(new URL(
          input instanceof Request ? input.url : input.toString(),
        ))
        return response({ items: [videoItem(firstVideoId)] })
      }),
    )

    const result = await POST(
      post({ action: "trending", regionCode: "in", categoryId: "10" }),
    )
    const payload = await result.json()

    expect(result.status).toBe(200)
    expect(payload.regionCode).toBe("IN")
    expect(payload.videos[0].engagementRate).toBe(5)
    const requestUrl = requestUrls[0]
    expect(requestUrl?.searchParams.get("chart")).toBe("mostPopular")
    expect(requestUrl?.searchParams.get("regionCode")).toBe("IN")
    expect(requestUrl?.searchParams.get("videoCategoryId")).toBe("10")
  })

  it("returns channel totals and recent uploads from the uploads playlist", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-youtube-key")
    const channelId = `UC${"a".repeat(22)}`
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        )
        if (url.pathname.endsWith("/channels")) {
          return response({
            items: [
              {
                id: channelId,
                snippet: { title: "Test channel", customUrl: "@test" },
                statistics: {
                  viewCount: "5000",
                  videoCount: "8",
                  subscriberCount: "123",
                  hiddenSubscriberCount: true,
                },
                contentDetails: {
                  relatedPlaylists: { uploads: "UUtestuploads" },
                },
              },
            ],
          })
        }
        if (url.pathname.endsWith("/playlistItems")) {
          return response({
            items: [{ contentDetails: { videoId: firstVideoId } }],
          })
        }
        if (url.pathname.endsWith("/videos")) {
          return response({ items: [videoItem(firstVideoId)] })
        }
        throw new Error("Unexpected test URL")
      }),
    )

    const result = await POST(post({ action: "channel", query: channelId }))
    const payload = await result.json()

    expect(result.status).toBe(200)
    expect(payload.channel).toMatchObject({
      title: "Test channel",
      subscribers: null,
      views: 5000,
      videos: 8,
      recentVideos: [{ id: firstVideoId, engagementRate: 5 }],
    })
  })

  it("rejects duplicate comparison inputs rather than returning misleading results", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-youtube-key")

    const result = await POST(
      post({
        action: "compare",
        videos: [firstVideoId, `https://youtu.be/${firstVideoId}`],
      }),
    )

    expect(result.status).toBe(400)
    expect(await result.json()).toMatchObject({
      error: expect.stringContaining("different video"),
    })
  })
})
