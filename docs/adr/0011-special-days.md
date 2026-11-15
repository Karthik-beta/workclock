# 0011. Special days

- Status: Accepted
- Date: 2026-11-15

## Context

[Issue #161](https://github.com/Karthik-beta/workclock/issues/161) asks for
dates with other working hours, such as 08:00–12:00 on 24 December instead of
the usual 09:00–17:00. Until 0.2.0 a schedule could only express this with
time off, and time off can only remove working time. A break can shorten a day
that stays inside the usual hours, but it cannot make a day start earlier or
end later, and nothing can make a weekend date a working date. 08:00–12:00 on
a 9–17 day needs the hour from 08:00 that no WorkDay produces.

Options considered for what a special date does to the other rules:

- **Replace the whole calendar day.** Every block between 00:00 and 24:00 on
  the date is dropped and the special hours are used instead. This cuts
  overnight shifts in half. With 22–06 Mon–Fri and a special night 22–02 on
  Tuesday 2026-01-06, Monday's shift would lose its 00:00–06:00 on Tuesday,
  although nothing about Monday changed: `between(Tue 00:00, Tue 06:00)`
  would be 0h instead of 6h.
- **Override breaks and holidays on the date**, as ule-hours does. A special
  day would then have to cancel time off that rules for other dates produce,
  such as an overnight break that starts the day before or a holiday in
  another zone that overlaps the date. The result would depend on more
  interactions between rules, and "time off always wins" would no longer hold
  for every rule. Opening on a holiday is already possible: leave the date out
  of `Holidays`, and add a special day if its hours differ.
- **Replace only the WorkDay shifts that start on the date**, and keep breaks
  and holidays in force.

## Decision

Add a `SpecialDay` rule with `start`, `end`, a set of local `dates` and a time
zone that defaults to the schedule's, as specified in
[DESIGN.md](../../DESIGN.md#specialday):

- On each date it produces the block from `start` to `end`, exactly as WorkDay
  does on a matching weekday, overnight blocks and DST resolution included.
- A WorkDay shift whose start date, in its own WorkDay's zone, is a date of
  any SpecialDay rule is not produced. Dates compare as calendar dates. A
  shift that starts the date before and runs into a special date is kept.
- Breaks and holidays still apply, so a date that is both a holiday and a
  special day is not worked. Several special days on one date add up.
- Special days take no part in the build check, and each distinct special
  date adds seven days to the search bound, as each holiday date does.

The API is `SpecialDay::new(start, end, dates)` with `.time_zone(name)` in
Rust, `workclock.SpecialDay(start, end, dates, *, time_zone=None)` in Python
and `{ type: "specialday", start, end, dates, timeZone }` in JavaScript.
`workclock.compat` does not change.

## Consequences

- Shorter, longer and extra working days are one rule each, and the night
  shift that runs into a special date keeps all its hours.
- Working time stays the available blocks minus the time off, so rule order
  never matters and breaks, holidays and DST behave on special days as on any
  other date.
- A special day on a holiday has no effect. Users who expect it to open the
  holiday, as in ule-hours, have to remove the date from `Holidays`.
- A special date replaces the shifts of every WorkDay in the schedule. A
  schedule cannot keep one WorkDay's shifts and replace another's on the same
  date.
- Weeks near a special date are computed rather than reused, so, as with
  holidays, the cost of a long span grows with the number of weeks that hold
  special dates. Schedules without special days are unaffected.
