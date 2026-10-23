# workclock

Fast, correct business-time arithmetic (working hours, SLAs, shifts) for Rust,
with Python and JavaScript bindings.

- How much working time lies between two datetimes?
- What datetime do you reach after adding or subtracting N working hours?

```rust
use jiff::civil::time;
use jiff::{SignedDuration, Timestamp};
use workclock::{Schedule, Weekdays, WorkDay};

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
# Ok::<(), Box<dyn std::error::Error>>(())
```

See the [repository](https://github.com/Karthik-beta/workclock) for
documentation. Licensed under [MIT](https://github.com/Karthik-beta/workclock/blob/main/LICENSE).
