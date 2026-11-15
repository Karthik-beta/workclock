import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
  NoWorkingTimeError,
  OutOfRangeError,
  type Period,
  type Rule,
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

  test("accepts options declared as const", () => {
    const options = {
      rules: [
        { type: "workday", start: "10:00", end: "14:00", days: ["sat", "sun"] },
        { type: "holidays", dates: ["2026-01-10"] },
      ],
    } as const;
    expect(new Schedule(options).between("2026-01-05T00:00:00Z", "2026-01-12T00:00:00Z")).toBe(
      4 * HOUR,
    );
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

describe("special days", () => {
  const weekdays = { type: "workday", start: "09:00", end: "17:00" } as const;
  const iso = ({ start, end }: Period) => [start.toISOString(), end.toISOString()];

  test("replace the hours of their dates", () => {
    // S1, S2, S3
    const schedule = new Schedule({
      rules: [weekdays, { type: "specialday", start: "08:00", end: "12:00", dates: ["2026-01-07"] }],
    });
    expect(schedule.between("2026-01-07T00:00:00Z", "2026-01-08T00:00:00Z")).toBe(4 * HOUR);
    expect(schedule.add("2026-01-06T16:00:00Z", 2 * HOUR).toISOString()).toBe(
      "2026-01-07T09:00:00.000Z",
    );
    expect(schedule.sub("2026-01-08T10:00:00Z", 2 * HOUR).toISOString()).toBe(
      "2026-01-07T11:00:00.000Z",
    );
  });

  test("make a weekend date a working date", () => {
    // S4, S5
    const schedule = new Schedule({
      rules: [weekdays, { type: "specialday", start: "10:00", end: "14:00", dates: ["2026-01-10"] }],
    });
    expect(schedule.between("2026-01-09T16:00:00Z", "2026-01-12T10:00:00Z")).toBe(6 * HOUR);
    expect(schedule.add("2026-01-09T17:00:00Z", 2 * HOUR).toISOString()).toBe(
      "2026-01-10T12:00:00.000Z",
    );
  });

  test("keep the night shift that runs into their date", () => {
    // S6, S7, S8
    const schedule = new Schedule({
      rules: [
        { type: "workday", start: "22:00", end: "06:00" },
        { type: "specialday", start: "22:00", end: "02:00", dates: ["2026-01-06"] },
      ],
    });
    expect(schedule.between("2026-01-06T00:00:00Z", "2026-01-06T06:00:00Z")).toBe(6 * HOUR);
    expect(schedule.between("2026-01-06T22:00:00Z", "2026-01-07T06:00:00Z")).toBe(4 * HOUR);
    expect(schedule.add("2026-01-06T05:00:00Z", 2 * HOUR).toISOString()).toBe(
      "2026-01-06T23:00:00.000Z",
    );
  });

  test("keep their breaks", () => {
    // S9, S10
    const schedule = new Schedule({
      rules: [
        weekdays,
        { type: "break", start: "12:00", end: "13:00" },
        { type: "specialday", start: "08:00", end: "14:00", dates: ["2026-01-07"] },
      ],
    });
    expect(schedule.between("2026-01-07T00:00:00Z", "2026-01-08T00:00:00Z")).toBe(5 * HOUR);
    expect(iso(schedule.nextPeriod("2026-01-07T12:30:00Z"))).toEqual([
      "2026-01-07T13:00:00.000Z",
      "2026-01-07T14:00:00.000Z",
    ]);
  });

  test("are not worked on a holiday", () => {
    // S11, S12
    const schedule = new Schedule({
      rules: [
        weekdays,
        { type: "holidays", dates: ["2026-01-07"] },
        { type: "specialday", start: "08:00", end: "12:00", dates: ["2026-01-07"] },
      ],
    });
    expect(schedule.between("2026-01-07T00:00:00Z", "2026-01-08T00:00:00Z")).toBe(0);
    expect(schedule.add("2026-01-06T16:00:00Z", 2 * HOUR).toISOString()).toBe(
      "2026-01-08T10:00:00.000Z",
    );
  });

  test("on the same date add up", () => {
    // S13, S14, S15
    const schedule = new Schedule({
      rules: [
        { type: "specialday", start: "14:00", end: "18:00", dates: ["2026-01-07"] },
        weekdays,
        { type: "specialday", start: "08:00", end: "12:00", dates: ["2026-01-07"] },
      ],
    });
    expect(schedule.between("2026-01-07T00:00:00Z", "2026-01-08T00:00:00Z")).toBe(8 * HOUR);
    expect(iso(schedule.nextPeriod("2026-01-07T12:00:00Z"))).toEqual([
      "2026-01-07T14:00:00.000Z",
      "2026-01-07T18:00:00.000Z",
    ]);
    expect(iso(schedule.previousPeriod("2026-01-07T14:00:00Z"))).toEqual([
      "2026-01-07T08:00:00.000Z",
      "2026-01-07T12:00:00.000Z",
    ]);
  });

  test("follow daylight saving time", () => {
    // S16, S17
    const schedule = new Schedule({
      timeZone: "America/New_York",
      rules: [
        weekdays,
        { type: "specialday", start: "01:00", end: "05:00", dates: ["2026-03-08", "2026-11-01"] },
      ],
    });
    expect(schedule.between("2026-03-08T00:00:00-05:00", "2026-03-09T00:00:00-04:00")).toBe(
      3 * HOUR,
    );
    expect(schedule.between("2026-11-01T00:00:00-04:00", "2026-11-02T00:00:00-05:00")).toBe(
      5 * HOUR,
    );
  });

  test("replace a shift by its date in the workday's own time zone", () => {
    // S18
    // The hours do not overlap, so only the date can remove the Kolkata shift.
    const schedule = new Schedule({
      timeZone: "Asia/Kolkata",
      rules: [
        weekdays,
        {
          type: "specialday",
          start: "10:00",
          end: "12:00",
          dates: ["2026-01-07"],
          timeZone: "America/New_York",
        },
      ],
    });
    expect(schedule.between("2026-01-07T00:00:00Z", "2026-01-08T00:00:00Z")).toBe(2 * HOUR);
  });

  test("ignore duplicate dates, and change nothing without dates", () => {
    const schedule = new Schedule({
      rules: [
        weekdays,
        { type: "specialday", start: "08:00", end: "12:00", dates: ["2026-01-07", "2026-01-07"] },
        { type: "specialday", start: "00:00", end: "00:00", dates: [] },
      ],
    });
    expect(schedule.between("2026-01-05T00:00:00Z", "2026-01-12T00:00:00Z")).toBe(36 * HOUR);
  });

  test("lengthen the search bound by a week per date", () => {
    // S20, S21
    const mondays = Array.from({ length: 62 }, (_, i) =>
      new Date(Date.UTC(2026, 0, 12 + 7 * i)).toISOString().slice(0, 10),
    );
    const schedule = new Schedule({
      rules: [
        { ...weekdays, days: ["mon"] },
        { type: "break", start: "12:00", end: "13:00", days: ["mon"] },
        { type: "specialday", start: "12:00", end: "13:00", dates: mondays },
      ],
    });
    expect(schedule.add("2026-01-06T00:00:00Z", HOUR).toISOString()).toBe(
      "2027-03-22T10:00:00.000Z",
    );
    expect(schedule.sub("2027-03-22T09:00:00Z", HOUR).toISOString()).toBe(
      "2026-01-05T16:00:00.000Z",
    );
  });

  test("can be overnight, and last 24 hours when start equals end", () => {
    const schedule = new Schedule({
      rules: [
        weekdays,
        { type: "specialday", start: "22:00", end: "02:00", dates: ["2026-01-10"] },
        { type: "specialday", start: "00:00", end: "00:00", dates: ["2026-01-17"] },
      ],
    });
    expect(iso(schedule.nextPeriod("2026-01-10T00:00:00Z"))).toEqual([
      "2026-01-10T22:00:00.000Z",
      "2026-01-11T02:00:00.000Z",
    ]);
    expect(schedule.between("2026-01-10T00:00:00Z", "2026-01-12T00:00:00Z")).toBe(4 * HOUR);
    expect(iso(schedule.nextPeriod("2026-01-16T18:00:00Z"))).toEqual([
      "2026-01-17T00:00:00.000Z",
      "2026-01-18T00:00:00.000Z",
    ]);
  });

  test("do not depend on the order of the rules", () => {
    const rules = [
      weekdays,
      { type: "break", start: "12:00", end: "13:00" },
      { type: "specialday", start: "08:00", end: "12:00", dates: ["2026-01-07"] },
      { type: "specialday", start: "22:00", end: "02:00", dates: ["2026-01-10"] },
      { type: "holidays", dates: ["2026-01-08"] },
    ] as const;
    const forward = new Schedule({ rules });
    const backward = new Schedule({ rules: [...rules].reverse() });
    for (const t of ["2026-01-06T10:00:00Z", "2026-01-07T11:00:00Z", "2026-01-10T23:00:00Z"]) {
      expect(backward.add(t, 5 * HOUR).getTime()).toBe(forward.add(t, 5 * HOUR).getTime());
      expect(backward.sub(t, 5 * HOUR).getTime()).toBe(forward.sub(t, 5 * HOUR).getTime());
      expect(iso(backward.nextPeriod(t))).toEqual(iso(forward.nextPeriod(t)));
    }
    expect(backward.between("2026-01-05T00:00:00Z", "2026-01-12T00:00:00Z")).toBe(
      forward.between("2026-01-05T00:00:00Z", "2026-01-12T00:00:00Z"),
    );
  });

  test("count each distinct date once, seven days apiece, in the search bound", () => {
    // From 2021 on the break covers the whole workday, so only the special
    // days, which lie outside the break, give working time.
    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
    const base = [
      { type: "workday", start: "09:00", end: "10:00", days, timeZone: "Etc/GMT+3" },
      { type: "break", start: "09:00", end: "10:00", days, timeZone: "America/Sao_Paulo" },
    ] as const;
    const special = (dates: string[]) =>
      ({ type: "specialday", start: "20:00", end: "21:00", dates }) as const;
    const t = "2021-01-01T00:00:00Z";
    const within = (rules: readonly Rule[]) => new Schedule({ rules: [...base, ...rules] });

    // The bound is 373 days with one distinct date: day 372 is in, day 374 out.
    expect(within([special(["2022-01-08"])]).add(t, HOUR).toISOString()).toBe(
      "2022-01-08T21:00:00.000Z",
    );
    const repeated = within([
      special(Array<string>(60).fill("2022-01-10")),
      special(Array<string>(40).fill("2022-01-10")),
    ]);
    expect(() => repeated.add(t, HOUR)).toThrow(NoWorkingTimeError);
    expect(() => repeated.nextPeriod(t)).toThrow(NoWorkingTimeError);

    // A second distinct date lengthens it to 380 days.
    expect(within([special(["2022-01-10", "2022-01-11"])]).add(t, HOUR).toISOString()).toBe(
      "2022-01-10T21:00:00.000Z",
    );
  });

  test("accept options declared as const", () => {
    const options = {
      rules: [weekdays, { type: "specialday", start: "08:00", end: "12:00", dates: ["2026-01-07"] }],
    } as const;
    expect(new Schedule(options).between("2026-01-07T00:00:00Z", "2026-01-08T00:00:00Z")).toBe(
      4 * HOUR,
    );
  });
});

describe("freeing", () => {
  test.each([
    ["free", (schedule: Schedule) => schedule.free()],
    ["Symbol.dispose", (schedule: Schedule) => schedule[Symbol.dispose]()],
  ])("%s releases the schedule's memory", (_, release) => {
    const schedule = new Schedule({ rules: [{ type: "workday", start: "09:00", end: "17:00" }] });
    expect(schedule.between("2026-01-05T09:00:00Z", "2026-01-05T10:00:00Z")).toBe(HOUR);
    release(schedule);
    expect(() => schedule.between("2026-01-05T09:00:00Z", "2026-01-05T10:00:00Z")).toThrow();
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
    expect(build).toThrow(
      /^schedule has no working time: its working hours minus its breaks are empty$/,
    );
  });

  test("special days alone do not make a schedule", () => {
    // S19
    const build = () =>
      new Schedule({
        rules: [{ type: "specialday", start: "08:00", end: "12:00", dates: ["2026-01-07"] }],
      });
    expect(build).toThrow(NoWorkingTimeError);
  });

  test("an unknown time zone on a special day throws UnknownZoneError", () => {
    const build = () =>
      new Schedule({
        rules: [
          { type: "workday", start: "09:00", end: "17:00" },
          { type: "specialday", start: "08:00", end: "12:00", dates: [], timeZone: "Mars/Olympus_Mons" },
        ],
      });
    expect(build).toThrow(UnknownZoneError);
    expect(build).toThrow("unknown time zone `Mars/Olympus_Mons`");
  });

  test("a search without working time names its bound and start", () => {
    // In January 2001 Sao Paulo is on summer time, so the break misses the
    // shift and the schedule builds; since 2019 the break covers it.
    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
    const schedule = new Schedule({
      rules: [
        { type: "workday", start: "09:00", end: "10:00", days, timeZone: "Etc/GMT+3" },
        { type: "break", start: "09:00", end: "10:00", days, timeZone: "America/Sao_Paulo" },
      ],
    });
    const message =
      "no working time within 366 days, plus seven days per holiday date and per special date, of 2021-01-01T00:00:00Z";
    const t = "2021-01-01T00:00:00Z";
    for (const call of [
      () => schedule.add(t, HOUR),
      () => schedule.sub(t, HOUR),
      () => schedule.nextPeriod(t),
      () => schedule.previousPeriod(t),
    ]) {
      expect(call).toThrow(NoWorkingTimeError);
      expect(call).toThrow(new RegExp(`^${message}$`));
    }
    expect(() => schedule.addMany([t], HOUR)).toThrow(new RegExp(`^item 0: ${message}$`));
  });

  test("a result past the supported range throws OutOfRangeError", () => {
    expect(() => always.add("9999-12-30T00:00:00Z", 48 * HOUR)).toThrow(OutOfRangeError);
    expect(() => always.sub("-009999-01-03T00:00:00Z", 48 * HOUR)).toThrow(OutOfRangeError);
  });

  test("a Date past the supported range throws OutOfRangeError", () => {
    expect(() => always.add(new Date(8.64e15), 0)).toThrow(OutOfRangeError);
    expect(() => always.add(new Date(8.64e15), 0)).toThrow(
      "+275760-09-13T00:00:00.000Z is outside the supported range",
    );
  });

  test.each(["-009999-01-02T01:59:59Z", "9999-12-30T22:00:00Z"])(
    "%s is in range as a string and as a Date",
    (iso) => {
      expect(always.add(iso, 0).getTime()).toBe(Date.parse(iso));
      expect(always.add(new Date(iso), 0).getTime()).toBe(Date.parse(iso));
    },
  );

  test.each([
    "-009999-01-02T01:59:58.999Z",
    "9999-12-30T22:00:00.001Z",
    "-009999-01-01T00:00:00Z",
    "9999-12-31T23:00:00Z",
  ])(
    "%s is out of range as a string and as a Date",
    (iso) => {
      expect(() => always.add(iso, 0)).toThrow(OutOfRangeError);
      expect(() => always.add(iso, 0)).toThrow(`${iso} is outside the supported range`);
      expect(() => always.add(new Date(iso), 0)).toThrow(OutOfRangeError);
    },
  );

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
  const special = { type: "specialday", start: "08:00", end: "12:00", dates: ["2026-12-24"] } as const;

  test.each<[() => unknown, string]>([
    // @ts-expect-error options are required
    [() => new Schedule(), "expected an options object, got undefined"],
    // @ts-expect-error options must be an object
    [() => new Schedule(null), "expected an options object, got null"],
    // @ts-expect-error rules are required
    [() => new Schedule({}), "`rules` must be an array, got undefined"],
    [
      // @ts-expect-error unknown rule type
      () => new Schedule({ rules: [{ type: "shift", start: "09:00", end: "17:00" }] }),
      'rules[0]: rule `type` must be "workday", "break", "holidays" or "specialday"',
    ],
    // @ts-expect-error rules must be objects
    [() => new Schedule({ rules: [workday, null] }), "rules[1]: expected a rule object, got null"],
    // @ts-expect-error start must be a string
    [() => new Schedule({ rules: [{ ...workday, start: 9 }] }), "rules[0]: `start` must be a string, got 9"],
    [
      // @ts-expect-error start is required
      () => new Schedule({ rules: [workday, { type: "break", end: "13:00" }] }),
      "rules[1]: `start` is required",
    ],
    [
      // @ts-expect-error dates must be an array
      () => new Schedule({ rules: [{ type: "holidays", dates: "2026-12-25" }] }),
      'rules[0]: `dates` must be an array, got "2026-12-25"',
    ],
    [
      // @ts-expect-error days must be an array
      () => new Schedule({ rules: [{ ...workday, days: "mon" }] }),
      'rules[0]: `days` must be an array, got "mon"',
    ],
    [
      // @ts-expect-error dates must be strings
      () => new Schedule({ rules: [{ type: "holidays", dates: [20261225] }] }),
      "rules[0]: holiday dates must be strings, got 20261225",
    ],
    [
      // @ts-expect-error dates are required
      () => new Schedule({ rules: [workday, { type: "specialday", start: "08:00", end: "12:00" }] }),
      "rules[1]: `dates` must be an array, got undefined",
    ],
    [
      // @ts-expect-error dates must be strings
      () => new Schedule({ rules: [{ ...special, dates: [20261224] }] }),
      "rules[0]: special day dates must be strings, got 20261224",
    ],
    [
      // @ts-expect-error end is required
      () => new Schedule({ rules: [{ type: "specialday", start: "08:00", dates: ["2026-12-24"] }] }),
      "rules[0]: `end` is required",
    ],
    // @ts-expect-error end must be a string
    [() => new Schedule({ rules: [{ ...special, end: 12 }] }), "rules[0]: `end` must be a string, got 12"],
    [
      // @ts-expect-error timeZone must be a string
      () => new Schedule({ rules: [{ ...special, timeZone: 5 }] }),
      "rules[0]: `timeZone` must be a string, got 5",
    ],
    // @ts-expect-error instants are Dates or strings
    [() => office.between(0, "2026-01-05T09:00:00Z"), "expected a Date or an ISO 8601 string, got 0"],
    [
      // @ts-expect-error durations are numbers
      () => office.add("2026-01-05T09:00:00Z", "3600000"),
      '`ms` must be a number of milliseconds, got "3600000"',
    ],
    [
      // @ts-expect-error durations are numbers
      () => office.add("2026-01-05T09:00:00Z", 3600000n),
      "`ms` must be a number of milliseconds, got 3600000n",
    ],
    [
      // @ts-expect-error durations are numbers
      () => office.sub("2026-01-05T09:00:00Z", null),
      "`ms` must be a number of milliseconds, got null",
    ],
    [
      // @ts-expect-error the duration is required
      () => office.add("2026-01-05T09:00:00Z"),
      "`ms` must be a number of milliseconds, got undefined",
    ],
  ])("throws TypeError: %s", (call, message) => {
    expect(call).toThrow(TypeError);
    expect(call).toThrow(message);
  });

  test.each<[() => unknown, string]>([
    [
      () => new Schedule({ rules: [{ ...workday, start: "9am" }] }),
      'rules[0]: `start` must be a time such as "09:00", got "9am"',
    ],
    [
      // @ts-expect-error unknown day name
      () => new Schedule({ rules: [{ ...workday, days: ["monday"] }] }),
      'rules[0]: days must be "mon", "tue", ... or "sun", got "monday"',
    ],
    [
      () => new Schedule({ rules: [{ type: "holidays", dates: ["25/12/2026"] }] }),
      'rules[0]: holiday dates must look like "2026-12-25", got "25/12/2026"',
    ],
    [
      () => new Schedule({ rules: [{ ...special, end: "noon" }] }),
      'rules[0]: `end` must be a time such as "09:00", got "noon"',
    ],
    [
      () => new Schedule({ rules: [{ ...special, dates: ["2026-12-24", "2026-02-30"] }] }),
      'rules[0]: special day dates must look like "2026-12-25", got "2026-02-30"',
    ],
    // N2
    [
      () => office.between("2026-01-05T09:00:00", "2026-01-06T09:00:00Z"),
      '"2026-01-05T09:00:00" is not an ISO 8601 instant with a UTC offset',
    ],
    [
      () => office.between("2026-01-05T09:00:00.0001Z", "2026-01-06T09:00:00Z"),
      '"2026-01-05T09:00:00.0001Z" has digits below a millisecond',
    ],
    [() => office.between(new Date(Number.NaN), "2026-01-06T09:00:00Z"), "invalid Date"],
    [
      () => office.between("+010000-01-01T00:00:00Z", "2026-01-06T09:00:00Z"),
      '"+010000-01-01T00:00:00Z" is not an ISO 8601 instant with a UTC offset in the supported range',
    ],
    [() => office.add("2026-01-05T09:00:00Z", 1.5), "durations must be whole numbers of milliseconds"],
    [() => office.add("2026-01-05T09:00:00Z", Number.NaN), "got NaN"],
    [() => office.add("2026-01-05T09:00:00Z", -Infinity), "got -Infinity"],
    [
      () => office.add("2026-01-05T09:00:00Z", 2 ** 53),
      "durations must be whole numbers of milliseconds within ±Number.MAX_SAFE_INTEGER, got 9007199254740992",
    ],
    [() => office.add("2026-01-05T09:00:00Z", 1e16), "got 10000000000000000"],
    [() => office.add("2026-01-05T09:00:00Z", 1.5), "got 1.5"],
  ])("throws RangeError: %s", (call, message) => {
    expect(call).toThrow(RangeError);
    expect(call).toThrow(message);
  });

  test("a rule time below a millisecond throws RangeError", () => {
    const build = () => new Schedule({ rules: [{ ...workday, start: "09:00:00.0005" }] });
    expect(build).toThrow(RangeError);
    expect(build).toThrow("rules[0]: `start` has digits below a millisecond");
  });

  test("a special day time below a millisecond throws RangeError", () => {
    const build = () => new Schedule({ rules: [workday, { ...special, end: "12:00:00.0000001" }] });
    expect(build).toThrow(RangeError);
    expect(build).toThrow("rules[1]: `end` has digits below a millisecond");
  });
});
