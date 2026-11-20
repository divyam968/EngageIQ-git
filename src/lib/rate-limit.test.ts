import { describe, expect, it } from "vitest"
import { checkRequestRateLimit } from "./rate-limit"

describe("checkRequestRateLimit", () => {
  it("blocks requests above the window limit and allows them again after expiry", () => {
    const key = `rate-limit-test-${Date.now()}`
    const start = Date.now()

    expect(checkRequestRateLimit(key, 2, start).allowed).toBe(true)
    expect(checkRequestRateLimit(key, 2, start + 1).allowed).toBe(true)
    expect(checkRequestRateLimit(key, 2, start + 2)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    })
    expect(checkRequestRateLimit(key, 2, start + 60_000).allowed).toBe(true)
  })
})
