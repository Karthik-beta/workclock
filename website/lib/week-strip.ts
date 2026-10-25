import type { Rule, Schedule, Weekday } from 'workclock/web';

export const weekdays: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** What the demo and playground controls set. Dates and times are wall-clock in `timeZone`. */
export interface DemoInputs {
  slaHours: number;
  openedDate: string;
  openedTime: string;
  workStart: string;
  workEnd: string;
  /** The working days; the break applies on the same days. */
  days: Weekday[];
  breakTime: { start: string; end: string } | null;
  holidays: string[];
  timeZone: string;
}

/** The README scenario: due 09:30 on Wednesday 30 December 2026. */
export const readmeInputs: DemoInputs = {
  slaHours: 8,
  openedDate: '2026-12-24',
  openedTime: '16:30',
  workStart: '09:00',
  workEnd: '17:00',
  days: weekdays.slice(0, 5),
  breakTime: { start: '12:00', end: '13:00' },
  holidays: ['2026-12-25', '2026-12-28'],
  timeZone: 'Europe/London',
};

export const minSlaHours = 1;
export const maxSlaHours = 40;
const minDays = 7;
const maxDays = 14;

/** Minutes after local midnight. */
export interface Span {
  from: number;
  to: number;
}

export type StripRow =
  | { kind: 'work'; date: string; periods: Span[]; used: Span[] }
  | { kind: 'holiday'; date: string; hours: Span }
  | { kind: 'weekend'; dates: string[] };

export interface Strip {
  inputs: DemoInputs;
  rows: StripRow[];
  axis: Span;
  start: { row: number; minute: number };
  /** Null when the due day is after the last day shown. */
  due: { row: number; minute: number } | null;
  dueDate: string;
  dueTime: string;
  call: string;
}

export type StripResult = { ok: true; strip: Strip } | { ok: false; message: string };

type ScheduleClass = new (...args: ConstructorParameters<typeof Schedule>) => Schedule;

export function rules(inputs: DemoInputs): Rule[] {
  const { days, breakTime } = inputs;
  const list: Rule[] = [{ type: 'workday', start: inputs.workStart, end: inputs.workEnd, days }];
  if (breakTime) list.push({ type: 'break', start: breakTime.start, end: breakTime.end, days });
  list.push({ type: 'holidays', dates: inputs.holidays });
  return list;
}

export function computeStrip(ScheduleCtor: ScheduleClass, inputs: DemoInputs): StripResult {
  if (minutes(inputs.workEnd) <= minutes(inputs.workStart)) {
    return { ok: false, message: 'The working day must end after it starts.' };
  }
  if (inputs.breakTime && minutes(inputs.breakTime.end) <= minutes(inputs.breakTime.start)) {
    return { ok: false, message: 'The break must end after it starts.' };
  }
  if (inputs.days.length === 0) {
    return { ok: false, message: 'Choose at least one working day.' };
  }
  let schedule: Schedule;
  try {
    schedule = new ScheduleCtor({ timeZone: inputs.timeZone, rules: rules(inputs) });
  } catch (e) {
    return { ok: false, message: errorMessage(e, inputs) };
  }
  try {
    return { ok: true, strip: build(schedule, inputs) };
  } catch (e) {
    return { ok: false, message: errorMessage(e, inputs) };
  } finally {
    schedule.free();
  }
}

function build(schedule: Schedule, inputs: DemoInputs): Strip {
  const tz = inputs.timeZone;
  const opened = instant(inputs.openedDate, inputs.openedTime, tz);
  const due = schedule.add(opened, inputs.slaHours * 3_600_000);
  const dueLocal = local(due, tz);

  const span = daysBetween(inputs.openedDate, dueLocal.date) + 1;
  const shown = Math.min(Math.max(span, minDays), maxDays);
  const dates = Array.from({ length: shown }, (_, i) => addDays(inputs.openedDate, i));
  const end = instant(addDays(dates[dates.length - 1], 1), '00:00', tz);

  const periods = new Map<string, Span[]>();
  const used = new Map<string, Span[]>();
  let t = instant(inputs.openedDate, '00:00', tz);
  // 14 days hold at most 28 periods with one break a day.
  for (let i = 0; i < 64; i++) {
    const p = schedule.nextPeriod(t);
    if (p.start >= end) break;
    push(periods, p.start, p.end, tz);
    const from = p.start > opened ? p.start : opened;
    const to = p.end < due ? p.end : due;
    if (from < to) push(used, from, to, tz);
    t = p.end;
  }

  const rows: StripRow[] = [];
  const rowOf = new Map<string, number>();
  for (const date of dates) {
    const dayPeriods = periods.get(date) ?? [];
    const last = rows[rows.length - 1];
    if (!isWorkingDay(inputs, date) && dayPeriods.length === 0) {
      if (last?.kind === 'weekend') last.dates.push(date);
      else rows.push({ kind: 'weekend', dates: [date] });
    } else if (inputs.holidays.includes(date)) {
      rows.push({
        kind: 'holiday',
        date,
        hours: { from: minutes(inputs.workStart), to: minutes(inputs.workEnd) },
      });
    } else {
      rows.push({ kind: 'work', date, periods: dayPeriods, used: used.get(date) ?? [] });
    }
    rowOf.set(date, rows.length - 1);
  }

  const openedMinute = minutes(inputs.openedTime);
  const earliest = Math.min(minutes(inputs.workStart), openedMinute);
  const latest = Math.max(minutes(inputs.workEnd), openedMinute);
  const axis = {
    from: Math.max(0, Math.floor((earliest - 60) / 120) * 120),
    to: Math.min(1440, Math.ceil((latest + 60) / 120) * 120),
  };

  const dueRow = rowOf.get(dueLocal.date);
  return {
    inputs,
    rows,
    axis,
    start: { row: rowOf.get(inputs.openedDate) ?? 0, minute: openedMinute },
    due: dueRow === undefined ? null : { row: dueRow, minute: dueLocal.minute },
    dueDate: dueLocal.date,
    dueTime: hhmm(dueLocal.minute),
    call: `support.add("${opened.toISOString().replace('.000Z', 'Z')}", ${inputs.slaHours} * 3_600_000)`,
  };
}

function push(map: Map<string, Span[]>, start: Date, end: Date, timeZone: string) {
  const s = local(start, timeZone);
  const e = local(end, timeZone);
  const span = { from: s.minute, to: e.date === s.date ? e.minute : 1440 };
  const list = map.get(s.date);
  if (list) list.push(span);
  else map.set(s.date, [span]);
}

function errorMessage(e: unknown, { breakTime }: DemoInputs): string {
  if (e instanceof Error && 'kind' in e && e.kind === 'no_working_time') {
    return breakTime
      ? `No working time: the working hours fall inside the ${breakTime.start}–${breakTime.end} break.`
      : 'No working time.';
  }
  return e instanceof Error ? e.message : String(e);
}

/** The weekday of a date, as rules name it. */
export function weekdayKey(date: string): Weekday {
  return weekdays[(weekday(date) + 6) % 7];
}

export function isWorkingDay(inputs: DemoInputs, date: string): boolean {
  return inputs.days.includes(weekdayKey(date));
}

// Wall-clock helpers for a time zone.

const formats = new Map<string, Intl.DateTimeFormat>();

function partsFormat(timeZone: string): Intl.DateTimeFormat {
  let format = formats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formats.set(timeZone, format);
  }
  return format;
}

function local(d: Date, timeZone: string): { date: string; minute: number } {
  const p: Record<string, string> = {};
  for (const part of partsFormat(timeZone).formatToParts(d)) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}

/** The instant a wall-clock date and time in `timeZone` names. */
export function instant(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d) + minutes(time) * 60_000;
  const offset = (t: number) => {
    const l = local(new Date(t), timeZone);
    const [ly, lm, ld] = l.date.split('-').map(Number);
    return Date.UTC(ly, lm - 1, ld) + l.minute * 60_000 - t;
  };
  const first = guess - offset(guess);
  return new Date(guess - offset(first));
}

export function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** 0 is Sunday. */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

// Text, shared by the drawing, its text alternative and the result sentence.

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function dayName(date: string, short = false): string {
  const name = days[weekday(date)];
  return short ? name.slice(0, 3) : name;
}

/** "Wednesday 30 December 2026", or "Wed 30 Dec" when short. */
export function longDate(date: string, { short = false, year = true } = {}): string {
  const [y, m, d] = date.split('-').map(Number);
  const month = short ? months[m - 1].slice(0, 3) : months[m - 1];
  return `${dayName(date, short)} ${d} ${month}${year ? ` ${y}` : ''}`;
}

export function dueSentence(strip: Strip): string {
  return `Due ${strip.dueTime} on ${longDate(strip.dueDate)} (${strip.inputs.timeZone})`;
}

export function dueLabel(strip: Strip): string {
  return `Due ${longDate(strip.dueDate, { short: true, year: false })}, ${strip.dueTime}`;
}

/** "", or " on Mon, Tue and Sat" when the working days are not Monday to Friday. */
function onDays({ days }: DemoInputs): string {
  if (days.join() === weekdays.slice(0, 5).join()) return '';
  const names = weekdays
    .filter((d) => days.includes(d))
    .map((d) => d[0].toUpperCase() + d.slice(1));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  return ` on ${list}`;
}

function breakText({ breakTime }: DemoInputs, long = false): string {
  if (!breakTime) return long ? 'with no break' : 'no break';
  return long
    ? `with a break from ${breakTime.start} to ${breakTime.end}`
    : `break ${breakTime.start}–${breakTime.end}`;
}

export function caption(inputs: DemoInputs): string {
  const hours = `${inputs.workStart}–${inputs.workEnd}${onDays(inputs)}`;
  return `Working hours ${hours}, ${breakText(inputs)}. Times in ${inputs.timeZone}.`;
}

/** "Weekend" when every date is a Saturday or Sunday, otherwise "Day off". */
export function offLabel(dates: string[]): string {
  return dates.every((d) => [0, 6].includes(weekday(d))) ? 'Weekend' : 'Day off';
}

export function describe(strip: Strip): string {
  const { inputs, rows } = strip;
  const first = inputs.openedDate;
  const last = rows.at(-1)!;
  const lastDate = last.kind === 'weekend' ? last.dates.at(-1)! : last.date;
  const holidays = rows.flatMap((r) => (r.kind === 'holiday' ? [longDate(r.date, { year: false })] : []));
  const hours = inputs.slaHours === 1 ? '1 working hour' : `${inputs.slaHours} working hours`;
  return [
    `Days from ${longDate(first, { year: false })} to ${longDate(lastDate)}, working ${inputs.workStart} to ${inputs.workEnd}${onDays(inputs)} ${breakText(inputs, true)}.`,
    holidays.length > 0 ? `Holidays: ${holidays.join(', ')}.` : '',
    `${hours} from ${longDate(first, { year: false })} at ${inputs.openedTime} end on ${longDate(strip.dueDate)} at ${strip.dueTime}.`,
  ]
    .filter(Boolean)
    .join(' ');
}
