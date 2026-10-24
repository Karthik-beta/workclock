import type { Rule, Schedule } from 'workclock/web';

export const zone = 'Europe/London';
export const lunchBreak = { start: '12:00', end: '13:00' } as const;

/** What the landing demo's controls set. Dates and times are wall-clock in `zone`. */
export interface DemoInputs {
  slaHours: number;
  openedDate: string;
  openedTime: string;
  workStart: string;
  workEnd: string;
  holidays: string[];
}

/** The README scenario: due 09:30 on Wednesday 30 December 2026. */
export const readmeInputs: DemoInputs = {
  slaHours: 8,
  openedDate: '2026-12-24',
  openedTime: '16:30',
  workStart: '09:00',
  workEnd: '17:00',
  holidays: ['2026-12-25', '2026-12-28'],
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
  return [
    { type: 'workday', start: inputs.workStart, end: inputs.workEnd },
    { type: 'break', start: lunchBreak.start, end: lunchBreak.end },
    { type: 'holidays', dates: inputs.holidays },
  ];
}

export function computeStrip(ScheduleCtor: ScheduleClass, inputs: DemoInputs): StripResult {
  if (minutes(inputs.workEnd) <= minutes(inputs.workStart)) {
    return { ok: false, message: 'The working day must end after it starts.' };
  }
  let schedule: Schedule;
  try {
    schedule = new ScheduleCtor({ timeZone: zone, rules: rules(inputs) });
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
  try {
    return { ok: true, strip: build(schedule, inputs) };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  } finally {
    schedule.free();
  }
}

function build(schedule: Schedule, inputs: DemoInputs): Strip {
  const opened = instant(inputs.openedDate, inputs.openedTime);
  const due = schedule.add(opened, inputs.slaHours * 3_600_000);
  const dueLocal = local(due);

  const span = daysBetween(inputs.openedDate, dueLocal.date) + 1;
  const shown = Math.min(Math.max(span, minDays), maxDays);
  const dates = Array.from({ length: shown }, (_, i) => addDays(inputs.openedDate, i));
  const end = instant(addDays(dates[dates.length - 1], 1), '00:00');

  const periods = new Map<string, Span[]>();
  const used = new Map<string, Span[]>();
  let t = instant(inputs.openedDate, '00:00');
  // 14 days hold at most 28 periods with one break a day.
  for (let i = 0; i < 64; i++) {
    const p = schedule.nextPeriod(t);
    if (p.start >= end) break;
    push(periods, p.start, p.end);
    const from = p.start > opened ? p.start : opened;
    const to = p.end < due ? p.end : due;
    if (from < to) push(used, from, to);
    t = p.end;
  }

  const rows: StripRow[] = [];
  const rowOf = new Map<string, number>();
  for (const date of dates) {
    const day = weekday(date);
    const weekend = day === 0 || day === 6;
    const dayPeriods = periods.get(date) ?? [];
    const last = rows[rows.length - 1];
    if (weekend && dayPeriods.length === 0) {
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

function push(map: Map<string, Span[]>, start: Date, end: Date) {
  const s = local(start);
  const e = local(end);
  const span = { from: s.minute, to: e.date === s.date ? e.minute : 1440 };
  const list = map.get(s.date);
  if (list) list.push(span);
  else map.set(s.date, [span]);
}

function errorMessage(e: unknown): string {
  if (e instanceof Error && 'kind' in e && e.kind === 'no_working_time') {
    return `No working time: the working hours fall inside the ${lunchBreak.start}–${lunchBreak.end} break.`;
  }
  return e instanceof Error ? e.message : String(e);
}

// Wall-clock helpers for `zone`.

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: zone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function local(d: Date): { date: string; minute: number } {
  const p: Record<string, string> = {};
  for (const part of partsFormat.formatToParts(d)) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}

/** The instant a wall-clock date and time in `zone` names. */
export function instant(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d) + minutes(time) * 60_000;
  const offset = (t: number) => {
    const l = local(new Date(t));
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
  return `Due ${strip.dueTime} on ${longDate(strip.dueDate)} (${zone})`;
}

export function dueLabel(strip: Strip): string {
  return `Due ${longDate(strip.dueDate, { short: true, year: false })}, ${strip.dueTime}`;
}

export function caption(inputs: DemoInputs): string {
  return `Working hours ${inputs.workStart}–${inputs.workEnd}, break ${lunchBreak.start}–${lunchBreak.end}. Times in ${zone}.`;
}

export function describe(strip: Strip): string {
  const { inputs, rows } = strip;
  const first = inputs.openedDate;
  const last = rows.at(-1)!;
  const lastDate = last.kind === 'weekend' ? last.dates.at(-1)! : last.date;
  const holidays = rows.flatMap((r) => (r.kind === 'holiday' ? [longDate(r.date, { year: false })] : []));
  const hours = inputs.slaHours === 1 ? '1 working hour' : `${inputs.slaHours} working hours`;
  return [
    `Days from ${longDate(first, { year: false })} to ${longDate(lastDate)}, working ${inputs.workStart} to ${inputs.workEnd} with a break from ${lunchBreak.start} to ${lunchBreak.end}.`,
    holidays.length > 0 ? `Holidays: ${holidays.join(', ')}.` : '',
    `${hours} from ${longDate(first, { year: false })} at ${inputs.openedTime} end on ${longDate(strip.dueDate)} at ${strip.dueTime}.`,
  ]
    .filter(Boolean)
    .join(' ');
}
