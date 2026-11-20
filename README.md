# EngageIQ

EngageIQ analyzes public YouTube video and channel metrics, public comments,
and uploaded CSV/TSV datasets. The existing six-view workspace, charts,
comparison tools, sample demo, and report export remain part of the app.

## Server configuration

Copy `.env.example` to `.env.local` and set:

| Variable | Required for | Default |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | Live YouTube Data API v3 metrics and comments | None |
| `OPENAI_API_KEY` | OpenAI audience analysis and recommendations | None |
| `OPENAI_MODEL` | OpenAI Responses API model selection | `gpt-4o-mini` |

These are server-only variables. Do not add a `NEXT_PUBLIC_` prefix, commit
`.env.local`, or print key values in logs. Without an OpenAI key, the app labels
its transparent rule-based fallback. The sample demo is illustrative and is
separately labeled from live YouTube results.

OpenAI requests use the official JavaScript SDK and Responses API with
structured JSON output, a 20-second timeout, no automatic retries, and
`store: false`. Public comments submitted for AI analysis are capped at 100.

## Development and verification

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd test
npm.cmd run build
npm.cmd run verify:openai
```

`verify:openai` makes a real, small Responses API request. It requires a valid
`OPENAI_API_KEY` in `.env.local`; it does not use a mocked model response.

## Request limits

The API applies per-client, per-process limits to analytics requests and AI
analysis, and returns `429` with `Retry-After` when a limit is exceeded. This
in-memory limiter is best-effort on serverless deployments because instances
do not share memory. Configure Vercel Firewall rate limits or a shared rate
limit store for a globally enforced production limit.
