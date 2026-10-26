# workclock design

This document specifies what workclock computes. Every edge case has an
example with an ID, and every example becomes a test in each binding it
applies to.

Unless stated otherwise, examples use the week of Monday 2026-01-05, times are
UTC, and `9–17 Mon–Fri` means a WorkDay rule from 09:00 to 17:00 on Monday to
Friday.

## Scope

workclock answers two questions:

- How much working time lies between two instants?
- Which instant is reached after adding or subtracting an amount of working
  time?

Not in 0.1.1: converting a duration into business days or weeks (upstream
[seppemans/businesstimedelta#3](https://github.com/seppemans/businesstimedelta/issues/3)),
and per-date overrides of working hours.

## Model

- An **instant** is an absolute point in time. Inputs from every binding are
  converted to instants before any calculation.
- A **duration** is elapsed real time, not wall-clock time. It can be negative.
- A **block** is a half-open interval of instants, `[start, end)`.
- A **rule** produces blocks. It is either *available* (working time) or
  *time off*.
- A **schedule** combines rules. Its working time is the union of all
  available blocks minus the union of all time-off blocks.
- A **period** is a maximal block of working time.

Every operation is defined on that working-time set, so the order in which
rules are given never matters.

## Rules

### WorkDay

`start`, `end`, `days` and a time zone (`time_zone` in Rust and Python,
`timeZone` in JavaScript). compat's `WorkDayRule` keeps upstream's names,
`start_time`, `end_time` and `working_days`.

- For each local date whose weekday is in `days`, the rule produces the block
  from `start` on that date to `end`.
- If `end <= start`, the shift is overnight and `end` falls on the next date.
  `start == end` is therefore a 24-hour shift.
- A shift belongs to the weekday it starts on: a Friday 22:00–06:00 shift runs
  into Saturday, and no shift ends on Monday morning unless one starts on
  Sunday.
- A shift already in progress at the query instant counts from that instant.

| ID | Schedule | Query | Result |
|---|---|---|---|
| O1 | 22–06 Mon–Fri | `between(Mon 22:00, Tue 06:00)` | 8h |
| O2 | 22–06 Mon–Fri | `add(Mon 22:00, 4h)` | Tue 02:00 |
| O3 | 22–06 Mon–Fri | `sub(Tue 06:00, 4h)` | Tue 02:00 |
| O4 | 22–06 Mon–Fri | `add(Tue 02:00, 1h)` (Monday's shift in progress) | Tue 03:00 |
| O5 | 22–06 Mon–Fri | `between(Sat 00:00, Sat 06:00)` (Friday's shift) | 6h |
| O6 | 22–06 Mon–Fri | `between(Mon 00:00, Mon 06:00)` (no Sunday shift) | 0h |
| O7 | 00–00 Mon–Sun | `between(Mon 00:00, next Mon 00:00)` | 168h |
| O8 | 00–00 Mon–Fri | `between(Mon 00:00, next Mon 00:00)` | 120h |
| O9 | 09–09 Mon–Fri | `between(Mon 12:00, Tue 12:00)` | 24h |

O1–O3 are the cases businesstimedelta 1.0.1 gets wrong (0h, Wed 02:00 and
`OverflowError`).

### Break

Same shape as WorkDay, including overnight breaks, but time off. A break
outside working time has no effect.

| ID | Schedule | Query | Result |
|---|---|---|---|
| K1 | 9–17 Mon–Fri, break 12–13 Mon–Fri | `between(Mon 09:00, Mon 17:00)` | 7h |
| K2 | same | `between(Mon 12:30, Mon 14:00)` (starts inside the break) | 1h |
| K3 | same | `add(Mon 11:30, 1h)` | Mon 13:30 |
| K4 | same | `add(Mon 12:30, 30m)` | Mon 13:30 |
| K5 | same | `sub(Mon 13:30, 1h)` | Mon 11:30 |

### Holidays

A set of local dates in a time zone. Each date removes the block from 00:00 on
that date to 00:00 on the next date, so a holiday on a DST transition day is
shorter or longer than 24 hours by the size of the change (usually one hour).

Holiday dates are converted into a set once, when the schedule is built.
Bindings never call back into Python or JavaScript per date. A python-holidays
object passed to the typed Python `Holidays` therefore contributes only the
years it already holds; create it with `years=...`. One that holds no years
lists no dates, so `Holidays` raises `ValueError` for it.

A holiday removes calendar time, not whole shifts. An overnight shift that
crosses into a holiday loses only the part after midnight; a shift that starts
on a holiday keeps the part after the next midnight.

| ID | Schedule | Query | Result |
|---|---|---|---|
| H1 | 9–17 Mon–Fri, holiday Wed 2026-01-07 | `between(Mon 09:00, Sat 00:00)` | 32h |
| H2 | same | `add(Tue 16:00, 2h)` | Thu 10:00 |
| H3 | same | `between(Wed 12:00, Thu 12:00)` (starts inside the holiday) | 3h |
| H4 | same | `between(Mon 2027-01-04 09:00, 17:00)` (after the last holiday) | 8h |
| HO1 | 22–06 Mon–Fri, holiday Tue 2026-01-06 | `between(Mon 22:00, Tue 06:00)` | 2h |
| HO2 | same | `between(Tue 22:00, Wed 06:00)` | 6h |
| HO3 | same | `add(Mon 22:00, 3h)` | Wed 01:00 |

### Combining rules

Available blocks are merged, so overlapping rules never count time twice.
Time-off blocks are subtracted after merging.

| ID | Schedule | Query | Result |
|---|---|---|---|
| U1 | 9–17 Mon–Fri and 13–20 Mon–Fri | `between(Mon 00:00, Tue 00:00)` | 11h |

### Time zones of rules

Each rule has its own time zone. A schedule has a default zone, and rules
without an explicit zone inherit it. Holidays in particular default to the
schedule's zone, not UTC: a UTC holiday under a Los Angeles workday removes
16:00 the day before to 16:00 on the holiday, which is the mismatch behind
upstream
[seppemans/businesstimedelta#9](https://github.com/seppemans/businesstimedelta/issues/9).

| ID | Schedule | Query | Result |
|---|---|---|---|
| Z1 | 9–17 Mon–Fri Asia/Kolkata, holiday 2026-01-26 | `between(2026-01-26T03:30Z, 2026-01-26T11:30Z)` | 0h |
| Z2 | same | `add(Fri 2026-01-23T11:00Z, 1h)` | 2026-01-27T04:00Z (Tue 09:30 IST) |
| Z3 | 9–17 Mon–Fri America/Los_Angeles, holiday 2026-01-26 in the schedule's zone | `between(Mon 09:00 PST, Mon 17:00 PST)` | 0h |
| Z4 | same, holiday explicitly in UTC | same | 1h |
| Z5 | 9–18 Mon–Fri America/Santiago, break 12–13 | `between(2016-01-18 09:00, 18:00)` in America/Los_Angeles | 4h |

## Operations

Let `W` be the schedule's working time and `|W ∩ [a, b)|` the working time
inside `[a, b)`.

### between(a, b)

- `a <= b`: `|W ∩ [a, b)|`.
- `a > b`: `-between(b, a)`. The result is signed, like `b - a` for plain
  timedeltas, which resolves upstream
  [seppemans/businesstimedelta#12](https://github.com/seppemans/businesstimedelta/issues/12).
- `between(a, a)` is zero.

| ID | Schedule | Query | Result |
|---|---|---|---|
| B1 | 9–17 Mon–Fri | `between(Mon 10:00, Mon 12:00)` | 2h |
| B2 | same | `between(Fri 16:00, next Mon 10:00)` | 2h |
| B3 | same | `between(Sat 10:00, Sun 10:00)` | 0h |
| B4 | same | `between(Mon 12:00, Mon 10:00)` | -2h |
| B5 | same | `between(Mon 10:00, Mon 10:00)` | 0h |

### add(t, d) and sub(t, d)

- `d > 0`: `add` returns the earliest instant `x >= t` with
  `|W ∩ [t, x)| = d`. `sub` returns the latest instant `x <= t` with
  `|W ∩ [x, t)| = d`.
- `d = 0`: both return `t` unchanged, even outside working time.
- `d < 0`: `add(t, d) = sub(t, -d)` and `sub(t, d) = add(t, -d)`.

Because `add` returns the *earliest* such instant, a result that exhausts a
period lands on the period's end, not on the start of the next period (A2).
For `sub` the result lands on a period's start.

For every `t` and `d`, `between(t, add(t, d)) = d`. The reverse,
`sub(add(t, d), d) = t`, holds only when `t` is inside working time: from
outside, `sub` lands on the start of the working time that `add` consumed
(A4 then A9).

| ID | Schedule | Query | Result |
|---|---|---|---|
| A1 | 9–17 Mon–Fri | `add(Mon 10:00, 2h)` | Mon 12:00 |
| A2 | same | `add(Mon 16:00, 1h)` | Mon 17:00 |
| A3 | same | `add(Mon 17:00, 1h)` | Tue 10:00 |
| A4 | same | `add(Sat 10:00, 1h)` | Mon 2026-01-12 10:00 |
| A5 | same | `add(Sat 10:00, 0h)` | Sat 10:00 |
| A6 | same | `add(Mon 10:00, -2h)` | Fri 2026-01-02 16:00 |
| A7 | same | `sub(Tue 09:00, 1h)` | Mon 16:00 |
| A8 | same | `sub(Sat 10:00, 0h)` | Sat 10:00 |
| A9 | same | `sub(Mon 2026-01-12 10:00, 1h)` | Mon 2026-01-12 09:00 |
| A10 | same | `sub(Sat 10:00, 1h)` | Fri 16:00 |
| A11 | 9–17 Mon–Fri, break 12–13 | `add(Mon 12:30, 0h)` (inside the break) | Mon 12:30 |

### next_period(t) and previous_period(t)

Both return a period as `[start, end)`: a `Range<Timestamp>` in Rust, a
`(start, end)` tuple in the `tzinfo` of `t` in Python, and `{ start, end }`
`Date`s from `nextPeriod` and `previousPeriod` in JavaScript.

- `next_period(t)` returns the period that contains `t`, starting at `t`, or
  else the first period that starts after `t`. A period that ends at `t` does
  not contain it (P6).
- `previous_period(t)` returns the period that contains the instant just
  before `t`, ending at `t`, or else the last period that ends before `t`. A
  period that starts at `t` is skipped (P8).
- A period is a maximal stretch of working time, whichever rules produce it:
  an overnight shift is one period across midnight (P9), and shifts that touch
  or overlap form one period (P11, P12). Breaks and holidays split working
  time into separate periods (P13–P18).
- A period is capped at the search bound: `next_period` returns at most the
  bound from the period's start, and `previous_period` at most the bound up to
  its end (P19–P21). Only round-the-clock schedules have periods that long.
- `next_period` fails with the no-working-time error if no period starts
  within the search bound after `t`, and `previous_period` if none ends within
  the bound before `t` (P22, P23).
- If the search reaches the end of the supported range (the start, for
  `previous_period`) before finding working time, the result is the
  out-of-range error (P24). A period that runs into either end of the range
  stops there.

| ID | Schedule | Query | Result |
|---|---|---|---|
| P1 | 9–17 Mon–Fri | `next_period(Mon 10:00)` | Mon 10:00–17:00 |
| P2 | same | `previous_period(Mon 10:00)` | Mon 09:00–10:00 |
| P3 | same | `next_period(Sat 10:00)` | Mon 2026-01-12 09:00–17:00 |
| P4 | same | `previous_period(Sat 10:00)` | Fri 09:00–17:00 |
| P5 | same | `next_period(Mon 09:00)` | Mon 09:00–17:00 |
| P6 | same | `next_period(Mon 17:00)` | Tue 09:00–17:00 |
| P7 | same | `previous_period(Mon 17:00)` | Mon 09:00–17:00 |
| P8 | same | `previous_period(Tue 09:00)` | Mon 09:00–17:00 |
| P9 | 22–06 Mon–Fri | `next_period(Mon 23:00)` | Mon 23:00–Tue 06:00 |
| P10 | same | `previous_period(Tue 02:00)` | Mon 22:00–Tue 02:00 |
| P11 | 00–00 Mon–Fri | `next_period(Sat 10:00)` | Mon 2026-01-12 00:00–Sat 2026-01-17 00:00 |
| P12 | 9–17 Mon–Fri and 13–20 Mon–Fri | `next_period(Mon 10:00)` | Mon 10:00–20:00 |
| P13 | 9–17 Mon–Fri, break 12–13 | `next_period(Mon 12:30)` (inside the break) | Mon 13:00–17:00 |
| P14 | same | `previous_period(Mon 12:30)` | Mon 09:00–12:00 |
| P15 | 9–17 Mon–Fri, holiday Wed 2026-01-07 | `next_period(Tue 17:00)` | Thu 09:00–17:00 |
| P16 | same | `previous_period(Thu 09:00)` | Tue 09:00–17:00 |
| P17 | 22–06 Mon–Fri, holiday Tue 2026-01-06 | `next_period(Mon 22:00)` | Mon 22:00–Tue 00:00 |
| P18 | same | `next_period(Tue 00:00)` | Wed 00:00–06:00 |
| P19 | 00–00 Mon–Sun | `next_period(Mon 10:00)` | Mon 10:00–Wed 2027-01-06 10:00 (366 days) |
| P20 | 00–00 Mon–Sun, holiday Thu 2027-01-14 | `next_period(Mon 00:00)` | Mon 00:00–Wed 2027-01-13 00:00 (373 days) |
| P21 | same | `previous_period(Mon 2028-01-24 00:00)` | Sat 2027-01-16 00:00–Mon 2028-01-24 00:00 (373 days) |
| P22 | 9–10 every day Etc/GMT+3, break 9–10 every day America/Sao_Paulo | `next_period(Fri 2021-01-01 00:00)` | no-working-time error |
| P23 | same | `previous_period(Fri 2021-01-01 00:00)` | no-working-time error |
| P24 | 9–17 Mon–Fri | `next_period(Thu 9999-12-30 18:00)` | out-of-range error |

In P20 and P21 the holiday makes the bound 373 days, and each period would
otherwise run one day past it. P22's schedule builds because the break missed
the shift while Sao Paulo kept summer time; since Brazil dropped it in 2019,
the break covers the whole shift.

## Time zones and DST

Rule times are wall-clock times in the rule's zone. Durations are elapsed real
time, so a shift that spans a DST transition is an hour shorter or longer than
its wall-clock length.

When a rule boundary is not a unique local time, it is resolved with the
*compatible* strategy used by jiff's default, RFC 5545 and JavaScript
Temporal:

- **Gap** (spring forward): a time that does not exist moves forward by the
  length of the gap. 02:30 on a day when clocks jump from 02:00 to 03:00
  becomes 03:30.
- **Overlap** (fall back): a time that occurs twice resolves to the earlier
  occurrence.

If resolution leaves a block's start at or after its end, the block is empty
for that day (D8).

All examples use America/New_York unless noted. Clocks jump forward on
Sunday 2026-03-08 and back on Sunday 2026-11-01.

| ID | Schedule | Query | Result |
|---|---|---|---|
| D1 | 22–06 every day | `between(Sat 2026-03-07 22:00 EST, Sun 06:00 EDT)` | 7h |
| D2 | 22–06 every day | `between(Sat 2026-10-31 22:00 EDT, Sun 06:00 EST)` | 9h |
| D3 | 22–06 every day | `add(Sat 2026-03-07 22:00 EST, 7h)` | Sun 2026-03-08 06:00 EDT |
| D4 | 02:30–04:00 Sun | working time on 2026-03-08 | 03:30–04:00 EDT, 0.5h |
| D5 | 01:30–03:00 Sun | working time on 2026-11-01 | 01:30 EDT–03:00 EST, 2.5h |
| D6 | 00–00 every day, Europe/London | `between(Sun 2026-03-29 00:00 GMT, Mon 00:00 BST)` | 23h |
| D7 | 00–00 every day, holiday 2026-03-08 | `between(Sat 2026-03-07 00:00, Tue 2026-03-10 00:00)` | 48h |
| D8 | 02:30–03:00 Sun | working time on 2026-03-08 | none, 0h |
| D9 | 02:00–02:30 Sun | working time on 2026-03-08 | 03:00–03:30 EDT, 0.5h |

## Inputs and precision

| Binding | Instants | Durations | Precision |
|---|---|---|---|
| Rust | `jiff::Timestamp` or `jiff::Zoned` | `jiff::SignedDuration` | nanoseconds |
| Python | timezone-aware `datetime` | `timedelta` | microseconds |
| JavaScript | `Date` or ISO 8601 string with an offset | number of milliseconds | milliseconds |

Time zones are IANA names. Python accepts `zoneinfo.ZoneInfo` (via `.key`),
pytz zones (via `.zone`) and `datetime.timezone.utc`, and converts them to
names.

Results combine input instants, input durations and rule boundaries, and a
rule boundary is a wall-clock time shifted by a whole-second UTC offset. Results
are therefore exact at each binding's precision; nothing is rounded.

Inputs finer than a binding's precision are rejected rather than truncated:

- Python: NumPy `datetime64` and `timedelta64` values with digits below a
  microsecond raise `ValueError`.
- JavaScript: rule times and ISO 8601 strings with digits below a millisecond
  raise `RangeError`, and so do instants in a `Float64Array` that are not
  whole milliseconds. Durations must be whole milliseconds within
  ±`Number.MAX_SAFE_INTEGER`, or they raise `RangeError`.

**Naive datetimes.** The typed Python API raises `ValueError` for a datetime
without `tzinfo`, and the JavaScript API rejects an ISO string without an
offset. The compatibility layer treats naive datetimes as UTC, as
businesstimedelta does. NumPy `datetime64` values carry no zone, so the Python
batch methods read them as UTC and return `datetime64` results in UTC.
When the first argument of a batch method is a NumPy array, the two arguments
broadcast together under NumPy's rules; lists must have the same length.

| ID | Binding | Input | Result |
|---|---|---|---|
| N1 | Python typed | `schedule.between(datetime(2026, 1, 5, 10), aware)` | `ValueError` |
| N2 | JavaScript | `schedule.between("2026-01-05T10:00", "2026-01-05T12:00Z")` | `RangeError` |
| N3 | Python compat | `rule.difference(datetime(2026, 1, 5, 10), datetime(2026, 1, 5, 12))`, 9–17 UTC | 2h |

## Errors and termination

Every search is bounded, and failures are errors, never hangs
([seppemans/businesstimedelta#9](https://github.com/seppemans/businesstimedelta/issues/9)).
Library code does not panic.

- **No working time.** Building a schedule fails if it has no available rule,
  or if its available time minus its breaks is empty over a 14-day reference
  window (Monday 2001-01-01 onward, UTC). Holidays are excluded from this
  check because there are finitely many of them.
- **Search bound.** `add`, `sub`, `next_period` and `previous_period` stop
  with the same error if they cross 366 days, plus seven days per holiday
  date, without finding working time. Without holidays, a schedule whose
  rules share one zone repeats every week, except that a DST change can skip
  a week's working time (D8), which happens at most twice a year. A holiday
  removes one day of calendar time, which can hide one week's working time
  (E7, E8), so each date can lengthen a gap by at most a week. After a
  successful build the bound can therefore trip only for schedules whose rules
  use different zones whose DST changes keep them apart for longer than a
  year, or, in theory, for decades of holidays that all fall on the only
  working day.
- **Past the last holiday.** Holidays are a finite set; searching beyond the
  last date simply finds no more time off
  ([seppemans/businesstimedelta#8](https://github.com/seppemans/businesstimedelta/issues/8),
  [#10](https://github.com/seppemans/businesstimedelta/issues/10)).
- **Out of range.** A result outside jiff's timestamp range
  (`-009999-01-02T01:59:59Z` to `9999-12-30T22:00:00Z`) is an error.
- **Unknown zone.** An unknown IANA name is an error when the schedule is
  built.

| ID | Schedule | Query | Result |
|---|---|---|---|
| E1 | no rules | build | no-working-time error |
| E2 | 9–17 with no working days | build | no-working-time error |
| E3 | 9–17 Mon–Fri, break 9–17 Mon–Fri | build | no-working-time error |
| E4 | 9–17 Mon–Fri, holidays every date from 2026-01-01 to 2035-12-29 | `add(2026-01-01 00:00, 1h)` | Mon 2035-12-31 10:00 |
| E5 | 9–17 Mon–Fri | `add(Thu 9999-12-30 16:00, 2h)` | out-of-range error |
| E6 | zone `Mars/Olympus_Mons` | build | unknown-zone error |
| E7 | 9–17 Mondays only, holidays every Monday from 2026-01-12 to 2027-03-15 (62 dates) | `add(Tue 2026-01-06 00:00, 1h)` | Mon 2027-03-22 10:00 |
| E8 | same | `sub(Mon 2027-03-22 09:00, 1h)` | Mon 2026-01-05 16:00 |

### Error types

| Error | Rust (`workclock::Error`) | Python (`workclock`) | JavaScript (`workclock`) |
|---|---|---|---|
| no working time | `Error::NoWorkingTime` | `NoWorkingTimeError(WorkclockError, ValueError)` | `NoWorkingTimeError`, `kind` `"no_working_time"` |
| out of range | `Error::OutOfRange` | `OutOfRangeError(WorkclockError, OverflowError)` | `OutOfRangeError`, `kind` `"out_of_range"` |
| unknown zone | `Error::UnknownZone { name }` | `UnknownZoneError(WorkclockError, ValueError)` | `UnknownZoneError`, `kind` `"unknown_zone"` |

- Rust's `Error` is `#[non_exhaustive]`. A kind added later reaches Python as
  a plain `WorkclockError`, and JavaScript as a `WorkclockError` with `kind`
  `"unknown"`.
- JavaScript's error classes extend `WorkclockError`. The values thrown are
  `Error` objects whose `name` is the class name; `instanceof` checks their
  `kind`, so it works across the node, bundler and web builds.
- Malformed input is not a `WorkclockError`. Python raises `TypeError` for a
  wrong type and `ValueError` for a bad value, such as a naive datetime;
  JavaScript raises `TypeError` and `RangeError` in the same way; `add` and
  `sub` take only numbers, so a string or `BigInt` duration is a `TypeError`
  rather than being converted.
- The Python and JavaScript no-working-time errors say which cause they have:
  building names the empty working hours, and a failed search names the bound
  and the instant it started from. Rust's `Error::NoWorkingTime` has one
  message for both.
- In batch methods, the message of an error caused by one item starts with
  `item {i}: `, where `i` is the item's zero-based index.

## Compatibility layer

`workclock.compat` mirrors businesstimedelta 1.0.1: `WorkDayRule`,
`LunchTimeRule`, `HolidayRule`, `Rules` and `BusinessTimeDelta`, with the same
arguments, defaults, operators and `hours`/`seconds` properties. It runs on the
same engine as the typed API. Migrating is one line:

```python
import workclock.compat as businesstimedelta
```

Where 1.0.1 is correct, compat returns exactly what it returns. Upstream
behaviours that callers may rely on are kept even where the typed API differs:

- `difference` is always non-negative (C1).
- Adding or subtracting zero snaps to the next or previous working instant
  (C2, C3).
- `start_time == end_time` is an empty rule, as upstream's own test expects
  (C4).
- `hours` is whole hours, and `seconds` is the remainder below one hour (C5).
- `difference` drops microseconds (C6).
- Naive datetimes are UTC, and every rule's `tz` defaults to UTC rather than
  inheriting a schedule zone.

Upstream defects are fixed:

- Overnight shifts are counted correctly (C7).
- Holidays past the end of a list, or in another zone, no longer raise or
  loop forever.
- A time-off block that starts inside a period always shortens it.
- A schedule without working time raises instead of hanging (C4).

`HolidayRule` accepts a list of dates or a python-holidays object. The dates
are copied once, at construction. python-holidays objects fill in years on
demand, so compat first fills in every year from 1970 to 2100, plus any years
the object already holds; dates outside that window are not holidays (C8, C9).

DST overlaps resolve to the earlier occurrence, while upstream's pytz
`localize()` picks the later one. Results therefore differ for rule
boundaries inside a repeated hour.

Every difference is listed in `MIGRATING.md`.

| ID | Rules | Call | compat | 1.0.1 |
|---|---|---|---|---|
| C1 | 9–17 Mon–Fri UTC | `difference(Mon 12:00, Mon 10:00)` | 2h | same |
| C2 | same | `Sat 10:00 + BusinessTimeDelta(rule, hours=0)` | Mon 2026-01-12 09:00 | same |
| C3 | same | `Sat 10:00 - BusinessTimeDelta(rule, hours=0)` | Fri 17:00 | same |
| C4 | 09:00–09:00 Mon–Fri | `difference(Mon 12:00, Tue 12:00)`; then `+ BusinessTimeDelta(rule, hours=1)` | 0h; raises | 0h; hangs |
| C5 | 9–17 Mon–Fri UTC | `BusinessTimeDelta(rule, timedelta=timedelta(hours=2, seconds=1))` | `hours == 2`, `seconds == 1` | same |
| C6 | same | `difference(Mon 10:00, Mon 10:00:00.999999)` | 0h, 0s | same |
| C7 | 22–06 Mon–Fri UTC | O1, O2, O3 | 8h; Tue 02:00; Tue 02:00 | 0h; Wed 02:00; `OverflowError` |
| C8 | 9–17 Mon–Fri UTC, `HolidayRule(holidays.US())` | `difference(Fri 2026-07-03 09:00, 17:00)` (Independence Day, observed) | 0h | 0h |
| C9 | same | `difference(Mon 2101-07-04 09:00, 17:00)` (outside the window) | 8h | `TypeError` |

## Performance

[benchmarks/](benchmarks/) measures three cases from every language: one short
`between`, one `between` across a year with bank holidays, and `between` for
1,000,000 pairs of up to a week each. Medians from
[benchmarks/RESULTS.md](benchmarks/RESULTS.md), which comes from a
[GitHub Actions run](https://github.com/Karthik-beta/workclock/actions/runs/40265875573)
on a GitHub-hosted Ubuntu runner:

| Case | Rust | JavaScript | Python | compat | businesstimedelta 1.0.1 |
|---|---|---|---|---|---|
| single | 1.2 µs | 1.78 µs | 3.89 µs | 6.78 µs | 167 µs |
| year | 84.9 µs | 107 µs | 85 µs | 88.1 µs | 50.8 ms |
| batch, 1M pairs | 1.95 s | 2.55 s | 2.11 s | 7.91 s | 9.86 min |

The batch row uses the fastest form each binding offers: `betweenMany` on
`Float64Array`s and `between_many` on NumPy arrays. compat and
businesstimedelta loop over the pairs in Python. In the year case the engine's
work dominates, so Rust and Python are level, and JavaScript, running the
engine as WebAssembly, takes about a quarter longer. Runner CPUs vary between
runs: three runs on 2026-10-26 differed by about 20% in time, but the
speed-ups over businesstimedelta stayed within about 6%.

**Algorithm.** The engine computes working time a week at a time: it builds
the week's intervals from every rule and subtracts breaks and holidays. A
week with no DST transition and no holiday near it is the same as the week
before, so a long span adds the previous week's total instead of rebuilding
it. The cost of a span therefore depends on how many of its weeks hold
holidays or DST changes, not on its length. businesstimedelta walks the span
one period at a time in Python.

**Crossing the boundary.** The engine needs about 1.2 µs for the single case.
A call from JavaScript costs about 0.6 µs more. A call from the typed Python
API costs about 2.7 µs more, spent converting aware datetimes to epoch
microseconds and the result back to a `timedelta`, and in the call itself.
compat adds about 3 µs on top. It keeps the engine schedule it built from its
rule objects, but because businesstimedelta's rules are mutable, every call
compares the attributes the schedule was built from with their current
values, and builds it again only when they differ.

**Batches.** A batch call converts its inputs once and then runs the engine
on every pair with the GIL released. With NumPy arrays the conversion is
vectorized, and 1M pairs take about as long as from Rust. From lists of
datetimes the per-item conversion stays in Python (3.4 s), and a loop of
`between` calls pays the whole crossing every time (4.51 s). In JavaScript the
crossing is cheap: a loop is only 3% slower than `betweenMany` on
`Float64Array`s.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Sign of `between(a, b)` for `b < a` | negative | Antisymmetric like timedelta subtraction; fixes upstream issue 12 in the typed API. |
| `add(t, 0)` outside working time | returns `t` | Follows from the definition of `add`; snapping would make `add(t, 0) != t`. Compat keeps snapping. |
| `start_time == end_time` | 24-hour shift | Consistent with `end <= start` meaning overnight; expresses round-the-clock coverage. |
| Holiday vs overnight shift | removes calendar time only | A holiday is defined as 00:00–24:00; keeps rules independent and composable. |
| DST disambiguation | compatible | Same as jiff, RFC 5545 and Temporal, so the three bindings agree with their ecosystems. |
| Holiday zone default | schedule's zone | Avoids the UTC/local mismatch behind upstream issue 9. |
| python-holidays objects | typed `Holidays`: only the years the object holds, and `ValueError` if it holds none; compat `HolidayRule`: every year from 1970 to 2100 first | Keeps "convert once at construction"; no per-date or per-year FFI. Rejecting an object with no years stops it from silently removing nothing. Compat fills in years because upstream code passes objects that fill them in on demand. |
| Duration-to-business-days (upstream issue 3) | not in 0.1.1 | A formatting feature, not a correctness fix. |
