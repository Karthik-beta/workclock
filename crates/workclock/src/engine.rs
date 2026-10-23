//! Interval arithmetic over blocks of working time.

use std::ops::RangeInclusive;

use jiff::civil::{Date, Time};
use jiff::tz::TimeZone;
use jiff::Timestamp;

/// A half-open interval of instants, `[start, end)`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Block {
    pub(crate) start: Timestamp,
    pub(crate) end: Timestamp,
}

impl Block {
    /// The part of `[start, end)` inside `[lo, hi)`, if any.
    pub(crate) fn clipped(
        start: Timestamp,
        end: Timestamp,
        lo: Timestamp,
        hi: Timestamp,
    ) -> Option<Self> {
        let block = Block {
            start: start.max(lo),
            end: end.min(hi),
        };
        (block.start < block.end).then_some(block)
    }
}

/// Converts a wall-clock time to an instant with the compatible strategy:
/// times in a gap move forward by the gap's length, and repeated times take
/// the earlier occurrence.
///
/// Times beyond either end of jiff's range saturate to that end, so a block
/// that runs past the range keeps the part inside it.
pub(crate) fn resolve(date: Date, time: Time, tz: &TimeZone) -> Timestamp {
    let beyond = if date.year() < 0 {
        Timestamp::MIN
    } else {
        Timestamp::MAX
    };
    tz.to_ambiguous_zoned(date.to_datetime(time))
        .compatible()
        .map_or(beyond, |zoned| zoned.timestamp())
}

/// Local dates whose blocks can overlap `[lo, hi)`.
///
/// A block that starts on a date ends before 00:00 two dates later, and DST
/// resolution can move either end by a few hours, so one extra date on each
/// side is enough.
pub(crate) fn local_dates(lo: Timestamp, hi: Timestamp, tz: &TimeZone) -> RangeInclusive<Date> {
    let first = tz.to_datetime(lo).date();
    let first = first.yesterday().and_then(Date::yesterday).unwrap_or(first);
    let last = tz.to_datetime(hi).date();
    let last = last.tomorrow().unwrap_or(last);
    first..=last
}

/// Every date in `dates`, in order.
pub(crate) fn each_date(dates: RangeInclusive<Date>) -> impl Iterator<Item = Date> {
    let last = *dates.end();
    std::iter::successors(Some(*dates.start()), |d| d.tomorrow().ok())
        .take_while(move |d| *d <= last)
}
