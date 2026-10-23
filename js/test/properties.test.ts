// Property tests: the engine against the oracle on random schedules, around
// the 2026 DST transitions of zones with whole-hour, half-hour and odd
// offsets.

import fc from "fast-check";
import { describe, expect, test } from "vitest";

import { Schedule, type Weekday } from "../node.js";
import { type HolidaySpec, type RuleSpec, scheduleOptions, type ScheduleSpec } from "./support/fixture.js";
import { Oracle } from "./support/oracle.js";

const MINUTE = 60_000;
const DAY = 86_400_000;
const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const ZONES = [
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Santiago",
  "Asia/Kolkata",
  "Australia/Lord_Howe",
  "Pacific/Chatham",
];
const WINDOW_START = Date.UTC(2026, 2, 1);
const WINDOW_DAYS = 45;

const zone = fc.constantFrom(...ZONES);

const time = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.constantFrom(0, 15, 30, 45))
  .map(([h, m]) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

const rule: fc.Arbitrary<RuleSpec> = fc.record(
  {
    start: time,
    end: time,
    days: fc.subarray(WEEKDAYS, { minLength: 1 }),
    zone,
  },
  { requiredKeys: ["start", "end", "days"] },
);

const day = fc
  .integer({ min: 0, max: WINDOW_DAYS })
  .map((d) => new Date(WINDOW_START + d * DAY).toISOString().slice(0, 10));

const holidays: fc.Arbitrary<HolidaySpec> = fc.record(
  { dates: fc.uniqueArray(day, { minLength: 1, maxLength: 4 }), zone },
  { requiredKeys: ["dates"] },
);

const spec: fc.Arbitrary<ScheduleSpec> = fc.record({
  zone,
  workdays: fc.array(rule, { minLength: 1, maxLength: 2 }),
  breaks: fc.array(rule, { maxLength: 2 }),
  holidays: fc.array(holidays, { maxLength: 1 }),
});

const instant = fc.integer({ min: 0, max: WINDOW_DAYS * 24 * 60 }).map((m) => WINDOW_START + m * MINUTE);

const minutes = (max: number) => fc.integer({ min: -max, max }).map((m) => m * MINUTE);

type Built = { engine: Schedule; oracle: Oracle };

/** Both implementations, or neither when the spec has no working time. */
function build(s: ScheduleSpec): Built | undefined {
  const engine = attempt(() => new Schedule(scheduleOptions(s)));
  const oracle = attempt(() => Oracle.build(s));
  expect(kind(engine)).toBe(kind(oracle));
  return engine instanceof Schedule && oracle instanceof Oracle ? { engine, oracle } : undefined;
}

function attempt<T>(f: () => T): T | { error: string } {
  try {
    return f();
  } catch (error) {
    const kind = (error as { kind?: unknown }).kind;
    if (typeof kind === "string") {
      return { error: kind };
    }
    throw error;
  }
}

function kind(result: unknown): string | undefined {
  return (result as { error?: string }).error;
}

describe("the engine agrees with the oracle", () => {
  test("between", () => {
    fc.assert(
      fc.property(spec, instant, minutes(10 * 24 * 60), (s, a, d) => {
        const built = build(s);
        if (built !== undefined) {
          expect(built.engine.between(new Date(a), new Date(a + d))).toBe(built.oracle.between(a, a + d));
        }
      }),
    );
  });

  test("add", () => {
    fc.assert(
      fc.property(spec, instant, minutes(3 * 24 * 60), (s, t, d) => {
        const built = build(s);
        if (built !== undefined) {
          const engine = attempt(() => built.engine.add(new Date(t), d).getTime());
          expect(engine).toEqual(attempt(() => built.oracle.add(t, d)));
        }
      }),
    );
  });

  test("sub", () => {
    fc.assert(
      fc.property(spec, instant, minutes(3 * 24 * 60), (s, t, d) => {
        const built = build(s);
        if (built !== undefined) {
          const engine = attempt(() => built.engine.sub(new Date(t), d).getTime());
          expect(engine).toEqual(attempt(() => built.oracle.sub(t, d)));
        }
      }),
    );
  });
});

describe("engine invariants", () => {
  test("between undoes add", () => {
    fc.assert(
      fc.property(spec, instant, minutes(5 * 24 * 60), (s, t, d) => {
        const built = build(s);
        if (built !== undefined) {
          const result = built.engine.add(new Date(t), d);
          expect(built.engine.between(new Date(t), result)).toBe(d);
        }
      }),
    );
  });

  test("nextPeriod is working time from t or later", () => {
    fc.assert(
      fc.property(spec, instant, (s, t) => {
        const built = build(s);
        if (built !== undefined) {
          const { start, end } = built.engine.nextPeriod(new Date(t));
          expect(start.getTime()).toBeGreaterThanOrEqual(t);
          expect(built.engine.between(start, end)).toBe(end.getTime() - start.getTime());
          expect(built.engine.between(new Date(t), start)).toBe(0);
        }
      }),
    );
  });
});
