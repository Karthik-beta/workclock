# workclock

[![CI](https://github.com/Karthik-beta/workclock/actions/workflows/ci.yml/badge.svg)](https://github.com/Karthik-beta/workclock/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/workclock.svg)](https://www.npmjs.com/package/workclock)
[![Node.js](https://img.shields.io/node/v/workclock.svg)](https://nodejs.org/)
[![TypeScript types included](https://img.shields.io/badge/types-included-blue.svg)](https://workclock.karthik.nz/docs/reference/javascript/)
[![License: MIT](https://img.shields.io/npm/l/workclock.svg)](https://github.com/Karthik-beta/workclock/blob/main/LICENSE)

Business-time arithmetic for JavaScript and TypeScript: working hours, breaks,
holidays and IANA time zones, compiled from Rust to WebAssembly.

[Documentation](https://workclock.karthik.nz/docs/) ·
[JavaScript reference](https://workclock.karthik.nz/docs/reference/javascript/) ·
[Playground](https://workclock.karthik.nz/playground/)

> **Status:** pre-1.0; the API may still change in a minor release.

## Install

```sh
npm install workclock
```

It runs on Node.js 22 or later, in bundlers and in browsers, and ships its
TypeScript types.

## Quickstart

A London support desk works 09:00–17:00 with a lunch break, and is closed on
Christmas Day and the substitute Boxing Day holiday. A ticket opened at 16:30
on Christmas Eve with an 8-hour SLA:

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
support.nextPeriod("2026-12-29T11:00:00Z").end; // Date 2026-12-29T12:00:00.000Z
```

`sub` counts back, and `previousPeriod` finds the period of working time at or
before an instant. Rules are `"workday"`, `"break"` or `"holidays"`; times are
`HH:MM[:SS[.fff]]`, `days` defaults to Monday to Friday, and each rule can set
its own `timeZone`.

## Instants and durations

- Instants are `Date`s or ISO 8601 strings with a UTC offset, such as
  `"2026-01-05T09:00:00Z"` or `"2026-01-05T10:00:00+01:00"`. A string without
  an offset is rejected.
- Durations are whole numbers of milliseconds, negative to go back in time.
  Any other type throws `TypeError`; it is not converted.
- Results are `Date`s and numbers, exact to the millisecond.
- The supported range is -009999-01-02T01:59:59Z to 9999-12-30T22:00:00Z.

`betweenMany`, `addMany` and `subMany` take arrays of instants, or a
`Float64Array` of epoch milliseconds for the fastest path, and process them in
one call.

## Errors

Schedule errors are instances of `WorkclockError`, with a `kind`:

| Class | `kind` | Thrown when |
|---|---|---|
| `NoWorkingTimeError` | `"no_working_time"` | The rules have no working time, or a search finds none within 366 days, plus seven days per holiday date. |
| `OutOfRangeError` | `"out_of_range"` | An instant or a result is outside the supported range. |
| `UnknownZoneError` | `"unknown_zone"` | A time zone is not in the IANA database. |

`WorkclockError` itself has the kind `"unknown"`. Malformed input, such as a
rule without `start` or a string without an offset, throws a built-in
`TypeError` or `RangeError` instead.

## Why workclock

- **Overnight shifts.** A 22:00–06:00 shift belongs to the day it starts, so
  Monday 22:00 to Tuesday 06:00 is 8 hours of working time.
- **DST.** Working hours are wall-clock times in each rule's IANA zone, and
  ambiguous or skipped times resolve the way JavaScript Temporal does.
- **Bounded.** Every search is bounded: a schedule with no working time
  throws `NoWorkingTimeError` instead of hanging.
- **Fast.** One call over a 5½-hour span takes 1.77 µs, 5.1× faster than the
  same loop written with `Temporal`, in a
  [GitHub Actions run](https://github.com/Karthik-beta/workclock/actions/runs/40285792116).
  [Benchmarks](https://workclock.karthik.nz/docs/benchmarks/) has every case.
- **One engine.** The same Rust core ships as the
  [`workclock`](https://crates.io/crates/workclock) crate and the
  [`workclock`](https://pypi.org/project/workclock/) Python package, with the
  same results in every language.

Every rule is specified with examples in
[DESIGN.md](https://github.com/Karthik-beta/workclock/blob/main/DESIGN.md), and the package is checked against a
brute-force oracle with property-based tests.

## Browsers without a bundler

Import from `workclock/web`, and call its default export once before using
anything else: `await init()` fetches `workclock_bg.wasm` from the package's
`pkg/web/` directory, so serve that directory with your page. With a bundler,
or in Node.js, import from `workclock` as above.

## Links

- [Documentation](https://workclock.karthik.nz/docs/)
- [Repository](https://github.com/Karthik-beta/workclock)
- [Specification and examples](https://github.com/Karthik-beta/workclock/blob/main/DESIGN.md)
- [JavaScript examples](https://github.com/Karthik-beta/workclock/tree/main/js/examples)
- [Changelog](https://github.com/Karthik-beta/workclock/blob/main/CHANGELOG.md)

MIT licensed.
