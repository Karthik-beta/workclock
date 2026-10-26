// The standard-library baseline in bench/ must agree with workclock.

import { describe, expect, test } from "vitest";

import { office, pairs } from "../bench/cases.ts";
import { between } from "../bench/stdlib.ts";

describe.skipIf(typeof Temporal === "undefined")("Temporal baseline", () => {
  const schedule = office();

  test.each([
    ["single", "2026-03-10T10:15:00Z", "2026-03-10T15:45:00Z"],
    ["year", "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z"],
    ["spring forward", "2026-03-27T16:00:00Z", "2026-03-30T10:00:00Z"],
    ["fall back", "2026-10-23T16:00:00Z", "2026-10-26T10:00:00Z"],
    ["easter", "2026-04-02T23:30:00Z", "2026-04-07T08:00:00Z"],
    ["reversed", "2026-03-10T15:45:00Z", "2026-03-09T10:15:00Z"],
  ])("matches workclock: %s", (_, a, b) => {
    expect(between(new Date(a), new Date(b))).toBe(schedule.between(a, b));
  });

  test("matches workclock on the batch pairs", () => {
    const [starts, ends] = pairs(10_000);
    const expected = Array.from(schedule.betweenMany(starts, ends));
    expect(Array.from(starts, (a, i) => between(new Date(a), new Date(ends[i])))).toEqual(expected);
  });
});
