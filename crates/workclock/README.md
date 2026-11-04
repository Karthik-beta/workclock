# workclock

[![CI](https://github.com/Karthik-beta/workclock/actions/workflows/ci.yml/badge.svg)](https://github.com/Karthik-beta/workclock/actions/workflows/ci.yml)
[![Crates.io](https://img.shields.io/crates/v/workclock.svg)](https://crates.io/crates/workclock)
[![Documentation](https://docs.rs/workclock/badge.svg)](https://docs.rs/workclock)
[![PyPI](https://img.shields.io/pypi/v/workclock.svg)](https://pypi.org/project/workclock/)
[![npm](https://img.shields.io/npm/v/workclock.svg)](https://www.npmjs.com/package/workclock)
[![License: MIT](https://img.shields.io/crates/l/workclock.svg)](https://github.com/Karthik-beta/workclock/blob/main/LICENSE)
[![MSRV 1.85](https://img.shields.io/badge/MSRV-1.85-blue.svg)](https://github.com/Karthik-beta/workclock/blob/main/Cargo.toml)
[![unsafe forbidden](https://img.shields.io/badge/unsafe-forbidden-success.svg)](https://github.com/Karthik-beta/workclock/blob/main/crates/workclock/src/lib.rs)
[![Conventional Commits](https://img.shields.io/badge/commits-conventional-fe5196.svg?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org/)

Fast, correct business-time arithmetic (working hours, SLAs, shifts) for Rust,
with Python and JavaScript bindings.

- How much working time lies between two datetimes?
- What datetime do you reach after adding or subtracting N working hours?

```sh
cargo add workclock jiff
```

The API takes and returns [jiff](https://docs.rs/jiff) 0.2 types.

```rust
use jiff::civil::time;
use jiff::{SignedDuration, Timestamp};
use workclock::{Schedule, Weekdays, WorkDay};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let schedule = Schedule::builder()
        .rule(WorkDay::new(time(22, 0, 0, 0), time(6, 0, 0, 0), Weekdays::MON_TO_FRI))
        .build()?;

    let monday_night: Timestamp = "2026-01-05T22:00:00Z".parse()?;
    let tuesday_morning: Timestamp = "2026-01-06T06:00:00Z".parse()?;
    assert_eq!(schedule.between(monday_night, tuesday_morning), SignedDuration::from_hours(8));
    assert_eq!(
        schedule.add(monday_night, SignedDuration::from_hours(4))?.to_string(),
        "2026-01-06T02:00:00Z",
    );
    Ok(())
}
```

## Other crates

[ule-hours](https://crates.io/crates/ule-hours) also does working-time
arithmetic on jiff, and adds paused SLA clocks, Easter-based holiday rules,
special days and holiday presets for several countries. If you need those, use
it. workclock is for the same engine in Rust, Python and JavaScript, and for
replacing businesstimedelta.

API documentation is on [docs.rs](https://docs.rs/workclock), and the
[repository](https://github.com/Karthik-beta/workclock) has the
specification and the Python and JavaScript bindings. Licensed under [MIT](https://github.com/Karthik-beta/workclock/blob/main/LICENSE).
