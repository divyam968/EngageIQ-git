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
      type: "object",
      properties: {
        positive: { type: "integer", minimum: 0 },
        negative: { type: "integer", minimum: 0 },
      },
      required: ["positive", "negative"],
      additionalProperties: false,
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
              "Analyze the supplied public comments. Classify each exactly once as positive, neutral, or negative. Return positive and negative integer counts; neutral is derived by the application. Provide a concise evidence-based summary, themes, and at least two specific recommendations. Do not invent audience demographics or causes.",
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
        max_tokens: 1200,
        temperature: 0.2,
        reasoning: { effort: "minimal", exclude: true },
        stream: false,
      }),
      signal: AbortSignal.timeout(20_000),
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
      throw new Error("OpenRouter returned no structured response.")
    }

    const result = JSON.parse(content)
    const positive = result.sentiment?.positive
    const negative = result.sentiment?.negative
    const neutral = comments.length - positive - negative
    if (
      !Number.isInteger(positive) ||
      !Number.isInteger(negative) ||
      positive < 0 ||
      negative < 0 ||
      neutral < 0 ||
      typeof result.summary !== "string" ||
      !result.summary.trim() ||
      !Array.isArray(result.themes) ||
      !result.themes.every((theme) => typeof theme === "string") ||
      !Array.isArray(result.recommendations) ||
      result.recommendations.length < 2 ||
      result.recommendations.length > 4 ||
      !result.recommendations.every(
        (recommendation) =>
          typeof recommendation === "string" && recommendation.trim(),
      )
    ) {
      throw new Error("OpenRouter returned an invalid structured response.")
    }

    console.log(
      `OpenRouter live check passed: sentiment, summary, themes and recommendations (${comments.length} comments; model ${model}).`,
    )
  }
} catch (error) {
  const timedOut =
    error instanceof Error && /timeout|abort/i.test(error.name + error.message)
  console.error(timedOut
    ? "OpenRouter live check timed out."
    : "OpenRouter live check failed before receiving a valid response.")
  process.exitCode = 1
}
