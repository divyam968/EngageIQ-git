import OpenAI from "openai"

const apiKey = process.env.OPENAI_API_KEY?.trim()
if (!apiKey) {
  console.error("Set OPENAI_API_KEY in the ignored .env.local file first.")
  process.exit(1)
}

const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"
const comments = [
  "The clear examples were helpful.",
  "The pacing felt confusing.",
  "What would you recommend next?",
]

const client = new OpenAI({
  apiKey,
  timeout: 20_000,
  maxRetries: 0,
})

try {
  const response = await client.responses.create({
    model,
    instructions:
      "Classify each supplied comment as positive, neutral, or negative. Return integer positive and negative counts only; neutral is the sample size minus those counts. Keep the summary concise and grounded in the supplied comments.",
    input: JSON.stringify({ comments }),
    text: {
      format: {
        type: "json_schema",
        name: "openai_integration_check",
        strict: true,
        schema: {
          type: "object",
          properties: {
            positive: { type: "integer", minimum: 0 },
            negative: { type: "integer", minimum: 0 },
            summary: { type: "string" },
          },
          required: ["positive", "negative", "summary"],
          additionalProperties: false,
        },
      },
    },
    max_output_tokens: 300,
    store: false,
  })

  if (response.status !== "completed" || !response.output_text.trim()) {
    throw new Error("OpenAI returned no completed response.")
  }

  const result = JSON.parse(response.output_text)
  const neutral = comments.length - result.positive - result.negative
  if (
    !Number.isInteger(result.positive) ||
    !Number.isInteger(result.negative) ||
    result.positive < 0 ||
    result.negative < 0 ||
    neutral < 0 ||
    typeof result.summary !== "string" ||
    !result.summary.trim()
  ) {
    throw new Error("OpenAI returned an invalid structured response.")
  }

  console.log(
    `OpenAI Responses API live check passed (model ${model}; ${comments.length} comments).`,
  )
} catch (error) {
  const status =
    error instanceof OpenAI.APIError ? error.status : undefined
  console.error(
    status === 429
      ? "OpenAI rate limit reached during the live check."
      : status === 401 || status === 403
        ? "OpenAI rejected the configured credentials or model access."
        : status
          ? `OpenAI live check failed with HTTP ${status}.`
          : "OpenAI live check failed or timed out.",
  )
  process.exitCode = 1
}
