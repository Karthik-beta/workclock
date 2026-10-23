# workclock

Business-time arithmetic for JavaScript and TypeScript: working hours, breaks,
holidays and IANA time zones, compiled from Rust to WebAssembly.

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

## Browsers without a bundler

Import from `workclock/web`, and call its default export once before using
anything else: `await init()` fetches the WebAssembly module next to the
script. With a bundler, or in Node.js, import from `workclock` as above.

## Links

- [Repository](https://github.com/Karthik-beta/workclock)
- [Specification and examples](https://github.com/Karthik-beta/workclock/blob/main/DESIGN.md)
- [JavaScript examples](https://github.com/Karthik-beta/workclock/tree/main/js/examples)
- [Changelog](https://github.com/Karthik-beta/workclock/blob/main/CHANGELOG.md)

MIT licensed.
