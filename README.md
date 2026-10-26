<h1>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Karthik-beta/workclock/main/docs/assets/lockup-dark.svg">
  <img alt="workclock" src="https://raw.githubusercontent.com/Karthik-beta/workclock/main/docs/assets/lockup-light.svg" height="42">
</picture>
</h1>

Fast, correct business-time arithmetic (working hours, SLAs, shifts) for Rust,
Python and JavaScript — a maintained replacement for
[businesstimedelta](https://github.com/seppemans/businesstimedelta), with a
compatibility layer for existing code.

[Documentation](https://karthik-beta.github.io/workclock/docs/) ·
[Playground](https://karthik-beta.github.io/workclock/playground/) ·
[Migrating from businesstimedelta](https://github.com/Karthik-beta/workclock/blob/main/MIGRATING.md)

> **Status:** pre-1.0; the API may still change in a minor release.

## Install

```sh
cargo add workclock jiff
pip install workclock
uv add workclock
npm i workclock
```

The Rust API takes and returns [jiff](https://docs.rs/jiff) 0.2 types, so
Rust code depends on jiff too.

## Use cases

- [Support-ticket SLAs](https://karthik-beta.github.io/workclock/docs/guides/support-slas/): when is a ticket
  due, and how much of its SLA has elapsed?
- [Payroll and overtime](https://karthik-beta.github.io/workclock/docs/guides/payroll-and-overtime/): how many
  hours of a shift fell inside contracted time?
- Staff rosters, including [overnight shifts](https://karthik-beta.github.io/workclock/docs/guides/overnight-shifts/).
- [Delivery ETAs](https://karthik-beta.github.io/workclock/docs/guides/delivery-etas/) that only count operating hours.

## Quickstart

A support desk in London works 09:00–17:00 on weekdays with a lunch hour,
and is closed on 25 and 28 December 2026. A ticket opened at 16:30 on
Christmas Eve with an 8-hour SLA is due at 09:30 on 30 December.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Karthik-beta/workclock/main/docs/assets/week-strip-dark.svg">
  <img alt="Week strip of the scenario: the 8 hours count from 16:30 on Thursday 24, all of Tuesday 29 and Wednesday 30 until 09:30, skipping the holidays on 25 and 28 December and the weekend." src="https://raw.githubusercontent.com/Karthik-beta/workclock/main/docs/assets/week-strip-light.svg">
</picture>

### Rust

```rust
use jiff::civil::{date, time};
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
}
```

API documentation is on [docs.rs](https://docs.rs/workclock).

### Python

```python
from datetime import date, datetime, time
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
support.between(opened, datetime(2026, 12, 29, 11, tzinfo=london))  # 2:30:00
```

`between_many`, `add_many` and `sub_many` take lists or NumPy arrays and
process them in one call. Most code written for businesstimedelta runs
unchanged with `import workclock.compat as businesstimedelta`;
[MIGRATING.md](https://github.com/Karthik-beta/workclock/blob/main/MIGRATING.md#intentional-differences)
lists where it differs.

### JavaScript

```js
import { Schedule } from "workclock";

const support = new Schedule({
  timeZone: "Europe/London",
  rules: [
    { type: "workday", start: "09:00", end: "17:00" },
    { type: "break", start: "12:00", end: "13:00" },
    { type: "holidays", dates: ["2026-12-25", "2026-12-28"] },
  ],
});

support.add("2026-12-24T16:30:00Z", 8 * 3_600_000); // Date 2026-12-30T09:30:00.000Z
support.between("2026-12-24T16:30:00Z", new Date("2026-12-29T11:00:00Z")); // 9000000 ms
```

Instants are `Date`s or ISO 8601 strings with an offset; durations are
milliseconds. In browsers without a bundler, import the default `init` from
`workclock/web` and `await init()` first.

More complete programs are in
[`crates/workclock/examples`](https://github.com/Karthik-beta/workclock/tree/main/crates/workclock/examples),
[`examples/python`](https://github.com/Karthik-beta/workclock/tree/main/examples/python) and
[`js/examples`](https://github.com/Karthik-beta/workclock/tree/main/js/examples).
The errors each binding raises are listed in
[DESIGN.md](https://github.com/Karthik-beta/workclock/blob/main/DESIGN.md#errors-and-termination).

## Why workclock

### Correct

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Karthik-beta/workclock/main/docs/assets/overnight-shift-dark.svg">
  <img alt="A 22:00–06:00 shift measured from Monday 22:00 to Tuesday 06:00: businesstimedelta 1.0.1 counts 0 hours, workclock counts 8." src="https://raw.githubusercontent.com/Karthik-beta/workclock/main/docs/assets/overnight-shift-light.svg">
</picture>

businesstimedelta 1.0.1 has had no release since 2019. workclock fixes:

- **Overnight shifts.** A 22:00–06:00 shift counts 0 hours between Monday
  22:00 and Tuesday 06:00, and adding 4 hours at Monday 22:00 lands on
  Wednesday. workclock gives 8 hours and Tuesday 02:00.
- **Crashes past the last holiday**
  ([#8](https://github.com/seppemans/businesstimedelta/issues/8),
  [#10](https://github.com/seppemans/businesstimedelta/issues/10)):
  `TypeError` once a query passes the last date in a holiday list.
- **Infinite loops** ([#9](https://github.com/seppemans/businesstimedelta/issues/9))
  when holidays and working hours use different time zones. Every workclock
  search is bounded.
- **Signed differences** ([#12](https://github.com/seppemans/businesstimedelta/issues/12)):
  `Schedule.between(a, b)` is negative when `b` is before `a`.
- **DST.** Working hours are wall-clock times in each rule's IANA zone, and
  ambiguous or skipped times resolve the way jiff, RFC 5545 and JavaScript
  Temporal do.

Every rule is specified with examples in
[DESIGN.md](https://github.com/Karthik-beta/workclock/blob/main/DESIGN.md), and
each binding is checked against a brute-force oracle with property-based tests.

### Fast

Medians from Python, in a
[GitHub Actions run](https://github.com/Karthik-beta/workclock/actions/runs/40265875573)
on a GitHub-hosted Ubuntu runner (AMD EPYC 7763, 4 cores):

| Case | businesstimedelta 1.0.1 | workclock | Speed-up |
|---|---|---|---|
| One call, a 5½-hour span | 167 µs | 3.89 µs | 43× |
| One call, a year with bank holidays | 50.8 ms | 85 µs | 600× |
| 1,000,000 pairs | 9.86 min | 2.11 s (`between_many` on NumPy arrays) | 280× |

The same single call takes 1.2 µs from Rust and 1.78 µs from JavaScript, and
6.78 µs through `workclock.compat`, which keeps the schedule it builds from
businesstimedelta's mutable rules until their attributes change. Runner CPUs
vary, so the times move from run to run; the speed-ups, measured within one
run, carry over better.
[benchmarks/RESULTS.md](https://github.com/Karthik-beta/workclock/blob/main/benchmarks/RESULTS.md)
has every case with p95s, and
[DESIGN.md](https://github.com/Karthik-beta/workclock/blob/main/DESIGN.md#performance)
explains where the time goes.

## Requirements

- **Rust:** 1.85 or later.
- **Python:** CPython 3.9 or later. The wheels use the stable ABI (abi3), one
  per platform: Linux x86_64 and aarch64 (manylinux and musllinux), macOS
  x86_64 and arm64, and Windows x64. Free-threaded CPython cannot load abi3
  wheels. Other platforms build from the sdist, which needs a Rust toolchain.
- **JavaScript:** Node.js 22 or later. Browsers load the package through a
  bundler, or without one from `workclock/web`.

### Time zone data

The Python wheels and the npm package bundle the IANA time zone database, so
they need no system tzdata. The npm package always uses its bundled copy,
whose zone rules are as current as the workclock release. The Python wheels
use the system database when there is one, and the bundled copy otherwise.

The Rust crate uses jiff's defaults: the system database
(`/usr/share/zoneinfo`, or the directory in `TZDIR`) on Linux and macOS, and
a bundled copy on Windows. On a Linux image without tzdata, as some slim and
distroless images are, every named zone, even `"UTC"`, is an unknown-zone
error. Install the `tzdata` package, point `TZDIR` at a zoneinfo directory,
or enable jiff's `tzdb-bundle-always` feature to bundle the database.

## Prior art & credits

workclock ports the test suite and the API of
[businesstimedelta](https://github.com/seppemans/businesstimedelta) by
Sebastiaan Boer, released under the MIT license. Its last release, 1.0.1,
was in September 2019, and issues
[#3](https://github.com/seppemans/businesstimedelta/issues/3),
[#8](https://github.com/seppemans/businesstimedelta/issues/8),
[#9](https://github.com/seppemans/businesstimedelta/issues/9),
[#10](https://github.com/seppemans/businesstimedelta/issues/10) and
[#12](https://github.com/seppemans/businesstimedelta/issues/12) remain open.
The ported API is `workclock.compat`, and the ported tests run against it in
CI. The original copyright notice is kept in
[NOTICE](https://github.com/Karthik-beta/workclock/blob/main/NOTICE).

## License

[MIT](https://github.com/Karthik-beta/workclock/blob/main/LICENSE)
