import { describe, expect, it } from "vitest"
import { analyzeDataset } from "./dataset"

describe("analyzeDataset", () => {
  it("aggregates quoted CSV counts and calculates engagement from real columns", () => {
    const result = analyzeDataset(
      'video,views,likes,comments,title\r\nv1,"1,000",50,25,"A, quoted title"\r\nv2,2000,100,50,Second',
      "metrics.csv",
    )

    expect(result).toMatchObject({
      rowCount: 2,
      totalViews: 3000,
      totalLikes: 150,
      totalComments: 75,
      engagementRate: 7.5,
    })
    expect(result.preview[0][4]).toBe("A, quoted title")
  })

  it("parses tab-separated data", () => {
    const result = analyzeDataset(
      "video\tviews\tlikes\tcomments\nv1\t1000\t20\t5",
      "metrics.tsv",
    )

    expect(result.totalViews).toBe(1000)
    expect(result.engagementRate).toBe(2.5)
  })

  it("rejects incomplete or nonnumeric metric columns instead of treating them as zero", () => {
    expect(() =>
      analyzeDataset("views,likes\n100,5", "incomplete.csv"),
    ).toThrow(/views, likes, and comments/i)

    expect(() =>
      analyzeDataset("views,likes,comments\n100,unknown,5", "invalid.csv"),
    ).toThrow(/row 2.*likes/i)
  })

  it("reports an unavailable engagement rate when views are zero", () => {
    const result = analyzeDataset(
      "views,likes,comments\n0,0,0",
      "zero-views.csv",
    )

    expect(result.engagementRate).toBeNull()
  })

  it("rejects an unclosed quoted field", () => {
    expect(() =>
      analyzeDataset('views,likes,comments\n100,5,"unfinished', "broken.csv"),
    ).toThrow(/unclosed quoted field/i)
  })
})
