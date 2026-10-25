# workclock

Fast, correct business-time arithmetic (working hours, SLAs, shifts) for
Python, with a Rust core — a maintained replacement for
[businesstimedelta](https://pypi.org/project/businesstimedelta/), with a
compatibility layer for existing code.

> **Status:** pre-1.0; the API may still change in a minor release.

## Install

```sh
pip install workclock
uv add workclock
```

Requires CPython 3.9 or later. The wheels use the stable ABI (abi3), one per
platform: Linux x86_64 and aarch64 (manylinux and musllinux), macOS x86_64
and arm64, and Windows x64. Free-threaded CPython cannot load abi3 wheels.
Other platforms build from the sdist, which needs a Rust toolchain.

The wheels bundle the IANA time zone database. They use the system database
when there is one, and the bundled copy otherwise, so they need no `tzdata`
package.

## Quickstart

A support desk in London works 09:00–17:00 on weekdays with a lunch hour,
and is closed on 25 and 28 December 2026. A ticket opened at 16:30 on
Christmas Eve with an 8-hour SLA is due at 09:30 on 30 December.

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
support.next_period(opened)  # (16:30, 17:00) on 24 December
```

Datetimes must be timezone-aware, and results keep the `tzinfo` you pass in.
Zones can be IANA names, `zoneinfo.ZoneInfo`, pytz zones or
`datetime.timezone.utc`. Errors subclass `workclock.WorkclockError` and the
matching built-in exception.

### Batches and NumPy

`between_many`, `add_many` and `sub_many` take lists of datetimes, or NumPy
`datetime64` and `timedelta64` arrays, and process them in one call:

```python
from datetime import datetime, time, timedelta, timezone

from workclock import Schedule, WorkDay

office = Schedule([WorkDay(time(9), time(17))])
tickets = [datetime(2026, 1, 5, 16, tzinfo=timezone.utc)] * 3
office.add_many(tickets, timedelta(hours=2))  # Tuesday 10:00, three times
```

## Coming from businesstimedelta

Most code written for
[businesstimedelta](https://pypi.org/project/businesstimedelta/) runs
unchanged on workclock's engine:

```python
import datetime

import workclock.compat as businesstimedelta

rule = businesstimedelta.WorkDayRule(datetime.time(9), datetime.time(17))
friday = datetime.datetime(2026, 1, 9, 16)
friday + businesstimedelta.BusinessTimeDelta(rule, hours=2)  # Monday 10:00 UTC
```

[MIGRATING.md](https://github.com/Karthik-beta/workclock/blob/main/MIGRATING.md#intentional-differences)
lists where it differs.

## Why workclock

### Correct

[businesstimedelta](https://pypi.org/project/businesstimedelta/) 1.0.1 has
had no release since 2019. workclock fixes:

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
  ambiguous or skipped times resolve the way RFC 5545 and JavaScript Temporal
  do.

Every rule is specified with examples in
[DESIGN.md](https://github.com/Karthik-beta/workclock/blob/main/DESIGN.md),
and the package is checked against a brute-force oracle with property-based
tests.

### Fast

Medians on a 2017 laptop (Intel i5-8250U, Windows 11):

| Case | businesstimedelta 1.0.1 | workclock | Speed-up |
|---|---|---|---|
| One call, a 5½-hour span | 385 µs | 8.5 µs | 45× |
| One call, a year with bank holidays | 134 ms | 163 µs | 820× |
| 1,000,000 pairs | 22.5 min | 2.92 s (`between_many` on NumPy arrays) | 460× |

The same single call takes 16 µs through `workclock.compat`.
[benchmarks/RESULTS.md](https://github.com/Karthik-beta/workclock/blob/main/benchmarks/RESULTS.md)
has every case with p95s.

## Also for Rust and JavaScript

The same engine ships as the [`workclock`](https://crates.io/crates/workclock)
crate and the [`workclock`](https://www.npmjs.com/package/workclock) npm
package, with the same results in every language.

## Prior art & credits

workclock ports the test suite and the API of
[businesstimedelta](https://pypi.org/project/businesstimedelta/) by
Sebastiaan Boer, released under the MIT license. The ported API is
`workclock.compat`, and the ported tests run against it in CI. The original
copyright notice is kept in
[NOTICE](https://github.com/Karthik-beta/workclock/blob/main/NOTICE).

## License

[MIT](https://github.com/Karthik-beta/workclock/blob/main/LICENSE)
