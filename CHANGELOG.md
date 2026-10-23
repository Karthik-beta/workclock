# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Rust core: `Schedule` built from `WorkDay`, `Break` and `Holidays` rules,
  with `between`, `add`, `sub`, `next_period` and `previous_period`. Supports
  overnight and 24-hour shifts, per-rule IANA time zones and DST, as specified
  in `DESIGN.md`.
- Python: typed `Schedule` API with `WorkDay`, `Break` and `Holidays` rules,
  `between`, `add`, `sub`, `next_period` and `previous_period` on
  timezone-aware datetimes. Accepts zone names, `zoneinfo.ZoneInfo` and pytz
  zones. Errors subclass `WorkclockError` and the matching built-in exception.
- Python: `between_many`, `add_many` and `sub_many` process a batch in one
  call, from lists or NumPy `datetime64`/`timedelta64` arrays.
- Python: `workclock.compat`, a drop-in replacement for businesstimedelta
  1.0.1 that fixes overnight shifts and upstream issues 8, 9 and 10. See
  `MIGRATING.md`.
- Searches are bounded: a schedule without working time, or a result outside
  the supported range, returns an `Error` instead of looping or panicking.
- npm package: `Schedule` with `between`, `add`, `sub`, `nextPeriod` and
  `previousPeriod`, taking `Date`s or ISO 8601 strings and milliseconds, and
  error classes for `instanceof` checks.
- npm package: `betweenMany`, `addMany` and `subMany` for arrays and
  `Float64Array`s of epoch milliseconds.

[Unreleased]: https://github.com/Karthik-beta/workclock/commits/main
