//! The schedule and inputs shared by the Rust benchmarks.

use jiff::civil::{date, time};
use jiff::{SignedDuration, Timestamp};
use workclock::{Break, Holidays, Schedule, Weekdays, WorkDay};

pub fn office() -> Schedule {
    let holidays = [
        date(2026, 1, 1),
        date(2026, 4, 3),
        date(2026, 4, 6),
        date(2026, 5, 4),
        date(2026, 5, 25),
        date(2026, 8, 31),
        date(2026, 12, 25),
        date(2026, 12, 28),
        date(2027, 1, 1),
        date(2027, 3, 26),
        date(2027, 3, 29),
        date(2027, 5, 3),
        date(2027, 5, 31),
        date(2027, 8, 30),
        date(2027, 12, 27),
        date(2027, 12, 28),
    ];
    let days = Weekdays::MON_TO_FRI;
    Schedule::builder()
        .time_zone("Europe/London")
        .rule(WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), days))
        .rule(Break::new(time(12, 0, 0, 0), time(13, 0, 0, 0), days))
        .rule(Holidays::new(holidays))
        .build()
        .unwrap()
}

pub fn at(text: &str) -> Timestamp {
    text.parse().unwrap()
}

/// Pair `i` starts `i * 7919 mod 525600` minutes into 2026 and lasts
/// `i * 104729 mod 10080` minutes, so up to a week.
pub fn pairs(n: i64) -> Vec<(Timestamp, Timestamp)> {
    let base = at("2026-01-01T00:00:00Z");
    (0..n)
        .map(|i| {
            let start = base + SignedDuration::from_mins(i * 7919 % 525_600);
            let end = start + SignedDuration::from_mins(i * 104_729 % 10_080);
            (start, end)
        })
        .collect()
}
