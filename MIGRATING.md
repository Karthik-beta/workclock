# Migrating from businesstimedelta

workclock ships a compatibility layer for
[businesstimedelta](https://github.com/seppemans/businesstimedelta) 1.0.1.
Most code migrates with one line:

```python
import workclock.compat as businesstimedelta
```

`WorkDayRule`, `LunchTimeRule`, `HolidayRule`, `Rules` and `BusinessTimeDelta`
take the same arguments and defaults, support the same operators and
`hours`/`seconds` properties, and treat naive datetimes as UTC. The
businesstimedelta test suite runs against `workclock.compat` in CI.

For new code, the typed API (`workclock.Schedule`) is smaller and stricter: it
rejects naive datetimes and returns a signed `between`.

## Fixed

| Upstream behaviour | workclock.compat |
|---|---|
| Overnight shifts: `difference(Mon 22:00, Tue 06:00)` is 0h, `Mon 22:00 + 4h` is Wed 02:00, `Tue 06:00 - 4h` raises `OverflowError` | 8h, Tue 02:00, Tue 02:00 |
| A holiday list that ends before the queried range raises `TypeError` ([#8](https://github.com/seppemans/businesstimedelta/issues/8), [#10](https://github.com/seppemans/businesstimedelta/issues/10)) | Dates after the last holiday are ordinary days |
| Holidays in a different zone from the working hours can loop forever ([#9](https://github.com/seppemans/businesstimedelta/issues/9)) | Terminates with the correct result |
| A time-off block that starts inside a working period does not always shorten it | Working time is always the union of working hours minus the union of time off |
| A rule without working time (such as `start_time == end_time`) hangs on addition | Raises `workclock.NoWorkingTimeError`; `difference` returns zero |
| Any search can run forever | Searches give up after a year, plus one day per holiday date, without working time |

## Intentional differences

- **Result time zone.** Results are in the `tzinfo` of the datetime you pass
  in, or UTC if it is naive. businesstimedelta sometimes returns the rule's
  zone instead. The instants are the same, so comparisons are unaffected.
- **Negative deltas.** Adding a negative `BusinessTimeDelta` subtracts, and
  subtracting one adds. businesstimedelta returned the start of the next
  block minus the amount.
- **Repeated times at the end of daylight saving time.** A rule boundary that
  falls in the repeated hour resolves to its first occurrence, as jiff, RFC
  5545 and JavaScript Temporal do. businesstimedelta's pytz `localize()` picks
  the second.
- **Holidays on DST transition days** last from midnight to midnight, so 23
  or 25 hours. businesstimedelta always removes 24 hours.
- **python-holidays objects** are read once, when the `HolidayRule` is
  created, after filling in every year from 1970 to 2100. Dates outside that
  window are not holidays, and holidays added to the object later are not
  seen. Lists of `datetime` objects raise `TypeError`; pass `date` objects.
- **`next()` and `previous()`** on `Rules` return the whole stretch of working
  time, so overlapping working-hour rules form one block. businesstimedelta
  returned the block of one rule.
- **Supported rules.** `Rules` accepts `WorkDayRule` and `LunchTimeRule` as
  working time, and `WorkDayRule`, `LunchTimeRule` and `HolidayRule` as time
  off. Subclasses of `Rule` that compute their own blocks, a `HolidayRule`
  used as working time, and nested `Rules` raise `TypeError`, because rules
  run on the engine rather than as Python code.
- **Default zone.** `tz` defaults to `datetime.timezone.utc` instead of
  `pytz.utc`; workclock does not depend on pytz. Zones may be IANA names,
  `zoneinfo.ZoneInfo`, pytz zones or `datetime.timezone.utc`. Fixed-offset
  `tzinfo` objects raise `TypeError`, because they have no IANA name.
- **Operators with other types.** `BusinessTimeDelta == x` and
  `BusinessTimeDelta - x` for unsupported `x` return `NotImplemented`, so
  Python raises `TypeError`, instead of raising `AttributeError` or returning
  `None`.
- **Errors** are `workclock.WorkclockError` subclasses that also inherit from
  `ValueError` or `OverflowError`, so existing `except` clauses keep working.
