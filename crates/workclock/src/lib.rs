//! Business-time arithmetic: how much working time lies between two instants,
//! and which instant is reached after adding or subtracting working time.
//!
//! Working time is defined by composable rules (working days and hours,
//! breaks and holidays) evaluated in IANA time zones, including overnight
//! shifts. The exact semantics, with an example for every edge case, are in
//! [DESIGN.md](https://github.com/Karthik-beta/workclock/blob/main/DESIGN.md).
//!
//! # Examples
//!
//! ```
//! use jiff::civil::{date, time};
//! use jiff::{SignedDuration, Zoned};
//! use workclock::{Break, Holidays, Schedule, Weekdays, WorkDay};
//!
//! let schedule = Schedule::builder()
//!     .time_zone("Europe/London")
//!     .rule(WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI))
//!     .rule(Break::new(time(12, 0, 0, 0), time(13, 0, 0, 0), Weekdays::MON_TO_FRI))
//!     .rule(Holidays::new([date(2026, 12, 25), date(2026, 12, 28)]))
//!     .build()?;
//!
//! // A ticket opened late on Christmas Eve with an 8-hour SLA.
//! let opened: Zoned = "2026-12-24T16:30[Europe/London]".parse()?;
//! let due = schedule.add(&opened, SignedDuration::from_hours(8))?;
//! assert_eq!(due.to_string(), "2026-12-30T09:30:00Z");
//! assert_eq!(schedule.between(&opened, due), SignedDuration::from_hours(8));
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```
//!
//! Every fallible operation returns [`Error`], and no operation panics or
//! loops forever: searches give up after crossing 366 days, plus one day per
//! holiday date, without finding working time.

#![forbid(unsafe_code)]
#![deny(missing_docs)]

mod engine;
mod error;
mod holiday;
mod rule;
mod schedule;
mod weekdays;
mod workday;

pub use error::Error;
pub use holiday::Holidays;
pub use rule::Rule;
pub use schedule::{Schedule, ScheduleBuilder};
pub use weekdays::Weekdays;
pub use workday::{Break, WorkDay};

#[doc = include_str!("../README.md")]
#[cfg(doctest)]
pub struct ReadmeDoctests;
