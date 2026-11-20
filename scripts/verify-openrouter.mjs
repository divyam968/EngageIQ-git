const apiKey = process.env.OPENROUTER_API_KEY?.trim()
if (!apiKey) {
  console.error("Set OPENROUTER_API_KEY in the ignored .env.local file first.")
  process.exit(1)
}

const model = process.env.OPENROUTER_MODEL?.trim() || "openrouter/free"
const comments = [
  "The clear examples were helpful.",
  "The pacing felt confusing.",
  "What would you recommend next?",
]
const schema = {
  type: "object",
  properties: {
    sentiment: {
      type: "array",
      items: {
        type: "string",
        enum: ["positive", "neutral", "negative"],
      },
    },
    summary: { type: "string" },
    themes: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
  },
  required: ["sentiment", "summary", "themes", "recommendations"],
  additionalProperties: false,
}

try {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://engageiq-git.vercel.app",
        "X-OpenRouter-Title": "EngageIQ",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Analyze the supplied public comments. In input order, classify each exactly once as positive, neutral, or negative and return one label per comment. Provide a concise evidence-based summary, themes, and at least two specific recommendations. Do not invent audience demographics or causes. Return only the JSON object matching the requested schema; do not include reasoning or prose outside it.",
          },
          {
            role: "user",
            content: JSON.stringify({
              video: {
                title: "OpenRouter integration smoke test",
                channel: "EngageIQ",
                views: 1000,
                likes: 40,
                comments: 3,
                engagementRate: 4.3,
              },
              comments,
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "openrouter_integration_check",
            strict: true,
            schema,
          },
        },
        max_tokens: 3000,
        temperature: 0.2,
        reasoning: { max_tokens: 200, exclude: true },
        provider: { require_parameters: true },
        stream: false,
      }),
      signal: AbortSignal.timeout(60_000),
    },
  )

  if (!response.ok) {
    console.error(
      response.status === 401
        ? "OpenRouter rejected the configured API key."
        : response.status === 402
          ? "OpenRouter account has insufficient credits."
          : response.status === 403
            ? "OpenRouter denied access or the account spending limit was reached."
            : response.status === 404
              ? "OpenRouter could not route the configured model."
              : response.status === 429
                ? "OpenRouter rate limit reached during the live check."
                : `OpenRouter live check failed with HTTP ${response.status}.`,
    )
    process.exitCode = 1
  } else {
    const payload = await response.json()
    const rawContent = payload?.choices?.[0]?.message?.content
    const rawFinishReason = payload?.choices?.[0]?.finish_reason
    const finishReason = [
      "stop",
      "length",
      "content_filter",
      "tool_calls",
      "error",
    ].includes(rawFinishReason)
      ? rawFinishReason
      : "unknown"
    const content =
      typeof rawContent === "string"
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent
              .flatMap((part) =>
                part && typeof part.text === "string" ? [part.text] : [],
              )
              .join("")
          : ""
    if (!content.trim()) {
      throw new Error(
        `OpenRouter returned no structured response (finish reason: ${finishReason}).`,
      )
    }

    let result
    try {
      result = JSON.parse(content)
    } catch {
      throw new Error("OpenRouter returned invalid JSON.")
    }
    const labelsValid =
      Array.isArray(result.sentiment) &&
      result.sentiment.length === comments.length &&
      result.sentiment.every((label) =>
        ["positive", "neutral", "negative"].includes(label),
      )
    const summaryValid =
      typeof result.summary === "string" && result.summary.trim()
    const themesValid =
      Array.isArray(result.themes) &&
      result.themes.every((theme) => typeof theme === "string")
    const recommendationsValid =
      Array.isArray(result.recommendations) &&
      result.recommendations.length >= 2 &&
      result.recommendations.length <= 4 &&
      result.recommendations.every(
        (recommendation) =>
          typeof recommendation === "string" && recommendation.trim(),
      )
    if (
      !labelsValid ||
      !summaryValid ||
      !themesValid ||
      !recommendationsValid
    ) {
      throw new Error(
        `OpenRouter returned invalid structured output (labels: ${Array.isArray(result.sentiment) ? result.sentiment.length : "missing"}, summary: ${Boolean(summaryValid)}, themes: ${Array.isArray(result.themes) ? result.themes.length : "missing"}, recommendations: ${Array.isArray(result.recommendations) ? result.recommendations.length : "missing"}).`,
      )
    }

    console.log(
      `OpenRouter live check passed: sentiment, summary, themes and recommendations (${comments.length} comments; routed model ${payload?.model ?? model}).`,
    )
  }
} catch (error) {
  const timedOut =
    error instanceof Error && /timeout|abort/i.test(error.name + error.message)
  const safeResponseError =
    error instanceof Error &&
    /^OpenRouter returned (no structured response \(finish reason: (stop|length|content_filter|tool_calls|error|unknown)\)\.|invalid JSON\.|invalid structured output \(labels: (missing|\d+), summary: (true|false), themes: (missing|\d+), recommendations: (missing|\d+)\)\.)$/.test(
      error.message,
    )
      ? error.message
      : null
  console.error(
    timedOut
      ? "OpenRouter live check timed out."
      : safeResponseError ??
          "OpenRouter live check failed before receiving a valid response.",
  )
  process.exitCode = 1
}
