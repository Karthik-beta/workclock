# Shared test fixtures

`design_examples.json` holds every engine-level example from
[DESIGN.md](../../DESIGN.md) (the N and C examples are binding-specific and
live in the Python and JavaScript suites). The Rust, Python and JavaScript test
suites all run it, so the bindings cannot disagree on these cases.

- `schedules` maps a name to a schedule: a default `zone`, and lists of
  `workdays`, `breaks` and `holidays`. A rule has `start` and `end` (`HH:MM`),
  `days` (`mon` … `sun`) and an optional `zone`. A holiday entry has `dates`,
  inclusive `ranges` of dates, or both, and an optional `zone`.
- Each case has an `id` matching DESIGN.md, a `schedule` name and an `op`:
  - `between` with instants `a` and `b`; `expect.seconds` is the signed result.
  - `add` or `sub` with an instant `t` and a signed `seconds`; `expect.instant`
    is the result.
  - `build`, which only constructs the schedule.
- Instants are RFC 3339 with an offset and are compared as instants, not as
  strings. A case that must fail has `expect.error`: `no_working_time`,
  `out_of_range` or `unknown_zone`.
