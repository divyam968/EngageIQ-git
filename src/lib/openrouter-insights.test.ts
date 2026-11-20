import { afterEach, describe, expect, it, vi } from "vitest"
import {
  configuredOpenRouterModel,
  generateOpenRouterInsights,
  isOpenRouterConfigured,
  OpenRouterInsightError,
} from "./openrouter-insights"

const video = {
  id: "dQw4w9WgXcQ",
  title: "Test video",
  channelTitle: "Test channel",
  publishedAt: "2025-01-01T00:00:00Z",
  views: 1000,
  likes: 40,
  comments: 10,
  engagementRate: 5,
}

const comments = [
  "The examples were helpful.",
  "The pacing was confusing.",
  "What should come next?",
]

const insight = {
  sentiment: ["positive", "negative", "neutral"],
  summary: "Viewers valued the examples and noted pacing concerns.",
  themes: ["examples"],
  recommendations: [
    "Keep the practical examples.",
    "Tighten transitions between sections.",
  ],
}

function providerResponse(content: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: { content: JSON.stringify(content) },
          finish_reason: "stop",
        },
      ],
    }),
    { status, headers: { "Content-Type": "application/json" } },
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("OpenRouter insights", () => {
  it("uses the OpenRouter free router and validates structured audience insights", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key")
    vi.stubEnv("OPENROUTER_MODEL", "")
    const fetchMock = vi.fn(
      async (
        _input: RequestInfo | URL,
        _options?: RequestInit,
      ): Promise<Response> => providerResponse(insight),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await generateOpenRouterInsights(video, comments)

    expect(configuredOpenRouterModel()).toBe("openrouter/free")
    expect(isOpenRouterConfigured()).toBe(true)
    expect(result).toMatchObject({
      sentiment: {
        positive: 34,
        neutral: 33,
        negative: 33,
        total: 3,
      },
      summary: insight.summary,
      themes: insight.themes,
      recommendations: insight.recommendations,
    })
    const [url, options] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer test-openrouter-key",
    )
    expect(JSON.parse(String(options?.body))).toMatchObject({
      model: "openrouter/free",
      response_format: {
        type: "json_schema",
        json_schema: { name: "engageiq_audience_insights", strict: true },
      },
      max_tokens: 3000,
      reasoning: { max_tokens: 200, exclude: true },
      provider: { require_parameters: true },
    })
    expect(JSON.stringify(result)).not.toContain("test-openrouter-key")
  })

  it("skips provider requests when no key or comments are available", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    expect(isOpenRouterConfigured()).toBe(false)
    await expect(generateOpenRouterInsights(video, comments)).resolves.toBeNull()
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key")
    await expect(generateOpenRouterInsights(video, [])).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("accepts text content parts from compatible OpenRouter providers", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: [
                    { type: "text", text: JSON.stringify(insight) },
                  ],
                },
                finish_reason: "stop",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    )

    await expect(generateOpenRouterInsights(video, comments)).resolves.toMatchObject({
      summary: insight.summary,
      recommendations: insight.recommendations,
    })
  })

  it("reports token-limited empty provider output explicitly", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: null }, finish_reason: "length" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    )

    await expect(generateOpenRouterInsights(video, comments)).rejects.toMatchObject({
      status: 502,
      message: "OpenRouter returned no structured analysis (finish reason: length).",
    })
  })

  it("rejects sentiment labels when the provider does not classify every comment once", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key")
    vi.stubGlobal("fetch", vi.fn(async () => providerResponse({
      ...insight,
      sentiment: ["positive", "unexpected", "neutral"],
    })))

    await expect(generateOpenRouterInsights(video, comments)).rejects.toMatchObject({
      message: "OpenRouter returned invalid per-comment sentiment classifications.",
    })
  })

  it.each([
    [402, "OpenRouter credits are unavailable for this request."],
    [429, "OpenRouter rate limit reached."],
  ])("maps provider status %i to a safe error", async (status, message) => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status })),
    )

    await expect(generateOpenRouterInsights(video, comments)).rejects.toMatchObject<
      Partial<OpenRouterInsightError>
    >({ status, message })
  })

  it("reports timeouts without exposing request credentials", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("request timed out", "TimeoutError")
      }),
    )

    await expect(generateOpenRouterInsights(video, comments)).rejects.toThrow(
      "The OpenRouter request timed out.",
    )
  })
})
