// The schedule and inputs shared by the JavaScript benchmarks.

import { Schedule } from "../node.js";

export const HOLIDAYS = [
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04",
  "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03",
  "2027-05-31", "2027-08-30", "2027-12-27", "2027-12-28",
];

export function office(): Schedule {
  return new Schedule({
    timeZone: "Europe/London",
    rules: [
      { type: "workday", start: "09:00", end: "17:00" },
      { type: "break", start: "12:00", end: "13:00" },
      { type: "holidays", dates: HOLIDAYS },
    ],
  });
}

const MINUTE = 60_000;
const BASE = Date.UTC(2026, 0, 1);

/** The batch case's pairs, in milliseconds since the epoch. */
export function pairs(n: number): [starts: Float64Array, ends: Float64Array] {
  const starts = new Float64Array(n);
  const ends = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    starts[i] = BASE + ((i * 7919) % 525_600) * MINUTE;
    ends[i] = starts[i] + ((i * 104_729) % 10_080) * MINUTE;
  }
  return [starts, ends];
}
