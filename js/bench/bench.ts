// The three cases from `benchmarks/README.md`, against the Node build and
// against `stdlib.ts`, a hand-written loop over Temporal. Needs Node.js 26.
//
//   npm run build:node && node bench/bench.ts [results.json]

import { writeFileSync } from "node:fs";
import { Bench } from "tinybench";

import { office as schedule, pairs } from "./cases.ts";
import * as stdlib from "./stdlib.ts";

const office = schedule();
const PAIRS = 1_000_000;
const [starts, ends] = pairs(PAIRS);
const startDates = Array.from(starts, (t) => new Date(t));
const endDates = Array.from(ends, (t) => new Date(t));

const calls = new Bench({ retainSamples: true, time: 2000 });
const single = [new Date("2026-03-10T10:15:00Z"), new Date("2026-03-10T15:45:00Z")] as const;
const year = [new Date("2026-01-01T00:00:00Z"), new Date("2027-01-01T00:00:00Z")] as const;
calls.add("single", () => office.between(...single));
calls.add("single: stdlib", () => stdlib.between(...single));
calls.add("year", () => office.between(...year));
calls.add("year: stdlib", () => stdlib.between(...year));

const batches = new Bench({ retainSamples: true, iterations: 5, time: 0 });
batches.add("batch: between in a loop", () => {
  for (let i = 0; i < PAIRS; i++) {
    office.between(startDates[i], endDates[i]);
  }
});
batches.add("batch: betweenMany, Dates", () => office.betweenMany(startDates, endDates));
batches.add("batch: betweenMany, Float64Array", () => office.betweenMany(starts, ends));
batches.add("batch: stdlib", () => {
  for (let i = 0; i < PAIRS; i++) {
    stdlib.between(startDates[i], endDates[i]);
  }
});

const results = [];
for (const bench of [calls, batches]) {
  await bench.run();
  for (const task of bench.tasks) {
    const result = task.result;
    if (result.state === "errored") {
      throw result.error;
    }
    if (result.state !== "completed") {
      throw new Error(`${task.name}: ${result.state}`);
    }
    const latency = result.latency;
    results.push({
      name: task.name,
      median_ms: latency.p50,
      p95_ms: percentile(latency.samples!, 0.95),
      samples: latency.samplesCount,
    });
  }
}
console.table(results);
if (process.argv[2]) {
  writeFileSync(process.argv[2], `${JSON.stringify(results, null, 2)}\n`);
}

/** Linear interpolation between the closest ranks, as NumPy does by default. */
function percentile(sorted: readonly number[], q: number): number {
  const rank = (sorted.length - 1) * q;
  const low = Math.floor(rank);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}
