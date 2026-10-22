//! proptest strategies for random schedules and queries.
//!
//! Queries fall in 2026, which contains DST transitions in every zone used
//! here except Asia/Kolkata. All values are whole minutes, as the oracle
//! requires.

use jiff::{SignedDuration, Timestamp};
use proptest::prelude::*;

use super::spec::{HolidaySpec, RuleSpec, ScheduleSpec};

pub const ZONES: [&str; 4] = ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London"];
const DAYS: [&str; 7] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const YEAR_START: i64 = 1_767_225_600; // 2026-01-01T00:00:00Z
const MINUTES_IN_YEAR: i64 = 365 * 24 * 60;

fn zone() -> impl Strategy<Value = String> {
    prop::sample::select(&ZONES[..]).prop_map(str::to_owned)
}

fn time_of_day() -> impl Strategy<Value = String> {
    (0u32..24, prop::sample::select(&[0u32, 15, 30, 45][..]))
        .prop_map(|(h, m)| format!("{h:02}:{m:02}"))
}

/// Start and end are drawn independently, which also yields overnight shifts
/// and 24-hour shifts (`start == end`).
fn rule() -> impl Strategy<Value = RuleSpec> {
    (
        time_of_day(),
        time_of_day(),
        prop::sample::subsequence(&DAYS[..], 1..=7),
        prop::option::weighted(0.2, zone()),
    )
        .prop_map(|(start, end, days, zone)| RuleSpec {
            start,
            end,
            days: days.into_iter().map(str::to_owned).collect(),
            zone,
        })
}

fn holidays() -> impl Strategy<Value = HolidaySpec> {
    (
        prop::collection::vec(0i64..365, 1..=4),
        prop::option::weighted(0.2, zone()),
    )
        .prop_map(|(offsets, zone)| HolidaySpec {
            dates: offsets
                .into_iter()
                .map(|d| {
                    instant(d * 24 * 60)
                        .to_zoned(jiff::tz::TimeZone::UTC)
                        .date()
                        .to_string()
                })
                .collect(),
            ranges: Vec::new(),
            zone,
        })
}

pub fn schedule() -> impl Strategy<Value = ScheduleSpec> {
    (
        zone(),
        prop::collection::vec(rule(), 1..=2),
        prop::collection::vec(rule(), 0..=2),
        prop::option::of(holidays()),
    )
        .prop_map(|(zone, workdays, breaks, holidays)| ScheduleSpec {
            zone,
            workdays,
            breaks,
            holidays: holidays.into_iter().collect(),
        })
}

fn instant(minutes_into_2026: i64) -> Timestamp {
    Timestamp::from_second(YEAR_START + minutes_into_2026 * 60).expect("2026 is in range")
}

/// An instant in 2026.
pub fn moment() -> impl Strategy<Value = Timestamp> {
    (0..MINUTES_IN_YEAR).prop_map(instant)
}

/// A start instant in 2026 and an instant up to `max_days` after it.
pub fn span(max_days: i64) -> impl Strategy<Value = (Timestamp, Timestamp)> {
    (0..MINUTES_IN_YEAR, 0..=max_days * 24 * 60).prop_map(|(a, len)| (instant(a), instant(a + len)))
}

/// A signed amount of working time of at most `max_hours`.
pub fn duration(max_hours: i64) -> impl Strategy<Value = SignedDuration> {
    (-max_hours * 60..=max_hours * 60).prop_map(SignedDuration::from_mins)
}
