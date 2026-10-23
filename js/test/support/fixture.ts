// Loader for `tests/fixtures/design_examples.json`.

import { readFileSync } from "node:fs";

import type { Rule, ScheduleOptions, Weekday } from "../../node.js";

export type ErrorKind = "no_working_time" | "out_of_range" | "unknown_zone";

export interface RuleSpec {
  start: string;
  end: string;
  days: Weekday[];
  zone?: string;
}

export interface HolidaySpec {
  dates?: string[];
  ranges?: [string, string][];
  zone?: string;
}

export interface ScheduleSpec {
  zone: string;
  workdays?: RuleSpec[];
  breaks?: RuleSpec[];
  holidays?: HolidaySpec[];
}

export type Op =
  | { op: "between"; a: string; b: string }
  | { op: "add" | "sub"; t: string; seconds: number }
  | { op: "build" };

export type Expect = { seconds: number } | { instant: string } | { error: ErrorKind };

export type Case = Op & { id: string; schedule: string; expect: Expect };

export interface Fixture {
  schedules: Record<string, ScheduleSpec>;
  cases: Case[];
}

const PATH = new URL("../../../tests/fixtures/design_examples.json", import.meta.url);

export function load(): Fixture {
  return JSON.parse(readFileSync(PATH, "utf8")) as Fixture;
}

/** Every date listed or inside a range, as `YYYY-MM-DD`. */
export function allDates(holidays: HolidaySpec): string[] {
  const dates = new Set(holidays.dates);
  for (const [start, end] of holidays.ranges ?? []) {
    for (let d = Date.parse(start); d <= Date.parse(end); d += 86_400_000) {
      dates.add(new Date(d).toISOString().slice(0, 10));
    }
  }
  return [...dates];
}

export function scheduleOptions(spec: ScheduleSpec): ScheduleOptions {
  const hours = (type: "workday" | "break") => (r: RuleSpec): Rule => ({
    type,
    start: r.start,
    end: r.end,
    days: r.days,
    ...(r.zone === undefined ? {} : { timeZone: r.zone }),
  });
  return {
    timeZone: spec.zone,
    rules: [
      ...(spec.workdays ?? []).map(hours("workday")),
      ...(spec.breaks ?? []).map(hours("break")),
      ...(spec.holidays ?? []).map(
        (h): Rule => ({
          type: "holidays",
          dates: allDates(h),
          ...(h.zone === undefined ? {} : { timeZone: h.zone }),
        }),
      ),
    ],
  };
}
