// `between` for the benchmark schedule, written with the standard library
// only: the loop a developer would write with Temporal and no library. It
// walks the local dates from `a` to `b` and adds the overlap with each working
// day's hours. It knows only this one schedule. Temporal needs Node.js 26.

import { HOLIDAYS } from "./cases.ts";

const LONDON = "Europe/London";
const HOURS = [["09:00", "12:00"], ["13:00", "17:00"]];
const CLOSED = new Set(HOLIDAYS);

export function between(a: Date, b: Date): number {
  if (b < a) {
    // Not `-x`, which would give -0 where workclock gives 0.
    return 0 - between(b, a);
  }
  const start = a.getTime();
  const end = b.getTime();
  const last = localDate(end);
  let total = 0;
  for (let day = localDate(start); Temporal.PlainDate.compare(day, last) <= 0; day = day.add({ days: 1 })) {
    if (day.dayOfWeek > 5 || CLOSED.has(day.toString())) {
      continue;
    }
    for (const [open, close] of HOURS) {
      const s = Math.max(start, day.toZonedDateTime({ timeZone: LONDON, plainTime: open }).epochMilliseconds);
      const e = Math.min(end, day.toZonedDateTime({ timeZone: LONDON, plainTime: close }).epochMilliseconds);
      if (s < e) {
        total += e - s;
      }
    }
  }
  return total;
}

function localDate(epochMilliseconds: number): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(epochMilliseconds).toZonedDateTimeISO(LONDON).toPlainDate();
}
