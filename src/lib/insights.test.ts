import { describe, expect, it } from "vitest"
import {
  buildRuleBasedInsights,
  percentagesFromCounts,
} from "./insights"
import { calculateEngagementRate, parseYouTubeVideoId } from "./youtube"

describe("YouTube metrics and audience insights", () => {
  it("calculates engagement only when every required public metric is available", () => {
    expect(calculateEngagementRate(1000, 40, 10)).toBe(5)
    expect(calculateEngagementRate(1000, null, 10)).toBeNull()
    expect(calculateEngagementRate(0, 0, 0)).toBeNull()
  })

  it("accepts supported YouTube URL forms and rejects unrelated hosts", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ")
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    )
    expect(parseYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull()
  })

  it("creates transparent rule-based sentiment and themes from supplied comments", () => {
    const insight = buildRuleBasedInsights(
      {
        views: 1000,
        likes: 40,
        comments: 10,
        engagementRate: 5,
      },
      [
        "Amazing camera work and great story",
        "Amazing story, I love this",
        "The pacing is boring",
        "I expected more detail",
      ],
    )

    expect(insight.sentiment).toMatchObject({
      positive: 50,
      neutral: 25,
      negative: 25,
      total: 4,
    })
    expect(insight.themes).toContain("amazing")
    expect(insight.summary).toContain("keyword-based")
    expect(insight.recommendations.length).toBeGreaterThan(0)
  })

  it("returns no sentiment when there are no comments and rejects invalid model counts", () => {
    const insight = buildRuleBasedInsights(
      { views: 10, likes: 1, comments: 0, engagementRate: 10 },
      [],
    )

    expect(insight.sentiment).toBeNull()
    expect(percentagesFromCounts(
      { positive: 3, neutral: 0, negative: 0 },
      2,
    )).toBeNull()
  })
})
