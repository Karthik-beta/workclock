import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { A, Code, codeThemes, repoFile } from './parts';

// The README quickstart, word for word.
const rust = `use jiff::civil::{date, time};
use jiff::{SignedDuration, Zoned};
use workclock::{Break, Holidays, Schedule, Weekdays, WorkDay};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let support = Schedule::builder()
        .time_zone("Europe/London")
        .rule(WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI))
        .rule(Break::new(time(12, 0, 0, 0), time(13, 0, 0, 0), Weekdays::MON_TO_FRI))
        .rule(Holidays::new([date(2026, 12, 25), date(2026, 12, 28)]))
        .build()?;

    let opened: Zoned = "2026-12-24T16:30[Europe/London]".parse()?;
    let due = support.add(&opened, SignedDuration::from_hours(8))?;
    assert_eq!(due.to_string(), "2026-12-30T09:30:00Z");

    let now: Zoned = "2026-12-29T11:00[Europe/London]".parse()?;
    assert_eq!(support.between(&opened, &now), SignedDuration::from_mins(150));
    Ok(())
}`;

const python = `from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from workclock import Break, Holidays, Schedule, WorkDay

london = ZoneInfo("Europe/London")
support = Schedule(
    [
        WorkDay(time(9), time(17)),  # Monday to Friday by default
        Break(time(12), time(13)),
        Holidays([date(2026, 12, 25), date(2026, 12, 28)]),
    ],
    time_zone=london,
)

opened = datetime(2026, 12, 24, 16, 30, tzinfo=london)
support.add(opened, hours=8)  # 2026-12-30 09:30, London time
support.between(opened, datetime(2026, 12, 29, 11, tzinfo=london))  # 2:30:00`;

const javascript = `import { Schedule } from "workclock";

const support = new Schedule({
  timeZone: "Europe/London",
  rules: [
    { type: "workday", start: "09:00", end: "17:00" },
    { type: "break", start: "12:00", end: "13:00" },
    { type: "holidays", dates: ["2026-12-25", "2026-12-28"] },
  ],
});

support.add("2026-12-24T16:30:00Z", 8 * 3_600_000); // Date 2026-12-30T09:30:00.000Z
support.between("2026-12-24T16:30:00Z", new Date("2026-12-29T11:00:00Z")); // 9000000 ms`;

export function SameAnswer() {
  return (
    <section aria-labelledby="same-answer">
      <h2 id="same-answer" className="text-h2 text-text">
        Same answer in Rust, Python and JavaScript
      </h2>
      <div className="mt-6">
        <Tabs
          groupId="lang"
          persist
          items={['Rust', 'Python', 'JavaScript']}
          className="my-0 rounded-lg"
        >
          <Tab value="Rust">
            <ServerCodeBlock code={rust} lang="rust" themes={codeThemes} />
          </Tab>
          <Tab value="Python">
            <ServerCodeBlock code={python} lang="python" themes={codeThemes} />
          </Tab>
          <Tab value="JavaScript">
            <ServerCodeBlock code={javascript} lang="js" themes={codeThemes} />
          </Tab>
        </Tabs>
      </div>
      <div className="mt-4 flex max-w-(--wc-prose) flex-col gap-2 text-ui text-text-2">
        <p>
          These three samples run in CI as written: the README doctest in{' '}
          <A href={repoFile('crates/workclock-wasm/src/lib.rs')}>
            <Code>crates/workclock-wasm/src/lib.rs</Code>
          </A>
          ,{' '}
          <A href={repoFile('tests/python/test_readme.py')}>
            <Code>tests/python/test_readme.py</Code>
          </A>{' '}
          and{' '}
          <A href={repoFile('js/test/readme.test.ts')}>
            <Code>js/test/readme.test.ts</Code>
          </A>
          .
        </p>
        <p>
          The full programs are{' '}
          <A href={repoFile('crates/workclock/examples/sla.rs')}>
            <Code>sla.rs</Code>
          </A>
          ,{' '}
          <A href={repoFile('examples/python/sla.py')}>
            <Code>sla.py</Code>
          </A>{' '}
          and{' '}
          <A href={repoFile('js/examples/sla.mjs')}>
            <Code>sla.mjs</Code>
          </A>
          .
        </p>
      </div>
    </section>
  );
}
