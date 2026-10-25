import { type DemoInputs, type Strip, instant, longDate, weekdays } from './week-strip';

export interface PlaygroundCode {
  rust: string;
  python: string;
  javascript: string;
}

const width = 77;
const rustDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Items joined on one line inside `open` and `close` if it fits, otherwise one per line. */
function list(
  items: string[],
  indent: string,
  open: string,
  close: string,
  { prefix = '', step = 4 } = {},
): string {
  const inline = `${indent}${prefix}${open}${items.join(', ')}${close}`;
  if (inline.length <= width) return inline;
  const inner = items.map((item) => `${indent}${' '.repeat(step)}${item},`).join('\n');
  return `${indent}${prefix}${open}\n${inner}\n${indent}${close}`;
}

function hm(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number);
  return [h, m];
}

/** "2026-12-24T16:30:00+00:00": the opening instant with the zone's offset at that moment. */
function isoWithOffset(inputs: DemoInputs): string {
  const at = instant(inputs.openedDate, inputs.openedTime, inputs.timeZone);
  const wall = Date.parse(`${inputs.openedDate}T${inputs.openedTime}:00Z`);
  const offset = Math.round((wall - at.getTime()) / 60_000);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${inputs.openedDate}T${inputs.openedTime}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const isMonToFri = (inputs: DemoInputs) => inputs.days.join() === weekdays.slice(0, 5).join();

function dueComment(strip: Strip): string {
  return `due: ${longDate(strip.dueDate, { short: true })}, ${strip.dueTime} in ${strip.inputs.timeZone}`;
}

/** The program each language needs for the playground's inputs, ending at the due instant. */
export function playgroundCode(strip: Strip): PlaygroundCode {
  return { rust: rust(strip), python: python(strip), javascript: javascript(strip) };
}

function rust(strip: Strip): string {
  const { inputs } = strip;
  const time = (t: string) => {
    const [h, m] = hm(t);
    return `time(${h}, ${m}, 0, 0)`;
  };
  const date = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return `date(${y}, ${m}, ${day})`;
  };
  const all = inputs.days.length === 7;
  const custom = !isMonToFri(inputs) && !all;
  const days = custom
    ? list(
        weekdays.flatMap((d, i) => (inputs.days.includes(d) ? [`Weekday::${rustDays[i]}`] : [])),
        '    ',
        '[',
        '].into_iter().collect();',
        { prefix: 'let days: Weekdays = ' },
      )
    : `    let days = Weekdays::${all ? 'ALL' : 'MON_TO_FRI'};`;
  const civil = ['date', 'time', ...(custom ? ['Weekday'] : [])].filter(
    (name) => name !== 'date' || inputs.holidays.length > 0,
  );
  const rules = [
    `        .rule(WorkDay::new(${time(inputs.workStart)}, ${time(inputs.workEnd)}, days))`,
    ...(inputs.breakTime
      ? [`        .rule(Break::new(${time(inputs.breakTime.start)}, ${time(inputs.breakTime.end)}, days))`]
      : []),
    ...(inputs.holidays.length > 0
      ? [list(inputs.holidays.map(date), '        ', '.rule(Holidays::new([', ']))')]
      : []),
  ];
  const types = [
    ...(inputs.breakTime ? ['Break'] : []),
    ...(inputs.holidays.length > 0 ? ['Holidays'] : []),
    'Schedule',
    'Weekdays',
    'WorkDay',
  ];
  return [
    `use jiff::civil::${civil.length > 1 ? `{${civil.join(', ')}}` : civil[0]};`,
    'use jiff::{SignedDuration, Zoned};',
    `use workclock::{${types.join(', ')}};`,
    '',
    'fn main() -> Result<(), Box<dyn std::error::Error>> {',
    days,
    '    let schedule = Schedule::builder()',
    `        .time_zone("${inputs.timeZone}")`,
    ...rules,
    '        .build()?;',
    '',
    `    let opened: Zoned = "${inputs.openedDate}T${inputs.openedTime}[${inputs.timeZone}]".parse()?;`,
    `    let due = schedule.add(&opened, SignedDuration::from_hours(${inputs.slaHours}))?;`,
    `    println!("{due}"); // ${dueComment(strip)}`,
    '    Ok(())',
    '}',
  ].join('\n');
}

function python(strip: Strip): string {
  const { inputs } = strip;
  const time = (t: string) => {
    const [h, m] = hm(t);
    return m === 0 ? `time(${h})` : `time(${h}, ${m})`;
  };
  const date = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return `date(${y}, ${m}, ${day})`;
  };
  const days = isMonToFri(inputs)
    ? ''
    : `, days=[${weekdays.flatMap((d, i) => (inputs.days.includes(d) ? [String(i)] : [])).join(', ')}]`;
  const rules = [
    `        WorkDay(${time(inputs.workStart)}, ${time(inputs.workEnd)}${days}),`,
    ...(inputs.breakTime
      ? [`        Break(${time(inputs.breakTime.start)}, ${time(inputs.breakTime.end)}${days}),`]
      : []),
    ...(inputs.holidays.length > 0
      ? [list(inputs.holidays.map(date), '        ', 'Holidays([', ']),')]
      : []),
  ];
  const types = [
    ...(inputs.breakTime ? ['Break'] : []),
    ...(inputs.holidays.length > 0 ? ['Holidays'] : []),
    'Schedule',
    'WorkDay',
  ];
  const [h, m] = hm(inputs.openedTime);
  const [y, mo, d] = inputs.openedDate.split('-').map(Number);
  const opened = `datetime(${y}, ${mo}, ${d}, ${h}${m === 0 ? '' : `, ${m}`}, tzinfo=tz)`;
  return [
    `from datetime import ${inputs.holidays.length > 0 ? 'date, ' : ''}datetime, time, timedelta`,
    'from zoneinfo import ZoneInfo',
    '',
    `from workclock import ${types.join(', ')}`,
    '',
    `tz = ZoneInfo("${inputs.timeZone}")`,
    'schedule = Schedule(',
    '    [',
    ...rules,
    '    ],',
    '    time_zone=tz,',
    ')',
    '',
    `opened = ${opened}`,
    `due = schedule.add(opened, timedelta(hours=${inputs.slaHours}))`,
    `print(due)  # ${dueComment(strip)}`,
  ].join('\n');
}

function javascript(strip: Strip): string {
  const { inputs } = strip;
  const days = isMonToFri(inputs)
    ? ''
    : `, days: [${inputs.days.map((d) => `"${d}"`).join(', ')}]`;
  const rules = [
    `    { type: "workday", start: "${inputs.workStart}", end: "${inputs.workEnd}"${days} },`,
    ...(inputs.breakTime
      ? [`    { type: "break", start: "${inputs.breakTime.start}", end: "${inputs.breakTime.end}"${days} },`]
      : []),
    ...(inputs.holidays.length > 0
      ? [
          list(inputs.holidays.map((d) => `"${d}"`), '    ', '{ type: "holidays", dates: [', '] },', {
            step: 2,
          }),
        ]
      : []),
  ];
  return [
    'import { Schedule } from "workclock";',
    '',
    'const schedule = new Schedule({',
    `  timeZone: "${inputs.timeZone}",`,
    '  rules: [',
    ...rules,
    '  ],',
    '});',
    '',
    `const opened = "${isoWithOffset(inputs)}";`,
    `const due = schedule.add(opened, ${inputs.slaHours} * 3_600_000);`,
    `console.log(due); // ${dueComment(strip)}`,
  ].join('\n');
}
