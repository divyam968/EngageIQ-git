"use client"

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"
import { analyzeDataset, type DatasetSummary } from "@/lib/dataset"
import {
  demoAnalysis,
  formatCompactNumber,
  isHistoryEntry,
  parseYouTubeVideoId,
  type AnalysisHistoryEntry,
  type ChannelAnalytics,
  type VideoAnalysis,
  type VideoSummary,
} from "@/lib/youtube"

type WorkspaceView =
  | "Overview"
  | "Video analyzer"
  | "Compare videos"
  | "Data upload"
  | "Channel & search"
  | "Analysis history"

type Theme = "dark" | "light"
type IconName =
  | "brand"
  | "overview"
  | "video"
  | "compare"
  | "upload"
  | "search"
  | "history"
  | "sun"
  | "moon"
  | "arrow"
  | "download"
  | "views"
  | "likes"
  | "comments"
  | "rate"
  | "spark"
  | "plus"
  | "close"
  | "file"
  | "refresh"
  | "play"

const navigation: { label: WorkspaceView; icon: IconName }[] = [
  { label: "Overview", icon: "overview" },
  { label: "Video analyzer", icon: "video" },
  { label: "Compare videos", icon: "compare" },
  { label: "Data upload", icon: "upload" },
  { label: "Channel & search", icon: "search" },
  { label: "Analysis history", icon: "history" },
]

const historyKey = "engageiq:analysis-history"
const themeKey = "engageiq:theme"
const maxUploadBytes = 8 * 1024 * 1024

function Icon({
  name,
  size = 20,
}: {
  name: IconName
  size?: number
}) {
  const paths: Record<IconName, ReactNode> = {
    brand: (
      <>
        <path d="M12 2.8 14.2 9l6.2 2.2-6.2 2.2L12 19.6 9.8 13.4l-6.2-2.2L9.8 9 12 2.8Z" />
        <path d="m19.2 16.8.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1Z" />
      </>
    ),
    overview: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="4" />
        <path d="m10 9 5 3-5 3V9Z" />
      </>
    ),
    compare: (
      <>
        <path d="M7 3v18m0 0-3-3m3 3 3-3M17 21V3m0 0-3 3m3-3 3 3" />
      </>
    ),
    upload: (
      <>
        <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5" />
        <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    history: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </>
    ),
    moon: <path d="M20.8 14.2A8.8 8.8 0 0 1 9.8 3.2 8.9 8.9 0 1 0 20.8 14.2Z" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    download: (
      <>
        <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5" />
        <path d="M5 20h14" />
      </>
    ),
    views: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
    likes: (
      <>
        <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
        <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      </>
    ),
    comments: (
      <>
        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4H12a8 8 0 0 1 8 7.5Z" />
        <path d="M8 11h8m-8 3h5" />
      </>
    ),
    rate: (
      <>
        <path d="M4 17 10 11l4 4 6-8" />
        <path d="M15 7h5v5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" />
      </>
    ),
    plus: <path d="M12 5v14m-7-7h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    file: (
      <>
        <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" />
        <path d="M13 3v7h7m-11 4h6m-6 4h6" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5.5 9A7 7 0 0 1 18 6l2 2m-16 8 2 2a7 7 0 0 0 12.5-3" />
      </>
    ),
    play: <path d="m9 6 10 6-10 6V6Z" />,
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isVideoSummary(value: unknown): value is VideoSummary {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.channelTitle === "string" &&
    (typeof value.views === "number" || value.views === null) &&
    (typeof value.likes === "number" || value.likes === null) &&
    (typeof value.comments === "number" || value.comments === null) &&
    (typeof value.engagementRate === "number" ||
      value.engagementRate === null)
  )
}

function isVideoAnalysis(value: unknown): value is VideoAnalysis {
  if (!isRecord(value)) return false
  const sentimentIsValid =
    value.sentiment === null ||
    (isRecord(value.sentiment) &&
      typeof value.sentiment.positive === "number" &&
      typeof value.sentiment.neutral === "number" &&
      typeof value.sentiment.negative === "number" &&
      typeof value.sentiment.total === "number")
  return (
    isVideoSummary(value) &&
    sentimentIsValid &&
    typeof value.commentsAnalyzed === "number" &&
    typeof value.insightSummary === "string" &&
    Array.isArray(value.themes) &&
    Array.isArray(value.recommendations) &&
    Array.isArray(value.warnings) &&
    (value.insightSource === "openai" ||
      value.insightSource === "rules" ||
      value.insightSource === "demo") &&
    (value.source === "demo" || value.source === "youtube")
  )
}

function errorFromPayload(payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error
  }
  return "The request could not be completed. Please try again."
}

async function postYouTube(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch("/api/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(50_000),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("The request timed out. Please try again.")
    }
    throw new Error("The server could not be reached. Check your connection and retry.")
  }
  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new Error("The server returned an unreadable response.")
  }

  if (!response.ok) throw new Error(errorFromPayload(payload))
  if (!isRecord(payload)) throw new Error("The server returned an invalid response.")
  return payload
}

function dateLabel(value: string): string {
  if (!value) return "Publication date unavailable"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Publication date unavailable"
    : date.toLocaleDateString("en-US")
}

function formatPercentage(value: number | null): string {
  return value === null ? "Unavailable" : `${value.toFixed(2)}%`
}

function csvCell(value: string | number | null): string {
  const raw = value === null ? "Unavailable" : String(value)
  const text = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${text.replaceAll('"', '""')}"`
}

function Sidebar({
  view,
  mobileOpen,
  liveConfigured,
  aiConfigured,
  statusUnavailable,
  onNavigate,
  onClose,
}: {
  view: WorkspaceView
  mobileOpen: boolean
  liveConfigured: boolean
  aiConfigured: boolean
  statusUnavailable: boolean
  onNavigate: (view: WorkspaceView) => void
  onClose: () => void
}) {
  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="navigation-scrim"
          onClick={onClose}
          type="button"
        />
      )}
      <aside
        aria-label="EngageIQ workspace navigation"
        className={`sidebar${mobileOpen ? " sidebar-open" : ""}`}
      >
        <button
          aria-label="EngageIQ Intelligence studio"
          className="brand-lockup"
          onClick={() => onNavigate("Overview")}
          type="button"
        >
          <span className="brand-icon"><Icon name="brand" size={23} /></span>
          <span className="brand-copy">
            <strong>EngageIQ</strong>
            <span>Intelligence studio</span>
          </span>
        </button>

        <button
          aria-label="Close navigation"
          className="sidebar-close"
          onClick={onClose}
          type="button"
        >
          <Icon name="close" />
        </button>

        <nav aria-label="Primary navigation" className="primary-navigation">
          {navigation.map((item) => (
            <button
              aria-current={view === item.label ? "page" : undefined}
              className={`nav-item${view === item.label ? " nav-active" : ""}`}
              key={item.label}
              onClick={() => onNavigate(item.label)}
              type="button"
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <div className="status-heading">
            <span className={`status-dot${liveConfigured ? " status-live" : ""}`} />
            {statusUnavailable
              ? "API status unavailable"
              : liveConfigured
              ? aiConfigured
                ? "YouTube + OpenAI ready"
                : "YouTube data ready"
                : "Demo mode ready"}
          </div>
          <p>
            {statusUnavailable
              ? "The server status could not be checked. Live requests report their own setup errors."
              : liveConfigured
              ? aiConfigured
                  ? "Live YouTube data and OpenAI audience insights are enabled."
                  : "Live YouTube data is enabled; insights use transparent rules."
                : "Sample analysis works offline. Configure server keys for live data."}
          </p>
        </div>
      </aside>
    </>
  )
}

function MetricCard({
  icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: IconName
  label: string
  value: string
  caption: string
  tone: string
}) {
  return (
    <article className="metric-card">
      <span className={`metric-icon ${tone}`}><Icon name={icon} size={20} /></span>
      <p className="metric-label">{label}</p>
      <strong className="metric-value">{value}</strong>
      <span className="metric-caption">{caption}</span>
    </article>
  )
}

function AnalysisDashboard({
  analysis,
  onNewAnalysis,
}: {
  analysis: VideoAnalysis
  onNewAnalysis: () => void
}) {
  const performance = [
    { label: "Views", value: analysis.views, icon: "views" as const },
    { label: "Likes", value: analysis.likes, icon: "likes" as const },
    { label: "Comments", value: analysis.comments, icon: "comments" as const },
  ]
  const largestValue = Math.max(
    ...performance.map((item) => item.value ?? 0),
    1,
  )
  const sentimentStyle = analysis.sentiment
    ? {
        background: `conic-gradient(var(--positive) 0 ${analysis.sentiment.positive}%, var(--neutral) ${analysis.sentiment.positive}% ${analysis.sentiment.positive + analysis.sentiment.neutral}%, var(--negative) ${analysis.sentiment.positive + analysis.sentiment.neutral}% 100%)`,
      }
    : undefined

  return (
    <div className="analysis-results">
      <section className="result-heading" aria-labelledby="analysis-title">
        <div className="result-title-copy">
          <p className="creator-name">{analysis.channelTitle}</p>
          <h2 id="analysis-title">{analysis.title}</h2>
          <p className="video-metadata">
            Published {dateLabel(analysis.publishedAt)} <span>·</span> ID {analysis.id}
            {analysis.source === "demo" && <span className="demo-tag">Sample demo</span>}
          </p>
        </div>
        <button className="button button-outline" onClick={onNewAnalysis} type="button">
          New analysis <Icon name="arrow" size={17} />
        </button>
      </section>

      {analysis.warnings.map((warning) => (
        <p className="inline-warning" key={warning} role="status">{warning}</p>
      ))}

      <section aria-label="Video performance metrics" className="metric-grid">
        <MetricCard
          icon="views"
          label="Total views"
          value={formatCompactNumber(analysis.views)}
          caption="Reach"
          tone="tone-purple"
        />
        <MetricCard
          icon="likes"
          label="Total likes"
          value={formatCompactNumber(analysis.likes)}
          caption="Affinity"
          tone="tone-cyan"
        />
        <MetricCard
          icon="comments"
          label="Comments"
          value={formatCompactNumber(analysis.comments)}
          caption="Conversation"
          tone="tone-green"
        />
        <MetricCard
          icon="rate"
          label="Engagement rate"
          value={formatPercentage(analysis.engagementRate)}
          caption="Opportunity"
          tone="tone-amber"
        />
      </section>

      <section aria-label="Audience analysis charts" className="chart-grid">
        <article className="panel chart-card">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Performance mix</p>
              <h3>Audience response</h3>
            </div>
            <span className="card-status"><i /> {analysis.source === "demo" ? "Sample snapshot" : "Live snapshot"}</span>
          </div>
          <div aria-label="Performance bar chart" className="performance-chart" role="img">
            {performance.map((item) => (
              <div className="performance-row" key={item.label}>
                <span className="performance-icon"><Icon name={item.icon} size={16} /></span>
                <div className="performance-data">
                  <div className="performance-labels">
                    <span>{item.label}</span>
                    <strong>{formatCompactNumber(item.value)}</strong>
                  </div>
                  <span className="bar-track">
                    <span
                      className={`bar-fill bar-${item.label.toLowerCase()}`}
                      style={{
                        width:
                          item.value === null
                            ? "0%"
                            : `${Math.max(4, (item.value / largestValue) * 100)}%`,
                      }}
                    />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel chart-card">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">
                {analysis.insightSource === "openai"
                  ? "OpenAI sentiment"
                  : analysis.insightSource === "demo"
                    ? "Sample sentiment"
                    : "Rule-based sentiment"}
              </p>
              <h3>Comment sentiment</h3>
            </div>
            <span className="card-status">
              {analysis.sentiment
                ? `${analysis.commentsAnalyzed} analyzed`
                : "Unavailable"}
            </span>
          </div>
          {analysis.sentiment ? (
            <div className="sentiment-content">
              <div
                aria-label={`${analysis.sentiment.positive}% positive, ${analysis.sentiment.neutral}% neutral, ${analysis.sentiment.negative}% negative`}
                className="sentiment-donut"
                role="img"
                style={sentimentStyle}
              >
                <span>
                  <strong>{analysis.sentiment.total}</strong>
                  <small>comments</small>
                </span>
              </div>
              <ul className="sentiment-legend">
                <li><i className="legend-positive" /><span>Positive</span><strong>{analysis.sentiment.positive}%</strong></li>
                <li><i className="legend-neutral" /><span>Neutral</span><strong>{analysis.sentiment.neutral}%</strong></li>
                <li><i className="legend-negative" /><span>Negative</span><strong>{analysis.sentiment.negative}%</strong></li>
              </ul>
            </div>
          ) : (
            <p className="sentiment-unavailable">
              No public comments were available to classify.
            </p>
          )}
        </article>
      </section>

      <section className="panel recommendations">
        <div className="card-title-row">
          <div>
            <p className="card-kicker">
              {analysis.insightSource === "openai"
                ? "OpenAI analysis"
                : analysis.insightSource === "demo"
                  ? "Sample demo insights"
                  : "Transparent rule-based analysis"}
            </p>
            <h3>Audience insights</h3>
          </div>
          <span className="card-status">
            {analysis.insightSource === "openai"
              ? "AI generated"
              : analysis.insightSource === "demo"
                ? "Illustrative"
                : "Data-derived"}
          </span>
        </div>
        <p className="insight-summary">{analysis.insightSummary}</p>
        {analysis.themes.length > 0 && (
          <div className="insight-themes" aria-label="Recurring audience themes">
            {analysis.themes.map((theme) => (
              <span className="insight-theme" key={theme}>{theme}</span>
            ))}
          </div>
        )}
        <h4 className="recommendation-heading">Recommended next steps</h4>
        <ol className="recommendation-list">
          {analysis.recommendations.map((recommendation, index) => (
            <li key={recommendation}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{recommendation}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function OverviewPanel({
  input,
  busy,
  error,
  aiConfigured,
  onInput,
  onSubmit,
  onDemo,
}: {
  input: string
  busy: boolean
  error: string
  aiConfigured: boolean
  onInput: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDemo: () => void
}) {
  return (
    <section aria-labelledby="overview-title" className="panel hero-panel">
      <span className="eyebrow-pill"><Icon name="spark" size={15} /> {aiConfigured ? "OpenAI-powered audience intelligence" : "YouTube engagement intelligence"}</span>
      <h2 id="overview-title">Turn audience signals into your next breakthrough.</h2>
      <p className="panel-description">
        Analyze live YouTube performance, understand public comment sentiment,
        and get recommendations grounded in the data available for each video.
      </p>
      <form className="analysis-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="overview-video-url">Paste a YouTube video URL</label>
        <input
          autoComplete="url"
          id="overview-video-url"
          onChange={(event) => onInput(event.target.value)}
          placeholder="Paste a YouTube video URL"
          value={input}
        />
        <button className="button button-primary" disabled={busy} type="submit">
          {busy ? "Analyzing…" : "Analyze video"}
          {!busy && <Icon name="arrow" size={18} />}
        </button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="sample-link" onClick={onDemo} type="button">
        Try the clearly labeled sample demo
      </button>
    </section>
  )
}

function VideoAnalyzerPanel({
  input,
  busy,
  error,
  onInput,
  onSubmit,
}: {
  input: string
  busy: boolean
  error: string
  onInput: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section aria-labelledby="video-analyzer-title" className="panel form-panel">
      <span className="eyebrow-pill">Single video intelligence</span>
      <h2 id="video-analyzer-title">Analyze any public YouTube video</h2>
      <p className="panel-description">
        Paste a watch, Shorts, or youtu.be link. We securely request statistics
        and up to 200 relevant public comments through the server.
      </p>
      <form className="analysis-form labeled-form" onSubmit={onSubmit}>
        <label htmlFor="video-url">YouTube URL or video ID</label>
        <div className="input-action-row">
          <input
            autoComplete="url"
            id="video-url"
            onChange={(event) => onInput(event.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            value={input}
          />
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? "Analyzing…" : "Run analysis"}
            {!busy && <Icon name="arrow" size={18} />}
          </button>
        </div>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}

function ComparePanel({
  inputs,
  results,
  busy,
  error,
  onInput,
  onAdd,
  onCompare,
}: {
  inputs: string[]
  results: VideoSummary[]
  busy: boolean
  error: string
  onInput: (index: number, value: string) => void
  onAdd: () => void
  onCompare: (event: FormEvent<HTMLFormElement>) => void
}) {
  const [chartMetric, setChartMetric] = useState<
    "engagementRate" | "views" | "likes" | "comments"
  >("engagementRate")
  const metricLabel = {
    engagementRate: "Engagement rate",
    views: "Views",
    likes: "Likes",
    comments: "Comments",
  }[chartMetric]
  const sortedResults = [...results].sort(
    (left, right) =>
      (right[chartMetric] ?? -1) - (left[chartMetric] ?? -1),
  )
  const chartMaximum = Math.max(
    ...sortedResults.map((video) => video[chartMetric] ?? 0),
    1,
  )

  return (
    <section className="panel form-panel">
      <span className="eyebrow-pill">Side-by-side benchmarking</span>
      <h2>Compare up to four videos</h2>
      <p className="panel-description">
        Compare live public metrics side by side and inspect their relative performance.
      </p>
      <form onSubmit={onCompare}>
        <div className="comparison-inputs">
          {inputs.map((input, index) => (
            <label className="field-group" key={index}>
              <span>Video {index + 1} URL</span>
              <input
                autoComplete="url"
                onChange={(event) => onInput(index, event.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                value={input}
              />
            </label>
          ))}
        </div>
        <div className="form-actions">
          {inputs.length < 4 && (
            <button className="button button-outline" onClick={onAdd} type="button">
              <Icon name="plus" size={17} /> Add video
            </button>
          )}
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? "Comparing…" : "Compare now"}
            {!busy && <Icon name="arrow" size={18} />}
          </button>
        </div>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {results.length > 0 && (
        <div className="comparison-results">
          <div className="card-title-row">
            <h3>Video comparison</h3>
            <label className="chart-control">
              <span>Chart metric</span>
              <select
                onChange={(event) =>
                  setChartMetric(
                    event.target.value as typeof chartMetric,
                  )
                }
                value={chartMetric}
              >
                <option value="engagementRate">Engagement rate</option>
                <option value="views">Views</option>
                <option value="likes">Likes</option>
                <option value="comments">Comments</option>
              </select>
            </label>
          </div>
          <div
            aria-label={`Compared videos ranked by ${metricLabel}`}
            className="comparison-chart"
            role="img"
          >
            {sortedResults.map((video) => {
              const value = video[chartMetric]
              const formattedValue =
                chartMetric === "engagementRate"
                  ? formatPercentage(value)
                  : formatCompactNumber(value)
              return (
                <div className="comparison-chart-row" key={video.id}>
                  <span className="comparison-chart-title">{video.title}</span>
                  <span className="comparison-chart-track">
                    <span
                      style={{
                        width:
                          value === null
                            ? "0%"
                            : `${Math.max(3, (value / chartMaximum) * 100)}%`,
                      }}
                    />
                  </span>
                  <strong>{formattedValue}</strong>
                </div>
              )
            })}
          </div>
          <div className="comparison-grid">
            {results.map((video) => (
              <article className="comparison-card" key={video.id}>
                <p className="card-kicker">{video.channelTitle}</p>
                <h4>{video.title}</h4>
                <div className="comparison-stat"><span>Views</span><strong>{formatCompactNumber(video.views)}</strong></div>
                <div className="comparison-stat"><span>Likes</span><strong>{formatCompactNumber(video.likes)}</strong></div>
                <div className="comparison-stat"><span>Comments</span><strong>{formatCompactNumber(video.comments)}</strong></div>
                <div className="comparison-stat"><span>Engagement</span><strong>{formatPercentage(video.engagementRate)}</strong></div>
                <div className="comparison-bar"><span style={{ width: `${video.engagementRate === null ? 0 : Math.max(5, Math.min(100, video.engagementRate * 20))}%` }} /></div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function UploadPanel({
  inputRef,
  dataset,
  error,
  dragActive,
  onChoose,
  onFile,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  dataset: DatasetSummary | null
  error: string
  dragActive: boolean
  onChoose: () => void
  onFile: (file: File | null) => void
  onDragEnter: (event: DragEvent<HTMLButtonElement>) => void
  onDragLeave: (event: DragEvent<HTMLButtonElement>) => void
  onDrop: (event: DragEvent<HTMLButtonElement>) => void
}) {
  return (
    <section className="panel form-panel">
      <span className="eyebrow-pill">Automatic dataset analysis</span>
      <h2>Bring your own performance data</h2>
      <p className="panel-description">
        Upload CSV or tab-separated files up to 8 MB. Processing stays in this
        browser session; no file contents are uploaded.
      </p>
      <input
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        aria-label="Choose a CSV or tab-separated file"
        className="file-input-hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onFile(event.target.files?.[0] ?? null)
          event.target.value = ""
        }}
        ref={inputRef}
        type="file"
      />
      <button className="button button-outline choose-file" onClick={onChoose} type="button">
        <Icon name="file" size={17} /> Choose File
      </button>
      <button
        className={`dropzone${dragActive ? " dropzone-active" : ""}`}
        onClick={onChoose}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        type="button"
      >
        <span className="dropzone-icon"><Icon name="upload" size={25} /></span>
        <strong>Choose a CSV or Excel-exported CSV</strong>
        <span>Click to browse · CSV/TSV · Max 8 MB</span>
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {dataset && (
        <div className="dataset-results">
          <div className="dataset-heading">
            <div>
              <p className="card-kicker">Dataset analyzed locally</p>
              <h3>{dataset.fileName}</h3>
            </div>
            <span className="card-status">{dataset.rowCount} rows</span>
          </div>
          <div className="dataset-metrics">
            <MetricCard icon="views" label="Total views" value={formatCompactNumber(dataset.totalViews)} caption="Reach" tone="tone-purple" />
            <MetricCard icon="likes" label="Total likes" value={formatCompactNumber(dataset.totalLikes)} caption="Affinity" tone="tone-cyan" />
            <MetricCard icon="comments" label="Total comments" value={formatCompactNumber(dataset.totalComments)} caption="Conversation" tone="tone-green" />
            <MetricCard icon="rate" label="Engagement rate" value={formatPercentage(dataset.engagementRate)} caption="Opportunity" tone="tone-green" />
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr>{dataset.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {dataset.preview.map((row, rowIndex) => (
                  <tr key={`${dataset.fileName}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell || "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function ChannelPanel({
  query,
  busy,
  error,
  videos,
  channel,
  trendingRegion,
  trendingCategory,
  trendingVideos,
  trendingBusy,
  trendingError,
  onQuery,
  onSearch,
  onChannel,
  onTrendingRegion,
  onTrendingCategory,
  onLoadTrending,
  onAnalyzeVideo,
}: {
  query: string
  busy: boolean
  error: string
  videos: VideoSummary[]
  channel: ChannelAnalytics | null
  trendingRegion: string
  trendingCategory: string
  trendingVideos: VideoSummary[]
  trendingBusy: boolean
  trendingError: string
  onQuery: (value: string) => void
  onSearch: (event: FormEvent<HTMLFormElement>) => void
  onChannel: () => void
  onTrendingRegion: (value: string) => void
  onTrendingCategory: (value: string) => void
  onLoadTrending: () => void
  onAnalyzeVideo: (videoId: string) => void
}) {
  const [trendMetric, setTrendMetric] = useState<"views" | "engagementRate">(
    "engagementRate",
  )
  const rankedTrending = [...trendingVideos].sort(
    (left, right) =>
      (right[trendMetric] ?? -1) - (left[trendMetric] ?? -1),
  )
  const maximumTrendValue = Math.max(
    ...rankedTrending.map((video) => video[trendMetric] ?? 0),
    1,
  )

  return (
    <section className="panel form-panel">
      <span className="eyebrow-pill">Public YouTube discovery</span>
      <h2>Search videos or inspect a channel</h2>
      <p className="panel-description">
        Use a keyword for video search or enter a channel handle for public channel statistics.
      </p>
      <form className="channel-form" onSubmit={onSearch}>
        <label className="sr-only" htmlFor="channel-search">AI creator tools or @channelhandle</label>
        <input
          id="channel-search"
          onChange={(event) => onQuery(event.target.value)}
          placeholder="AI creator tools or @channelhandle"
          value={query}
        />
        <button className="button button-primary" disabled={busy} type="submit">
          Search videos <Icon name="search" size={17} />
        </button>
        <button className="button button-outline" disabled={busy} onClick={onChannel} type="button">
          Channel analytics
        </button>
      </form>
      {busy && <p className="loading-message" role="status">Searching public YouTube data…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {channel && (
        <>
          <article className="channel-result">
            <div className="channel-avatar">
              {channel.thumbnailUrl ? <img alt="" src={channel.thumbnailUrl} /> : <Icon name="brand" size={24} />}
            </div>
            <div className="channel-copy">
              <p className="card-kicker">{channel.handle ? `@${channel.handle.replace(/^@/, "")}` : "YouTube channel"}</p>
              <h3>{channel.title}</h3>
              {channel.description && <p>{channel.description}</p>}
            </div>
            <div className="channel-stats">
              <span><strong>{channel.subscribers === null ? "Hidden" : formatCompactNumber(channel.subscribers)}</strong> subscribers</span>
              <span><strong>{formatCompactNumber(channel.views)}</strong> views</span>
              <span><strong>{formatCompactNumber(channel.videos)}</strong> videos</span>
            </div>
          </article>
          {channel.recentVideosWarning && (
            <p className="inline-warning" role="status">{channel.recentVideosWarning}</p>
          )}
          {channel.recentVideos.length > 0 && (
            <div className="recent-videos">
              <div className="dataset-heading">
                <div><p className="card-kicker">Uploads playlist</p><h3>Recent public videos</h3></div>
                <span className="card-status">{channel.recentVideos.length} videos</span>
              </div>
              {channel.recentVideos.map((video) => (
                <article className="search-result" key={video.id}>
                  {video.thumbnailUrl ? <img alt="" src={video.thumbnailUrl} /> : <span className="thumbnail-placeholder"><Icon name="play" /></span>}
                  <div>
                    <h4>{video.title}</h4>
                    <p>{formatCompactNumber(video.views)} views · {formatPercentage(video.engagementRate)} engagement</p>
                  </div>
                  <button
                    aria-label={`Analyze ${video.title}`}
                    className="button button-outline result-analyze"
                    onClick={() => onAnalyzeVideo(video.id)}
                    type="button"
                  >
                    Analyze
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {videos.length > 0 && (
        <div className="search-results">
          <div className="dataset-heading">
            <div><p className="card-kicker">Video search</p><h3>Results</h3></div>
            <span className="card-status">{videos.length} videos</span>
          </div>
          <div className="search-result-list">
            {videos.map((video) => (
              <article className="search-result" key={video.id}>
                {video.thumbnailUrl ? <img alt="" src={video.thumbnailUrl} /> : <span className="thumbnail-placeholder"><Icon name="play" /></span>}
                <div>
                  <h4>{video.title}</h4>
                  <p>{video.channelTitle} · {formatCompactNumber(video.views)} views · {formatPercentage(video.engagementRate)} engagement</p>
                </div>
                <button
                  aria-label={`Analyze ${video.title}`}
                  className="button button-outline result-analyze"
                  onClick={() => onAnalyzeVideo(video.id)}
                  type="button"
                >
                  Analyze
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      <section aria-labelledby="trending-title" className="trending-section">
        <div className="card-title-row">
          <div>
            <p className="card-kicker">YouTube most-popular chart</p>
            <h3 id="trending-title">Trending content analysis</h3>
          </div>
          <span className="card-status">Live API data</span>
        </div>
        <p className="panel-description">
          Explore YouTube&apos;s current public most-popular list by region and category.
          This is a snapshot, not a historical growth measure.
        </p>
        <div className="trending-controls">
          <label>
            <span>Region</span>
            <select
              onChange={(event) => onTrendingRegion(event.target.value)}
              value={trendingRegion}
            >
              <option value="IN">India</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="JP">Japan</option>
            </select>
          </label>
          <label>
            <span>Category</span>
            <select
              onChange={(event) => onTrendingCategory(event.target.value)}
              value={trendingCategory}
            >
              <option value="">All categories</option>
              <option value="10">Music</option>
              <option value="20">Gaming</option>
              <option value="17">Sports</option>
              <option value="24">Entertainment</option>
              <option value="25">News & politics</option>
              <option value="27">Education</option>
              <option value="28">Science & technology</option>
            </select>
          </label>
          <button
            className="button button-primary"
            disabled={trendingBusy}
            onClick={onLoadTrending}
            type="button"
          >
            {trendingBusy ? "Loading trends…" : "Load trending"}
          </button>
        </div>
        {trendingError && <p className="form-error" role="alert">{trendingError}</p>}
        {rankedTrending.length > 0 && (
          <div className="trending-results">
            <div className="card-title-row">
              <div>
                <p className="card-kicker">{trendingRegion} · {rankedTrending.length} live results</p>
                <h4>Rank videos by</h4>
              </div>
              <label className="chart-control">
                <span>Chart metric</span>
                <select
                  onChange={(event) =>
                    setTrendMetric(
                      event.target.value as typeof trendMetric,
                    )
                  }
                  value={trendMetric}
                >
                  <option value="engagementRate">Engagement rate</option>
                  <option value="views">Views</option>
                </select>
              </label>
            </div>
            <div
              aria-label={`Trending videos ranked by ${trendMetric === "views" ? "views" : "engagement rate"}`}
              className="trending-chart"
              role="img"
            >
              {rankedTrending.map((video, index) => {
                const value = video[trendMetric]
                const label =
                  trendMetric === "views"
                    ? formatCompactNumber(value)
                    : formatPercentage(value)
                return (
                  <div className="trending-chart-row" key={video.id}>
                    <span className="trending-rank">{index + 1}</span>
                    <span className="trending-title">{video.title}</span>
                    <span className="trending-track">
                      <span
                        style={{
                          width:
                            value === null
                              ? "0%"
                              : `${Math.max(3, (value / maximumTrendValue) * 100)}%`,
                        }}
                      />
                    </span>
                    <strong>{label}</strong>
                  </div>
                )
              })}
            </div>
            <div className="search-result-list">
              {rankedTrending.map((video) => (
                <article className="search-result" key={video.id}>
                  {video.thumbnailUrl ? <img alt="" src={video.thumbnailUrl} /> : <span className="thumbnail-placeholder"><Icon name="play" /></span>}
                  <div>
                    <h4>{video.title}</h4>
                    <p>{video.channelTitle} · {formatCompactNumber(video.views)} views · {formatPercentage(video.engagementRate)} engagement</p>
                  </div>
                  <button
                    aria-label={`Analyze ${video.title}`}
                    className="button button-outline result-analyze"
                    onClick={() => onAnalyzeVideo(video.id)}
                    type="button"
                  >
                    Analyze
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </section>
  )
}

function HistoryPanel({
  entries,
  error,
  onRefresh,
}: {
  entries: AnalysisHistoryEntry[]
  error: string
  onRefresh: () => void
}) {
  return (
    <section className="panel form-panel history-panel">
      <span className="eyebrow-pill">Local browser records</span>
      <h2>Your analysis history</h2>
      <p className="panel-description">
        Recent analyses saved in this browser. Live video data is requested
        through the server and never stores your API key in the browser.
      </p>
      <button className="button button-outline refresh-button" onClick={onRefresh} type="button">
        <Icon name="refresh" size={17} /> Refresh history
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {entries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon"><Icon name="history" size={22} /></span>
          <strong>No analyses yet</strong>
          <p>Analyze a video or try the sample demo to start building your history.</p>
        </div>
      ) : (
        <div className="table-scroll history-table-wrap">
          <table className="data-table history-table">
            <thead>
              <tr><th>Analysis</th><th>Views</th><th>Engagement</th><th>Sentiment</th><th>Date</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`${entry.id}-${entry.analyzedAt}`}>
                  <td>{entry.title}</td>
                  <td>{formatCompactNumber(entry.views)}</td>
                  <td>{formatPercentage(entry.engagementRate)}</td>
                  <td>{entry.positiveSentiment === null ? "Unavailable" : `${entry.positiveSentiment}% positive`}</td>
                  <td>{new Date(entry.analyzedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function EngageIQDashboard() {
  const [view, setView] = useState<WorkspaceView>("Overview")
  const [theme, setTheme] = useState<Theme>("dark")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [liveConfigured, setLiveConfigured] = useState(false)
  const [aiConfigured, setAiConfigured] = useState(false)
  const [statusUnavailable, setStatusUnavailable] = useState(false)
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null)
  const [analysisInput, setAnalysisInput] = useState("")
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const [analysisError, setAnalysisError] = useState("")
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([])
  const [historyError, setHistoryError] = useState("")
  const [compareInputs, setCompareInputs] = useState(["", ""])
  const [compareResults, setCompareResults] = useState<VideoSummary[]>([])
  const [compareBusy, setCompareBusy] = useState(false)
  const [compareError, setCompareError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<VideoSummary[]>([])
  const [channel, setChannel] = useState<ChannelAnalytics | null>(null)
  const [discoveryBusy, setDiscoveryBusy] = useState(false)
  const [discoveryError, setDiscoveryError] = useState("")
  const [trendingRegion, setTrendingRegion] = useState("IN")
  const [trendingCategory, setTrendingCategory] = useState("")
  const [trendingVideos, setTrendingVideos] = useState<VideoSummary[]>([])
  const [trendingBusy, setTrendingBusy] = useState(false)
  const [trendingError, setTrendingError] = useState("")
  const [dataset, setDataset] = useState<DatasetSummary | null>(null)
  const [datasetError, setDatasetError] = useState("")
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(themeKey)
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme)
      const savedHistory: unknown = JSON.parse(localStorage.getItem(historyKey) ?? "[]")
      if (Array.isArray(savedHistory)) {
        setHistory(savedHistory.filter(isHistoryEntry).slice(0, 20))
      }
    } catch {
      setHistoryError("Saved browser history could not be read.")
    }

    fetch("/api/youtube")
      .then(async (response) => {
        if (!response.ok) throw new Error("API status is unavailable.")
        const status: unknown = await response.json()
        if (isRecord(status)) {
          setLiveConfigured(status.liveConfigured === true)
          setAiConfigured(status.aiConfigured === true)
        }
      })
      .catch(() => {
        setLiveConfigured(false)
        setAiConfigured(false)
        setStatusUnavailable(true)
      })
  }, [])

  function navigate(nextView: WorkspaceView) {
    setView(nextView)
    setMobileOpen(false)
  }

  function recordAnalysis(result: VideoAnalysis) {
    setAnalysis(result)
    const entry: AnalysisHistoryEntry = {
      id: result.id,
      title: result.title,
      views: result.views,
      engagementRate: result.engagementRate,
      positiveSentiment: result.sentiment?.positive ?? null,
      analyzedAt: new Date().toISOString(),
    }
    const next = [entry, ...history].slice(0, 20)
    setHistory(next)
    try {
      localStorage.setItem(historyKey, JSON.stringify(next))
    } catch {
      setHistoryError("This browser could not save the analysis history.")
    }
  }

  async function submitAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAnalysisError("")
    const videoId = parseYouTubeVideoId(analysisInput)
    if (!videoId) {
      setAnalysisError("Enter a valid YouTube watch, Shorts, or youtu.be URL.")
      return
    }

    setAnalysisBusy(true)
    try {
      const response = await postYouTube({ action: "analyze", video: analysisInput })
      if (!isVideoAnalysis(response.analysis)) {
        throw new Error("The server returned incomplete video analysis.")
      }
      recordAnalysis(response.analysis)
      setView("Overview")
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "The video could not be analyzed.",
      )
    } finally {
      setAnalysisBusy(false)
    }
  }

  function showDemo() {
    setAnalysisError("")
    setAnalysisInput(demoAnalysis.id)
    recordAnalysis(demoAnalysis)
    setView("Overview")
  }

  function startNewAnalysis() {
    setAnalysisInput(analysis?.id ?? "")
    setAnalysisError("")
    setView("Video analyzer")
  }

  async function compareVideos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCompareError("")
    const filledInputs = compareInputs.map((input) => input.trim()).filter(Boolean)
    const ids = filledInputs.map(parseYouTubeVideoId)
    if (filledInputs.length < 2) {
      setCompareError("Add at least two YouTube video URLs to compare.")
      return
    }
    if (ids.some((id) => !id)) {
      setCompareError("Each comparison field must contain a valid YouTube video URL.")
      return
    }

    setCompareBusy(true)
    setCompareResults([])
    try {
      const response = await postYouTube({ action: "compare", videos: filledInputs })
      const results = Array.isArray(response.videos)
        ? response.videos.filter(isVideoSummary)
        : []
      if (results.length < 2) {
        throw new Error("YouTube returned fewer than two public videos.")
      }
      setCompareResults(results)
    } catch (error) {
      setCompareError(
        error instanceof Error ? error.message : "The videos could not be compared.",
      )
    } finally {
      setCompareBusy(false)
    }
  }

  async function searchVideos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDiscoveryError("")
    setChannel(null)
    if (!searchQuery.trim()) {
      setDiscoveryError("Enter a keyword to search public YouTube videos.")
      return
    }

    setDiscoveryBusy(true)
    setSearchResults([])
    try {
      const response = await postYouTube({ action: "search", query: searchQuery })
      const results = Array.isArray(response.videos)
        ? response.videos.filter(isVideoSummary)
        : []
      setSearchResults(results)
      if (results.length === 0) setDiscoveryError("No public videos matched that search.")
    } catch (error) {
      setDiscoveryError(
        error instanceof Error ? error.message : "Video search could not be completed.",
      )
    } finally {
      setDiscoveryBusy(false)
    }
  }

  async function inspectChannel() {
    setDiscoveryError("")
    setSearchResults([])
    if (!searchQuery.trim()) {
      setDiscoveryError("Enter a channel handle or channel ID.")
      return
    }

    const normalizedQuery = searchQuery
      .trim()
      .replace(/^https?:\/\/(?:www\.)?youtube\.com\//i, "")
      .replace(/^@/, "")
      .replace(/^channel\//, "")
      .replace(/\/$/, "")
    setDiscoveryBusy(true)
    setChannel(null)
    try {
      const response = await postYouTube({
        action: "channel",
        query: normalizedQuery,
      })
      if (!isRecord(response.channel)) {
        throw new Error("The server returned incomplete channel analytics.")
      }
      const result = response.channel
      if (
        typeof result.id !== "string" ||
        typeof result.title !== "string" ||
        typeof result.handle !== "string" ||
        typeof result.description !== "string" ||
        (typeof result.subscribers !== "number" && result.subscribers !== null) ||
        (typeof result.views !== "number" && result.views !== null) ||
        (typeof result.videos !== "number" && result.videos !== null) ||
        !Array.isArray(result.recentVideos)
      ) {
        throw new Error("The server returned incomplete channel analytics.")
      }
      setChannel({
        id: result.id,
        title: result.title,
        handle: result.handle,
        description: result.description,
        thumbnailUrl:
          typeof result.thumbnailUrl === "string" ? result.thumbnailUrl : undefined,
        subscribers: result.subscribers,
        views: result.views,
        videos: result.videos,
        recentVideos: result.recentVideos.filter(isVideoSummary),
        recentVideosWarning:
          typeof result.recentVideosWarning === "string"
            ? result.recentVideosWarning
            : undefined,
      })
    } catch (error) {
      setDiscoveryError(
        error instanceof Error ? error.message : "Channel analytics could not be loaded.",
      )
    } finally {
      setDiscoveryBusy(false)
    }
  }

  async function loadTrendingVideos() {
    setTrendingError("")
    setTrendingBusy(true)
    setTrendingVideos([])
    try {
      const response = await postYouTube({
        action: "trending",
        regionCode: trendingRegion,
        categoryId: trendingCategory,
      })
      const results = Array.isArray(response.videos)
        ? response.videos.filter(isVideoSummary)
        : []
      if (results.length === 0) {
        setTrendingError("YouTube returned no most-popular videos for these filters.")
      }
      setTrendingVideos(results)
    } catch (error) {
      setTrendingError(
        error instanceof Error
          ? error.message
          : "Trending videos could not be loaded.",
      )
    } finally {
      setTrendingBusy(false)
    }
  }

  function openVideoAnalysis(videoId: string) {
    setAnalysisInput(videoId)
    setAnalysisError("")
    setView("Video analyzer")
  }

  async function processFile(file: File | null) {
    setDatasetError("")
    if (!file) return
    if (file.size > maxUploadBytes) {
      setDatasetError("Files must be 8 MB or smaller.")
      return
    }
    if (!/\.(csv|tsv)$/i.test(file.name)) {
      setDatasetError("Choose a CSV or tab-separated (.tsv) file.")
      return
    }

    try {
      setDataset(analyzeDataset(await file.text(), file.name))
    } catch (error) {
      setDataset(null)
      setDatasetError(
        error instanceof Error ? error.message : "The dataset could not be analyzed.",
      )
    }
  }

  function refreshHistory() {
    setHistoryError("")
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(historyKey) ?? "[]")
      setHistory(Array.isArray(saved) ? saved.filter(isHistoryEntry).slice(0, 20) : [])
    } catch {
      setHistoryError("Saved browser history could not be read.")
    }
  }

  function exportReport() {
    if (!analysis) return
    const rows = [
      ["Metric", "Value"],
      ["Video", analysis.title],
      ["Channel", analysis.channelTitle],
      ["Video ID", analysis.id],
      ["Data source", analysis.source === "demo" ? "Sample demo" : "Live YouTube Data API"],
      ["Insight method", analysis.insightSource],
      ["Views", analysis.views],
      ["Likes", analysis.likes],
      ["Comments", analysis.comments],
      ["Engagement rate", formatPercentage(analysis.engagementRate)],
      ["Comments analyzed", analysis.commentsAnalyzed],
      ["Positive sentiment", analysis.sentiment ? `${analysis.sentiment.positive}%` : "Unavailable"],
      ["Neutral sentiment", analysis.sentiment ? `${analysis.sentiment.neutral}%` : "Unavailable"],
      ["Negative sentiment", analysis.sentiment ? `${analysis.sentiment.negative}%` : "Unavailable"],
      ["Audience insight", analysis.insightSummary],
      ...analysis.themes.map((theme, index) => [`Audience theme ${index + 1}`, theme]),
      ...analysis.recommendations.map((item, index) => [`Recommendation ${index + 1}`, item]),
      ...analysis.warnings.map((warning, index) => [`Warning ${index + 1}`, warning]),
    ]
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `engageiq-${analysis.id}-report.csv`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function setCompareInput(index: number, value: string) {
    setCompareInputs((current) =>
      current.map((input, currentIndex) =>
        currentIndex === index ? value : input,
      ),
    )
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    try {
      localStorage.setItem(themeKey, nextTheme)
    } catch {
      setHistoryError("The theme preference could not be saved in this browser.")
    }
  }

  return (
    <div className={`dashboard theme-${theme}`}>
      <Sidebar
        aiConfigured={aiConfigured}
        liveConfigured={liveConfigured}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onNavigate={navigate}
        statusUnavailable={statusUnavailable}
        view={view}
      />
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              className="icon-button navigation-toggle"
              onClick={() => setMobileOpen((open) => !open)}
              type="button"
            >
              {mobileOpen ? <Icon name="close" /> : <span className="menu-glyph"><i /><i /><i /></span>}
            </button>
            <div className="page-heading">
              <p>Workspace</p>
              <h1>{view}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              type="button"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
            </button>
            {analysis && (
              <button className="button button-outline export-button" onClick={exportReport} type="button">
                <Icon name="download" size={17} /> Export report
              </button>
            )}
          </div>
        </header>

        <main className="content">
          {view === "Overview" && (
            analysis ? (
              <AnalysisDashboard analysis={analysis} onNewAnalysis={startNewAnalysis} />
            ) : (
              <OverviewPanel
                aiConfigured={aiConfigured}
                busy={analysisBusy}
                error={analysisError}
                input={analysisInput}
                onDemo={showDemo}
                onInput={setAnalysisInput}
                onSubmit={submitAnalysis}
              />
            )
          )}
          {view === "Video analyzer" && (
            <VideoAnalyzerPanel
              busy={analysisBusy}
              error={analysisError}
              input={analysisInput}
              onInput={setAnalysisInput}
              onSubmit={submitAnalysis}
            />
          )}
          {view === "Compare videos" && (
            <ComparePanel
              busy={compareBusy}
              error={compareError}
              inputs={compareInputs}
              onAdd={() => setCompareInputs((current) => [...current, ""])}
              onCompare={compareVideos}
              onInput={setCompareInput}
              results={compareResults}
            />
          )}
          {view === "Data upload" && (
            <UploadPanel
              dataset={dataset}
              dragActive={dragActive}
              error={datasetError}
              inputRef={fileInputRef}
              onChoose={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                setDragActive(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setDragActive(false)
                void processFile(event.dataTransfer.files[0] ?? null)
              }}
              onFile={(file) => void processFile(file)}
            />
          )}
          {view === "Channel & search" && (
            <ChannelPanel
              busy={discoveryBusy}
              channel={channel}
              error={discoveryError}
              onChannel={() => void inspectChannel()}
              onAnalyzeVideo={openVideoAnalysis}
              onLoadTrending={() => void loadTrendingVideos()}
              onQuery={setSearchQuery}
              onSearch={searchVideos}
              onTrendingCategory={(value) => {
                setTrendingCategory(value)
                setTrendingVideos([])
                setTrendingError("")
              }}
              onTrendingRegion={(value) => {
                setTrendingRegion(value)
                setTrendingVideos([])
                setTrendingError("")
              }}
              query={searchQuery}
              trendingBusy={trendingBusy}
              trendingCategory={trendingCategory}
              trendingError={trendingError}
              trendingRegion={trendingRegion}
              trendingVideos={trendingVideos}
              videos={searchResults}
            />
          )}
          {view === "Analysis history" && (
            <HistoryPanel
              entries={history}
              error={historyError}
              onRefresh={refreshHistory}
            />
          )}
        </main>
      </div>
    </div>
  )
}
