// The three cases from `benchmarks/README.md`, against the Node build.
//
//   npm run build:node && node bench/bench.js [results.json]

import { writeFileSync } from "node:fs";
import { Bench } from "tinybench";

import { Schedule } from "../node.js";

const HOLIDAYS = [
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04",
  "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03",
  "2027-05-31", "2027-08-30", "2027-12-27", "2027-12-28",
];

const office = new Schedule({
  timeZone: "Europe/London",
  rules: [
    { type: "workday", start: "09:00", end: "17:00" },
    { type: "break", start: "12:00", end: "13:00" },
    { type: "holidays", dates: HOLIDAYS },
  ],
});

const MINUTE = 60_000;
const BASE = Date.UTC(2026, 0, 1);
const PAIRS = 1_000_000;
const starts = new Float64Array(PAIRS);
const ends = new Float64Array(PAIRS);
for (let i = 0; i < PAIRS; i++) {
  starts[i] = BASE + ((i * 7919) % 525_600) * MINUTE;
  ends[i] = starts[i] + ((i * 104_729) % 10_080) * MINUTE;
}
const startDates = Array.from(starts, (t) => new Date(t));
const endDates = Array.from(ends, (t) => new Date(t));

const calls = new Bench({ retainSamples: true, time: 2000 });
const single = [new Date("2026-03-10T10:15:00Z"), new Date("2026-03-10T15:45:00Z")];
const year = [new Date("2026-01-01T00:00:00Z"), new Date("2027-01-01T00:00:00Z")];
calls.add("single", () => office.between(...single));
calls.add("year", () => office.between(...year));

const batches = new Bench({ retainSamples: true, iterations: 5, time: 0 });
batches.add("batch: between in a loop", () => {
  for (let i = 0; i < PAIRS; i++) {
    office.between(startDates[i], endDates[i]);
  }
});
batches.add("batch: betweenMany, Dates", () => office.betweenMany(startDates, endDates));
batches.add("batch: betweenMany, Float64Array", () => office.betweenMany(starts, ends));

const results = [];
for (const bench of [calls, batches]) {
  await bench.run();
  for (const task of bench.tasks) {
    const latency = task.result.latency;
    results.push({
      name: task.name,
      median_ms: latency.p50,
      p95_ms: percentile(latency.samples, 0.95),
      samples: latency.samplesCount,
    });
  }
}
console.table(results);
if (process.argv[2]) {
  writeFileSync(process.argv[2], `${JSON.stringify(results, null, 2)}\n`);
}

/** Linear interpolation between the closest ranks, as NumPy does by default. */
function percentile(sorted, q) {
  const rank = (sorted.length - 1) * q;
  const low = Math.floor(rank);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}
