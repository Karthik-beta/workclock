// Runs `tests/fixtures/design_examples.json` against the engine and against
// the oracle, so neither can drift from DESIGN.md.

import { describe, expect, test } from "vitest";

import { Schedule } from "../node.js";
import { type Case, load, scheduleOptions, type ScheduleSpec } from "./support/fixture.js";
import { Oracle, OracleError } from "./support/oracle.js";

type Outcome = { seconds: number } | { instant: number } | { error: string } | { built: true };

interface Implementation {
  between(a: string, b: string): number;
  add(t: string, ms: number): number;
  sub(t: string, ms: number): number;
}

const fixture = load();

function expected(c: Case): Outcome {
  return "instant" in c.expect ? { instant: Date.parse(c.expect.instant) } : c.expect;
}

function outcome(c: Case, build: (spec: ScheduleSpec) => Implementation): Outcome {
  try {
    const schedule = build(fixture.schedules[c.schedule]);
    switch (c.op) {
      case "build":
        return { built: true };
      case "between":
        return { seconds: schedule.between(c.a, c.b) / 1000 };
      case "add":
        return { instant: schedule.add(c.t, c.seconds * 1000) };
      case "sub":
        return { instant: schedule.sub(c.t, c.seconds * 1000) };
    }
  } catch (error) {
    const kind = (error as { kind?: unknown }).kind;
    if (typeof kind === "string") {
      return { error: kind };
    }
    throw error;
  }
}

function engine(spec: ScheduleSpec): Implementation {
  const schedule = new Schedule(scheduleOptions(spec));
  return {
    between: (a, b) => schedule.between(a, b),
    add: (t, ms) => schedule.add(t, ms).getTime(),
    sub: (t, ms) => schedule.sub(t, ms).getTime(),
  };
}

function oracle(spec: ScheduleSpec): Implementation {
  const schedule = Oracle.build(spec);
  return {
    between: (a, b) => schedule.between(Date.parse(a), Date.parse(b)),
    add: (t, ms) => schedule.add(Date.parse(t), ms),
    sub: (t, ms) => schedule.sub(Date.parse(t), ms),
  };
}

describe("engine", () => {
  test.each(fixture.cases.map((c) => [c.id, c] as const))("%s", (_, c) => {
    expect(outcome(c, engine)).toEqual(expected(c));
  });
});

describe("oracle", () => {
  test.each(fixture.cases.map((c) => [c.id, c] as const))("%s", (_, c) => {
    expect(outcome(c, oracle)).toEqual(expected(c));
  });

  test("reports errors as OracleError", () => {
    expect(() => Oracle.build({ zone: "Mars/Olympus_Mons" })).toThrow(OracleError);
  });
});
