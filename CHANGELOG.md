# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-10-25

### Fixed

- Python compat: `HolidayRule.difference` no longer raises `OverflowError`
  for datetimes whose local date is the first or last date `datetime.date`
  can hold.

## [0.1.0] - 2026-10-25

### Added

- Rust core: `Schedule` built from `WorkDay`, `Break` and `Holidays` rules,
  with `between`, `add`, `sub`, `next_period` and `previous_period`. Supports
  overnight and 24-hour shifts, per-rule IANA time zones and DST, as specified
  in `DESIGN.md`.
- Rust core: `Weekdays`, the set of days a rule applies to, and `Rule`, which
  every rule type converts into.
- Rust core: minimum supported Rust version 1.85.
- Python: typed `Schedule` API with `WorkDay`, `Break` and `Holidays` rules,
  `between`, `add`, `sub`, `next_period` and `previous_period` on
  timezone-aware datetimes. Accepts zone names, `zoneinfo.ZoneInfo`, pytz
  zones and `datetime.timezone.utc`. Errors subclass `WorkclockError` and the
  matching built-in exception.
- Python: `between_many`, `add_many` and `sub_many` process a batch in one
  call, from lists or NumPy `datetime64`/`timedelta64` arrays, which
  broadcast together under NumPy's rules.
- Python: `Schedule` pickles and deep-copies, so it can be passed to
  `multiprocessing` workers, and `workclock.Rule` names the type of its
  rules.
- Python: type hints with a `py.typed` marker, and a stub for the compiled
  extension.
- Python: `workclock.compat`, the businesstimedelta 1.0.1 API on the
  workclock engine, which fixes overnight shifts and upstream issues 8, 9 and
  10. Most code runs unchanged; `MIGRATING.md` lists the differences.
- Searches are bounded: a schedule without working time, or a result outside
  the supported range, is an error instead of a hang or a panic.
- npm package: `Schedule` with `between`, `add`, `sub`, `nextPeriod` and
  `previousPeriod`, taking `Date`s or ISO 8601 strings and milliseconds, and
  error classes for `instanceof` checks.
- npm package: `betweenMany`, `addMany` and `subMany` for arrays and
  `Float64Array`s of epoch milliseconds.
- npm package: runs on Node.js 22 and later, and in browsers through a
  bundler or, without one, from the `workclock/web` entry point.
- Python wheels use the stable ABI (abi3), so one wheel per platform covers
  CPython 3.9 and later.
- The Python wheels and the npm package bundle the IANA time zone database.
- Examples in Rust, Python and JavaScript: when a support ticket is due and
  how much of its SLA has been used.

[Unreleased]: https://github.com/Karthik-beta/workclock/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Karthik-beta/workclock/releases/tag/v0.1.1
[0.1.0]: https://github.com/Karthik-beta/workclock/releases/tag/v0.1.0
