# workclock

Fast, correct business-time arithmetic (working hours, SLAs, shifts) for Rust,
Python and JavaScript — a maintained, drop-in replacement for
[businesstimedelta](https://github.com/seppemans/businesstimedelta).

> **Status:** in development. No release has been published yet.

## Install

```sh
cargo add workclock
pip install workclock
uv add workclock
uv pip install workclock
npm i workclock
```

## Use cases

- Support-ticket SLAs: when is a ticket due, and how much of its SLA has elapsed?
- Payroll and overtime: how many hours of a shift fell inside contracted time?
- Staff rosters, including overnight shifts.
- Delivery ETAs that only count operating hours.

## Quickstart

A support desk in London works 09:00–17:00 on weekdays with a lunch hour,
and is closed on 25 and 28 December 2026. A ticket opened at 16:30 on
Christmas Eve with an 8-hour SLA is due at 09:30 on 30 December.

### Rust

```rust
use jiff::civil::{date, time};
use jiff::{SignedDuration, Zoned};
use workclock::{Break, Holidays, Schedule, Weekdays, WorkDay};

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
```

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
process them in one call. Code written for businesstimedelta runs unchanged
with `import workclock.compat as businesstimedelta`; see
[MIGRATING.md](MIGRATING.md).

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

More complete programs are in [`crates/workclock/examples`](crates/workclock/examples),
[`examples/python`](examples/python) and [`js/examples`](js/examples).

## Why workclock

### Correct

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

Every rule is specified with examples in [DESIGN.md](DESIGN.md), and each
binding is checked against a brute-force oracle with property-based tests.

## Prior art & credits

workclock builds on [businesstimedelta](https://github.com/seppemans/businesstimedelta)
by Sebastiaan Boer, released under the MIT license. Its last release, 1.0.1,
was in September 2019, and issues
[#3](https://github.com/seppemans/businesstimedelta/issues/3),
[#8](https://github.com/seppemans/businesstimedelta/issues/8),
[#9](https://github.com/seppemans/businesstimedelta/issues/9),
[#10](https://github.com/seppemans/businesstimedelta/issues/10) and
[#12](https://github.com/seppemans/businesstimedelta/issues/12) remain open.
workclock ports its test suite and offers its API as `workclock.compat`. The
original copyright notice is kept in [NOTICE](NOTICE).

## License

[MIT](LICENSE)
