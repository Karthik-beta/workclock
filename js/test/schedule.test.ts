import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
  NoWorkingTimeError,
  OutOfRangeError,
  Schedule,
  UnknownZoneError,
  WorkclockError,
} from "../node.js";
import { initSync, Schedule as WebSchedule } from "../web.js";

const HOUR = 3_600_000;

const office = new Schedule({
  timeZone: "Europe/London",
  rules: [
    { type: "workday", start: "09:00", end: "17:00" },
    { type: "break", start: "12:00", end: "13:00" },
    { type: "holidays", dates: ["2026-12-25"] },
  ],
});

const always = new Schedule({
  rules: [
    {
      type: "workday",
      start: "00:00",
      end: "00:00",
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  ],
});

describe("between", () => {
  test("counts working time in milliseconds", () => {
    expect(office.between("2026-01-05T09:00:00Z", "2026-01-06T09:00:00Z")).toBe(7 * HOUR);
  });

  test("is negative when the end is before the start", () => {
    expect(office.between("2026-01-06T09:00:00Z", "2026-01-05T09:00:00Z")).toBe(-7 * HOUR);
  });

  test("accepts Dates and strings with any offset", () => {
    const start = new Date("2026-01-05T09:00:00Z");
    expect(office.between(start, "2026-01-05T13:00:00+02:00")).toBe(2 * HOUR);
  });

  test("skips holidays", () => {
    expect(office.between("2026-12-24T00:00:00Z", "2026-12-26T00:00:00Z")).toBe(7 * HOUR);
  });

  test("follows daylight saving time", () => {
    expect(office.between("2026-07-06T08:00:00Z", "2026-07-06T16:00:00Z")).toBe(7 * HOUR);
  });

  test("evaluates a rule in its own time zone", () => {
    const newYork = new Schedule({
      rules: [{ type: "workday", start: "09:00", end: "17:00", timeZone: "America/New_York" }],
    });
    expect(newYork.between("2026-01-05T00:00:00Z", "2026-01-05T14:00:00Z")).toBe(0);
    expect(newYork.between("2026-01-05T00:00:00Z", "2026-01-06T00:00:00Z")).toBe(8 * HOUR);
  });

  test("uses the given days of the week", () => {
    const weekends = new Schedule({
      rules: [{ type: "workday", start: "10:00", end: "14:00", days: ["sat", "sun"] }],
    });
    expect(weekends.between("2026-01-05T00:00:00Z", "2026-01-12T00:00:00Z")).toBe(8 * HOUR);
  });
});

describe("add and sub", () => {
  test("add returns the Date that much working time later", () => {
    const due = office.add("2026-01-09T16:00:00Z", 2 * HOUR);
    expect(due).toBeInstanceOf(Date);
    expect(due.toISOString()).toBe("2026-01-12T10:00:00.000Z");
  });

  test("sub returns the Date that much working time earlier", () => {
    const start = office.sub(new Date("2026-01-12T10:00:00Z"), 2 * HOUR);
    expect(start.toISOString()).toBe("2026-01-09T16:00:00.000Z");
  });

  test("a negative amount goes the other way", () => {
    expect(office.add("2026-01-12T10:00:00Z", -2 * HOUR).toISOString()).toBe(
      "2026-01-09T16:00:00.000Z",
    );
  });

  test("zero returns the same instant", () => {
    expect(office.add("2026-01-10T03:00:00Z", 0).toISOString()).toBe("2026-01-10T03:00:00.000Z");
  });
});

describe("periods", () => {
  test("nextPeriod starts at the instant when it is inside working time", () => {
    const { start, end } = office.nextPeriod("2026-01-05T10:00:00Z");
    expect([start.toISOString(), end.toISOString()]).toEqual([
      "2026-01-05T10:00:00.000Z",
      "2026-01-05T12:00:00.000Z",
    ]);
  });

  test("nextPeriod finds the next stretch from a break", () => {
    const { start, end } = office.nextPeriod("2026-01-05T12:30:00Z");
    expect([start.toISOString(), end.toISOString()]).toEqual([
      "2026-01-05T13:00:00.000Z",
      "2026-01-05T17:00:00.000Z",
    ]);
  });

  test("previousPeriod finds the last stretch before a break", () => {
    const { start, end } = office.previousPeriod("2026-01-05T12:30:00Z");
    expect([start.toISOString(), end.toISOString()]).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-05T12:00:00.000Z",
    ]);
  });
});

describe("errors", () => {
  test("an unknown time zone throws UnknownZoneError", () => {
    const build = () =>
      new Schedule({
        timeZone: "Mars/Olympus_Mons",
        rules: [{ type: "workday", start: "09:00", end: "17:00" }],
      });
    expect(build).toThrow(UnknownZoneError);
    expect(build).toThrow(WorkclockError);
    expect(build).not.toThrow(NoWorkingTimeError);
    expect(build).toThrow("unknown time zone `Mars/Olympus_Mons`");
  });

  test("errors carry a name and a kind", () => {
    let error: unknown;
    try {
      new Schedule({ timeZone: "Nowhere", rules: [] });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: "UnknownZoneError", kind: "unknown_zone" });
  });

  test("a schedule without working time throws NoWorkingTimeError", () => {
    const build = () =>
      new Schedule({
        rules: [
          { type: "workday", start: "09:00", end: "17:00" },
          { type: "break", start: "09:00", end: "17:00" },
        ],
      });
    expect(build).toThrow(NoWorkingTimeError);
    expect(build).toThrow(WorkclockError);
  });

  test("a result past the supported range throws OutOfRangeError", () => {
    expect(() => always.add("9999-12-30T00:00:00Z", 48 * HOUR)).toThrow(OutOfRangeError);
    expect(() => always.sub("-009999-01-03T00:00:00Z", 48 * HOUR)).toThrow(OutOfRangeError);
  });

  test("a Date past the supported range throws OutOfRangeError", () => {
    expect(() => always.add(new Date(8.64e15), 0)).toThrow(OutOfRangeError);
  });

  test.each([
    ["WorkclockError", WorkclockError, "unknown"],
    ["NoWorkingTimeError", NoWorkingTimeError, "no_working_time"],
    ["OutOfRangeError", OutOfRangeError, "out_of_range"],
    ["UnknownZoneError", UnknownZoneError, "unknown_zone"],
  ] as const)("a constructed %s has its name and kind", (name, Class, kind) => {
    const error = new Class("x");
    expect(error).toBeInstanceOf(Class);
    expect(error).toBeInstanceOf(WorkclockError);
    expect(error).toMatchObject({ name, kind, message: "x" });
    for (const Other of [NoWorkingTimeError, OutOfRangeError, UnknownZoneError]) {
      if (Other !== Class) {
        expect(error).not.toBeInstanceOf(Other);
      }
    }
  });

  test("other errors are not WorkclockErrors", () => {
    expect(new Error("x")).not.toBeInstanceOf(WorkclockError);
    expect(Object.assign(new Error("x"), { kind: "other" })).not.toBeInstanceOf(WorkclockError);
    expect({ kind: "out_of_range" }).not.toBeInstanceOf(OutOfRangeError);
  });

  test("errors from the web build match the same classes", () => {
    initSync({ module: readFileSync(new URL("../pkg/web/workclock_bg.wasm", import.meta.url)) });
    expect(() => new WebSchedule({ timeZone: "Nowhere", rules: [] })).toThrow(UnknownZoneError);
  });
});

describe("malformed input", () => {
  const workday = { type: "workday", start: "09:00", end: "17:00" } as const;

  test.each([
    // @ts-expect-error options are required
    () => new Schedule(),
    // @ts-expect-error rules are required
    () => new Schedule({}),
    // @ts-expect-error unknown rule type
    () => new Schedule({ rules: [{ type: "shift", start: "09:00", end: "17:00" }] }),
    // @ts-expect-error start must be a string
    () => new Schedule({ rules: [{ ...workday, start: 9 }] }),
    // @ts-expect-error dates must be an array
    () => new Schedule({ rules: [{ type: "holidays", dates: "2026-12-25" }] }),
    // @ts-expect-error instants are Dates or strings
    () => office.between(0, "2026-01-05T09:00:00Z"),
  ])("throws TypeError: %s", (call) => {
    expect(call).toThrow(TypeError);
  });

  test.each([
    () => new Schedule({ rules: [{ ...workday, start: "9am" }] }),
    // @ts-expect-error unknown day name
    () => new Schedule({ rules: [{ ...workday, days: ["monday"] }] }),
    () => new Schedule({ rules: [{ type: "holidays", dates: ["25/12/2026"] }] }),
    () => office.between("2026-01-05T09:00:00", "2026-01-06T09:00:00Z"),
    () => office.between("2026-01-05T09:00:00.0001Z", "2026-01-06T09:00:00Z"),
    () => office.between(new Date(Number.NaN), "2026-01-06T09:00:00Z"),
    () => office.add("2026-01-05T09:00:00Z", 1.5),
    () => office.add("2026-01-05T09:00:00Z", Number.NaN),
  ])("throws RangeError: %s", (call) => {
    expect(call).toThrow(RangeError);
  });

  test("a rule time below a millisecond throws RangeError", () => {
    const build = () => new Schedule({ rules: [{ ...workday, start: "09:00:00.0005" }] });
    expect(build).toThrow(RangeError);
    expect(build).toThrow("`start` has digits below a millisecond");
  });
});
