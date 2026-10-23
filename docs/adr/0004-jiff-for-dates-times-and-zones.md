# 0004. jiff for dates, times and time zones

- Status: Accepted
- Date: 2026-10-22

## Context

The core needs IANA time zones, DST-correct conversion between wall-clock
times and instants with an explicit policy for gaps and overlaps
([DESIGN.md](../../DESIGN.md#time-zones-and-dst)), nanosecond instants and
signed durations. It must build for `wasm32-unknown-unknown`, which has no
system time zone database, and convert cheaply to Python and JavaScript types.

Options considered:

- **chrono + chrono-tz:** mature and widely used, but gaps and overlaps
  surface as `LocalResult` values that every caller must disambiguate, and
  the zone database is compiled in through a separate crate.
- **time:** no IANA time zone support.
- **jiff 0.2:** IANA zones with a built-in disambiguation policy whose default
  ("compatible") matches RFC 5545 and Temporal, `Timestamp`, `Zoned` and
  `SignedDuration` types, a bundled tz database for platforms without one,
  and MSRV 1.70. PyO3 converts jiff types directly through its `jiff-02`
  feature.

## Decision

Use jiff 0.2 in the core crate. The public Rust API takes and returns
`jiff::Timestamp`, `jiff::Zoned` and `jiff::SignedDuration`.

The WASM build enables `tzdb-bundle-always`, because the browser offers no
zone database. Which database the native builds use is decided with the
bindings.

Update (2026-10-23): the Rust crate and the Python extension use jiff's
default features, so native builds read the system database and bundle one
only on Windows. The WASM build bundles it as above.

## Consequences

- One disambiguation policy is shared by all three bindings, so results agree
  across them.
- jiff is pre-1.0, and its types appear in workclock's public API. Upgrading
  to an incompatible jiff release is a breaking change for workclock.
- Bundling the database in WASM increases the package size, and its rules are
  only as current as the last workclock release.
