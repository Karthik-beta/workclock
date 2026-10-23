//! Business-time arithmetic: how much working time lies between two instants,
//! and which instant is reached after adding or subtracting working time.
//!
//! Working time is defined by composable rules (working days and hours,
//! breaks and holidays) evaluated in an IANA time zone, including overnight
//! shifts.

#![forbid(unsafe_code)]
#![deny(missing_docs)]

mod error;
mod weekdays;

pub use error::Error;
pub use weekdays::Weekdays;
