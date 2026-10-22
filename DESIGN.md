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

Not in 0.1.0: converting a duration into business days or weeks (upstream
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

Every operation is defined on that working-time set, so the order in which
rules are given never matters.

## Rules

### WorkDay

`start_time`, `end_time`, `working_days` and a time zone.

- For each local date whose weekday is in `working_days`, the rule produces
  the block from `start_time` on that date to `end_time`.
- If `end_time <= start_time`, the shift is overnight and `end_time` falls on
  the next date. `start_time == end_time` is therefore a 24-hour shift.
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

### Holiday

A set of local dates in a time zone. Each date removes the block from 00:00 on
that date to 00:00 on the next date, so a holiday on a DST transition day lasts
23 or 25 hours.

Holiday dates are converted into a set once, when the schedule is built.
Bindings never call back into Python or JavaScript per date.

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
block lands on the block's end, not on the start of the next block (A2). For
`sub` the result lands on a block's start.

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
