import { describe, expect, test } from "vitest";

import { OutOfRangeError, Schedule } from "../node.js";

const HOUR = 3_600_000;

const office = new Schedule({
  timeZone: "Europe/London",
  rules: [
    { type: "workday", start: "09:00", end: "17:00" },
    { type: "break", start: "12:00", end: "13:00" },
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

// Every 37 minutes through 2026, in milliseconds since the epoch.
const instants = Float64Array.from({ length: 14_000 }, (_, i) => Date.UTC(2026, 0, 1) + i * 37 * 60_000);
const later = instants.map((t) => t + 29 * HOUR);
const amounts = Float64Array.from(instants, (_, i) => (i % 50) * 15 * 60_000 - 10 * HOUR);
const dates = Array.from(instants, (t) => new Date(t));

describe("betweenMany", () => {
  test("arrays give an array of numbers matching between", () => {
    const result = office.betweenMany(dates, Array.from(later, (t) => new Date(t)));
    expect(result).toBeInstanceOf(Array);
    expect(result).toEqual(dates.map((a, i) => office.between(a, new Date(later[i]))));
  });

  test("Float64Arrays give a Float64Array", () => {
    const result = office.betweenMany(instants, later);
    expect(result).toBeInstanceOf(Float64Array);
    expect(Array.from(result)).toEqual(office.betweenMany(dates, Array.from(later, (t) => new Date(t))));
  });

  test("accepts ISO strings", () => {
    expect(office.betweenMany(["2026-01-05T09:00:00Z"], ["2026-01-06T09:00:00+00:00"])).toEqual([
      7 * HOUR,
    ]);
  });

  test("empty inputs give an empty result", () => {
    expect(office.betweenMany([], [])).toEqual([]);
    expect(office.betweenMany(new Float64Array(), new Float64Array())).toEqual(new Float64Array());
  });

  test("takes a value typed as either form", () => {
    const pick = (typed: boolean): Float64Array | Date[] => (typed ? instants : dates);
    expect(Array.from(office.betweenMany(pick(true), pick(true)))).toEqual(
      office.betweenMany(pick(false), pick(false)),
    );
    expect(Array.from(office.addMany(pick(true), HOUR), Number)).toEqual(
      Array.from(office.addMany(pick(false), HOUR), Number),
    );
  });

  test("inputs of different lengths throw RangeError", () => {
    expect(() => office.betweenMany(dates, dates.slice(1))).toThrow(
      new RangeError(`batch inputs differ in length: ${dates.length} and ${dates.length - 1}`),
    );
  });
});

describe("addMany and subMany", () => {
  test("arrays give Dates matching add and sub", () => {
    const added = office.addMany(dates, Array.from(amounts));
    expect(added.every((d) => d instanceof Date)).toBe(true);
    expect(added).toEqual(dates.map((t, i) => office.add(t, amounts[i])));
    expect(office.subMany(dates, amounts)).toEqual(dates.map((t, i) => office.sub(t, amounts[i])));
  });

  test("Float64Arrays give a Float64Array", () => {
    const added = office.addMany(instants, amounts);
    expect(added).toBeInstanceOf(Float64Array);
    expect(Array.from(added)).toEqual(office.addMany(dates, amounts).map((d) => d.getTime()));
    const subtracted = office.subMany(instants, Array.from(amounts));
    expect(Array.from(subtracted)).toEqual(office.subMany(dates, amounts).map((d) => d.getTime()));
  });

  test("one number applies to every instant", () => {
    expect(office.addMany(dates, 3 * HOUR)).toEqual(dates.map((t) => office.add(t, 3 * HOUR)));
  });

  test("amounts of a different length throw RangeError", () => {
    expect(() => office.addMany(dates, [HOUR])).toThrow(RangeError);
  });
});

describe("errors name the failing item", () => {
  test("a malformed instant", () => {
    expect(() => office.addMany(["2026-01-05T09:00:00Z", "2026-01-05"], HOUR)).toThrow(
      /^item 1: /,
    );
  });

  test("a fractional epoch value", () => {
    expect(() => office.addMany(Float64Array.of(0, 1, 2.5), HOUR)).toThrow(
      new RangeError("item 2: instants must be whole milliseconds since the epoch, got 2.5"),
    );
  });

  test("a malformed amount", () => {
    // @ts-expect-error amounts are numbers
    expect(() => office.addMany(dates.slice(0, 2), [HOUR, "1h"])).toThrow(
      new TypeError('item 1: durations must be numbers, got "1h"'),
    );
    expect(() => office.subMany(dates.slice(0, 2), [HOUR, Number.NaN])).toThrow(/^item 1: /);
  });

  test("an engine error keeps its class", () => {
    const call = () => always.addMany(["2026-01-05T09:00:00Z", "9999-12-30T00:00:00Z"], 48 * HOUR);
    expect(call).toThrow(OutOfRangeError);
    expect(call).toThrow(/^item 1: result is outside the supported range -009999-01-02T01:59:59Z to 9999-12-30T22:00:00Z$/);
  });

  test("an epoch value out of range", () => {
    const call = () => office.addMany(Float64Array.of(0, 8.64e15 + 1), HOUR);
    expect(call).toThrow(OutOfRangeError);
    expect(call).toThrow("item 1: 8640000000000001 is outside the supported range");
  });

  test("an input that is not an array", () => {
    // @ts-expect-error instants come in an array
    expect(() => office.addMany("2026-01-05T09:00:00Z", HOUR)).toThrow(TypeError);
  });
});
