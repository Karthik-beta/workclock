// Brute-force reference implementation of DESIGN.md, the TypeScript twin of
// `tests/python/support/oracle.py`.
//
// It decides for every minute separately whether that minute is working time,
// and never builds or merges intervals. That makes it slow but easy to check
// against the spec by reading. Every instant, duration and rule time it is
// given must be a whole number of minutes. Instants and durations are
// milliseconds; time zones come from `Intl`, not from the engine's database.

import {
  allDates,
  type ErrorKind,
  type RuleSpec,
  type ScheduleSpec,
  type SpecialDaySpec,
} from "./fixture.js";

const MINUTE = 60_000;
const DAY = 86_400_000;
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
// The supported range, -009999-01-02T01:59:59Z to 9999-12-30T22:00:00Z.
const FIRST = -377_705_023_201_000;
const LAST = 253_402_207_200_000;

type Block = [start: number, end: number];

export class OracleError extends Error {
  constructor(readonly kind: ErrorKind) {
    super(kind);
  }
}

export class Oracle {
  private readonly searchLimit: number;

  /** `dates` counts the holiday and special dates, a week of search each. */
  private constructor(
    private readonly workdays: Blocks[],
    private readonly specialDays: Blocks[],
    private readonly breaks: Blocks[],
    private readonly holidays: Blocks[],
    dates: number,
  ) {
    this.searchLimit = (366 + 7 * dates) * DAY;
  }

  static build(spec: ScheduleSpec): Oracle {
    const zones = new Map<string, Zone>();
    const zone = (name = spec.zone) => {
      let found = zones.get(name);
      if (found === undefined) {
        found = new Zone(name);
        zones.set(name, found);
      }
      return found;
    };
    zone();
    const workdays = (except?: ReadonlySet<number>) =>
      (spec.workdays ?? []).map((r) => new Hours(r, zone(r.zone), except));
    const breaks = (spec.breaks ?? []).map((r) => new Hours(r, zone(r.zone)));
    const holidays = (spec.holidays ?? []).map((h) => new Holidays(allDates(h), zone(h.zone)));
    const specialDays = (spec.specialdays ?? []).map((s) => new SpecialDay(s, zone(s.zone)));
    const specialDates = new Set(specialDays.flatMap((s) => [...s.dates]));

    // Like holidays, special days take no part in the check: their blocks do
    // not count, and the shifts they replace still do.
    const check = new Oracle(workdays(), [], breaks, [], 0);
    const windowStart = Date.UTC(2001, 0, 1);
    for (let m = windowStart; m < windowStart + 14 * DAY; m += MINUTE) {
      if (check.available(m) && !check.onBreak(m)) {
        return new Oracle(
          workdays(specialDates),
          specialDays,
          breaks,
          holidays,
          holidays.reduce((n, h) => n + h.size, 0) + specialDates.size,
        );
      }
    }
    throw new OracleError("no_working_time");
  }

  /** Whether the minute starting at `t` is working time. */
  isWorking(t: number): boolean {
    return this.available(t) && !this.onBreak(t) && !this.holidays.some((h) => h.contains(t));
  }

  between(a: number, b: number): number {
    if (b < a) {
      // Not `-x`, which would give -0 where the engine gives 0.
      return 0 - this.between(b, a);
    }
    let total = 0;
    for (let m = a; m < b; m += MINUTE) {
      if (this.isWorking(m)) {
        total += MINUTE;
      }
    }
    return total;
  }

  add(t: number, d: number): number {
    if (d < 0) {
      return this.sub(t, -d);
    }
    let left = d;
    let idle = 0;
    let x = t;
    while (left > 0) {
      const next = step(x, MINUTE);
      if (this.isWorking(x)) {
        left -= MINUTE;
        idle = 0;
      } else if ((idle += MINUTE) > this.searchLimit) {
        throw new OracleError("no_working_time");
      }
      x = next;
    }
    return x;
  }

  sub(t: number, d: number): number {
    if (d < 0) {
      return this.add(t, -d);
    }
    let left = d;
    let idle = 0;
    let x = t;
    while (left > 0) {
      const previous = step(x, -MINUTE);
      if (this.isWorking(previous)) {
        left -= MINUTE;
        idle = 0;
      } else if ((idle += MINUTE) > this.searchLimit) {
        throw new OracleError("no_working_time");
      }
      x = previous;
    }
    return x;
  }

  nextPeriod(t: number): Block {
    let start = t;
    while (!this.isWorking(start)) {
      start = step(start, MINUTE);
      if (start - t > this.searchLimit) {
        throw new OracleError("no_working_time");
      }
    }
    let end = start;
    while (end - start < this.searchLimit && end + MINUTE <= LAST && this.isWorking(end)) {
      end += MINUTE;
    }
    return [start, end];
  }

  previousPeriod(t: number): Block {
    let end = t;
    while (!this.isWorking(step(end, -MINUTE))) {
      end -= MINUTE;
      if (t - end > this.searchLimit) {
        throw new OracleError("no_working_time");
      }
    }
    let start = end;
    while (
      end - start < this.searchLimit &&
      start - MINUTE >= FIRST &&
      this.isWorking(start - MINUTE)
    ) {
      start -= MINUTE;
    }
    return [start, end];
  }

  private available(t: number): boolean {
    return this.workdays.some((r) => r.contains(t)) || this.specialDays.some((s) => s.contains(t));
  }

  private onBreak(t: number): boolean {
    return this.breaks.some((r) => r.contains(t));
  }
}

class Zone {
  private readonly format: Intl.DateTimeFormat;

  constructor(name: string) {
    try {
      this.format = new Intl.DateTimeFormat("en-US", { timeZone: name, timeZoneName: "longOffset" });
    } catch {
      throw new OracleError("unknown_zone");
    }
  }

  /** The UTC offset at `t`. */
  offset(t: number): number {
    const name = this.format.formatToParts(t).find((p) => p.type === "timeZoneName")?.value ?? "";
    const match = /^GMT(?:([+-])(\d\d):(\d\d)(?::(\d\d))?)?$/.exec(name);
    if (match === null) {
      throw new Error(`unexpected offset ${name}`);
    }
    const [, sign, h = 0, m = 0, s = 0] = match;
    const ms = ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000;
    return sign === "-" ? -ms : ms;
  }

  /**
   * The instant of a wall-clock time, given as milliseconds from 1970-01-01
   * 00:00 local time, with the "compatible" policy from DESIGN.md: a time in a
   * gap takes the offset from before the gap, which moves it forward by the
   * gap's length, and a repeated time is its first occurrence.
   */
  resolve(local: number): number {
    const before = local - this.offset(local - DAY);
    const after = local - this.offset(local + DAY);
    const valid = [before, after].filter((t) => t + this.offset(t) === local);
    return valid.length > 0 ? Math.min(...valid) : before;
  }
}

/**
 * Blocks of one rule, looked up by the UTC date of an instant. Local dates are
 * within a day of it, so each lookup resolves the rule on the dates around
 * that UTC date, and caches them because the oracle asks about every minute.
 */
abstract class Blocks {
  private readonly near = new Map<number, Block[]>();

  constructor(protected readonly zone: Zone) {}

  contains(t: number): boolean {
    const day = Math.floor(t / DAY);
    let blocks = this.near.get(day);
    if (blocks === undefined) {
      blocks = this.blocksNear(day);
      this.near.set(day, blocks);
    }
    return blocks.some(([start, end]) => start <= t && t < end);
  }

  /** Every block that can contain an instant on UTC date `day`. */
  protected abstract blocksNear(day: number): Block[];
}

/** Shifts from `start` to `end` on the local dates for which `startsOn` holds. */
abstract class Shifts extends Blocks {
  private readonly start: number;
  private readonly end: number;

  constructor(start: string, end: string, zone: Zone) {
    super(zone);
    this.start = timeOfDay(start);
    this.end = timeOfDay(end);
  }

  protected abstract startsOn(day: number): boolean;

  /**
   * A shift belongs to the local date it starts on, so an instant can only fall
   * in the shift of its own local date or of the day before.
   */
  protected blocksNear(day: number): Block[] {
    const overnight = this.end <= this.start ? DAY : 0;
    const blocks: Block[] = [];
    for (let d = day - 2; d <= day + 1; d++) {
      if (this.startsOn(d)) {
        blocks.push([
          this.zone.resolve(d * DAY + this.start),
          this.zone.resolve(d * DAY + overnight + this.end),
        ]);
      }
    }
    return blocks;
  }
}

/** A workday or a break, without its shifts that start on a date in `except`. */
class Hours extends Shifts {
  private readonly days: Set<number>;

  constructor(
    spec: RuleSpec,
    zone: Zone,
    private readonly except: ReadonlySet<number> = new Set(),
  ) {
    super(spec.start, spec.end, zone);
    this.days = new Set(spec.days.map((d) => WEEKDAYS.indexOf(d)));
  }

  protected startsOn(day: number): boolean {
    return this.days.has(weekday(day)) && !this.except.has(day);
  }
}

class SpecialDay extends Shifts {
  readonly dates: Set<number>;

  constructor(spec: SpecialDaySpec, zone: Zone) {
    super(spec.start, spec.end, zone);
    this.dates = new Set(spec.dates.map((d) => Date.parse(d) / DAY));
  }

  protected startsOn(day: number): boolean {
    return this.dates.has(day);
  }
}

class Holidays extends Blocks {
  private readonly dates: Set<number>;

  constructor(dates: string[], zone: Zone) {
    super(zone);
    this.dates = new Set(dates.map((d) => Date.parse(d) / DAY));
  }

  get size(): number {
    return this.dates.size;
  }

  /**
   * A holiday is `[00:00 on its date, 00:00 on the next date)`. Around DST
   * transitions that block can reach into a neighbouring local date, so the
   * dates either side are checked too.
   */
  protected blocksNear(day: number): Block[] {
    const blocks: Block[] = [];
    for (let d = day - 2; d <= day + 2; d++) {
      if (this.dates.has(d)) {
        blocks.push([this.zone.resolve(d * DAY), this.zone.resolve((d + 1) * DAY)]);
      }
    }
    return blocks;
  }
}

function timeOfDay(text: string): number {
  const [h, m] = text.split(":").map(Number);
  return (h * 60 + m) * MINUTE;
}

/** Monday is 0; 1970-01-01, day 0, was a Thursday. */
function weekday(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

function step(x: number, by: number): number {
  const y = x + by;
  if (y < FIRST || y > LAST) {
    throw new OracleError("out_of_range");
  }
  return y;
}
