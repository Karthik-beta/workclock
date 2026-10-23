use jiff::civil::Time;
use jiff::tz::TimeZone;
use jiff::Timestamp;

use crate::engine::{each_date, local_dates, resolve, Block};
use crate::Weekdays;

/// Daily hours on some days of the week, in a time zone.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub(crate) struct Hours {
    pub(crate) start: Time,
    pub(crate) end: Time,
    pub(crate) days: Weekdays,
    pub(crate) zone: Option<String>,
}

impl Hours {
    pub(crate) fn resolve(&self, tz: TimeZone) -> Shifts {
        Shifts {
            start: self.start,
            end: self.end,
            days: self.days,
            tz,
        }
    }
}

/// Working hours on some days of the week.
///
/// On each local date whose weekday is in `days`, the rule makes the time
/// from `start` to `end` available for work. If `end <= start`, the shift is
/// overnight and ends on the next date, so `start == end` is a 24-hour shift.
/// A shift belongs to the day it starts on.
///
/// Times are wall-clock times in the rule's time zone, which defaults to the
/// schedule's.
///
/// # Examples
///
/// ```
/// use jiff::civil::time;
/// use workclock::{Weekdays, WorkDay};
///
/// let office = WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI);
/// let night = WorkDay::new(time(22, 0, 0, 0), time(6, 0, 0, 0), Weekdays::MON_TO_FRI)
///     .time_zone("Asia/Kolkata");
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct WorkDay(pub(crate) Hours);

impl WorkDay {
    /// Creates a rule for `start` to `end` on `days`.
    #[must_use]
    pub fn new(start: Time, end: Time, days: Weekdays) -> Self {
        Self(Hours {
            start,
            end,
            days,
            zone: None,
        })
    }

    /// Sets the IANA time zone the rule's times are in.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::time;
    /// use workclock::{Weekdays, WorkDay};
    ///
    /// let rule = WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI)
    ///     .time_zone("Europe/London");
    /// ```
    #[must_use]
    pub fn time_zone(mut self, name: impl Into<String>) -> Self {
        self.0.zone = Some(name.into());
        self
    }
}

/// Time off on some days of the week, such as a lunch break.
///
/// A break has the same shape as a [`WorkDay`], including overnight breaks,
/// and removes its time from the working time. A break outside working time
/// has no effect.
///
/// # Examples
///
/// ```
/// use jiff::civil::time;
/// use workclock::{Break, Weekdays};
///
/// let lunch = Break::new(time(12, 0, 0, 0), time(13, 0, 0, 0), Weekdays::MON_TO_FRI);
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Break(pub(crate) Hours);

impl Break {
    /// Creates a break from `start` to `end` on `days`.
    #[must_use]
    pub fn new(start: Time, end: Time, days: Weekdays) -> Self {
        Self(Hours {
            start,
            end,
            days,
            zone: None,
        })
    }

    /// Sets the IANA time zone the break's times are in.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::time;
    /// use workclock::{Break, Weekdays};
    ///
    /// let lunch = Break::new(time(12, 0, 0, 0), time(13, 0, 0, 0), Weekdays::MON_TO_FRI)
    ///     .time_zone("America/New_York");
    /// ```
    #[must_use]
    pub fn time_zone(mut self, name: impl Into<String>) -> Self {
        self.0.zone = Some(name.into());
        self
    }
}

/// [`Hours`] with the time zone looked up.
#[derive(Clone, Debug)]
pub(crate) struct Shifts {
    start: Time,
    end: Time,
    days: Weekdays,
    tz: TimeZone,
}

impl Shifts {
    /// Whether the time zone keeps one offset from `lo` to `hi`.
    pub(crate) fn steady(&self, lo: Timestamp, hi: Timestamp) -> bool {
        self.tz
            .following(lo)
            .next()
            .is_none_or(|transition| transition.timestamp() > hi)
    }

    /// Appends the parts of every shift inside `[lo, hi)`.
    pub(crate) fn blocks(&self, lo: Timestamp, hi: Timestamp, out: &mut Vec<Block>) {
        let overnight = self.end <= self.start;
        for date in each_date(local_dates(lo, hi, &self.tz)) {
            if !self.days.contains(date.weekday()) {
                continue;
            }
            let start = resolve(date, self.start, &self.tz);
            let end = match (overnight, date.tomorrow()) {
                (false, _) => resolve(date, self.end, &self.tz),
                (true, Ok(next)) => resolve(next, self.end, &self.tz),
                (true, Err(_)) => Timestamp::MAX,
            };
            out.extend(Block::clipped(start, end, lo, hi));
        }
    }
}

#[cfg(test)]
mod tests {
    use jiff::civil::{time, Time};
    use jiff::tz::TimeZone;
    use jiff::Timestamp;

    use super::Hours;
    use crate::engine::Block;
    use crate::Weekdays;

    fn ts(s: &str) -> Timestamp {
        s.parse().unwrap()
    }

    fn blocks(
        start: Time,
        end: Time,
        days: Weekdays,
        zone: &str,
        lo: &str,
        hi: &str,
    ) -> Vec<(String, String)> {
        let hours = Hours {
            start,
            end,
            days,
            zone: None,
        };
        let mut out = Vec::new();
        hours
            .resolve(TimeZone::get(zone).unwrap())
            .blocks(ts(lo), ts(hi), &mut out);
        out.into_iter()
            .map(|Block { start, end }| (start.to_string(), end.to_string()))
            .collect()
    }

    fn pairs(expected: &[(&str, &str)]) -> Vec<(String, String)> {
        expected
            .iter()
            .map(|(s, e)| ((*s).to_owned(), (*e).to_owned()))
            .collect()
    }

    #[test]
    fn day_shifts_on_working_days_only() {
        let got = blocks(
            time(9, 0, 0, 0),
            time(17, 0, 0, 0),
            Weekdays::MON_TO_FRI,
            "UTC",
            "2026-01-09T00:00:00Z",
            "2026-01-13T00:00:00Z",
        );
        assert_eq!(
            got,
            pairs(&[
                ("2026-01-09T09:00:00Z", "2026-01-09T17:00:00Z"),
                ("2026-01-12T09:00:00Z", "2026-01-12T17:00:00Z"),
            ])
        );
    }

    #[test]
    fn overnight_shift_belongs_to_its_start_day() {
        // Friday's shift runs into Saturday; nothing ends on Monday morning.
        let got = blocks(
            time(22, 0, 0, 0),
            time(6, 0, 0, 0),
            Weekdays::MON_TO_FRI,
            "UTC",
            "2026-01-09T00:00:00Z",
            "2026-01-12T12:00:00Z",
        );
        assert_eq!(
            got,
            pairs(&[
                ("2026-01-09T00:00:00Z", "2026-01-09T06:00:00Z"),
                ("2026-01-09T22:00:00Z", "2026-01-10T06:00:00Z"),
            ])
        );
    }

    #[test]
    fn shift_in_progress_is_clipped_to_the_window() {
        let got = blocks(
            time(22, 0, 0, 0),
            time(6, 0, 0, 0),
            Weekdays::MON_TO_FRI,
            "UTC",
            "2026-01-06T02:00:00Z",
            "2026-01-06T04:00:00Z",
        );
        assert_eq!(
            got,
            pairs(&[("2026-01-06T02:00:00Z", "2026-01-06T04:00:00Z")])
        );
    }

    #[test]
    fn equal_start_and_end_is_a_24_hour_shift() {
        let got = blocks(
            time(9, 0, 0, 0),
            time(9, 0, 0, 0),
            Weekdays::MON_TO_FRI,
            "UTC",
            "2026-01-05T00:00:00Z",
            "2026-01-07T00:00:00Z",
        );
        assert_eq!(
            got,
            pairs(&[
                ("2026-01-05T09:00:00Z", "2026-01-06T09:00:00Z"),
                ("2026-01-06T09:00:00Z", "2026-01-07T00:00:00Z"),
            ])
        );
    }

    #[test]
    fn gap_moves_times_forward() {
        // D4, D8, D9: New York skips 02:00-03:00 on 2026-03-08.
        let sunday = Weekdays::ALL;
        let window = ("2026-03-08T00:00:00Z", "2026-03-09T00:00:00Z");
        let d4 = blocks(
            time(2, 30, 0, 0),
            time(4, 0, 0, 0),
            sunday,
            "America/New_York",
            window.0,
            window.1,
        );
        let d8 = blocks(
            time(2, 30, 0, 0),
            time(3, 0, 0, 0),
            sunday,
            "America/New_York",
            window.0,
            window.1,
        );
        let d9 = blocks(
            time(2, 0, 0, 0),
            time(2, 30, 0, 0),
            sunday,
            "America/New_York",
            window.0,
            window.1,
        );
        assert_eq!(
            d4,
            pairs(&[("2026-03-08T07:30:00Z", "2026-03-08T08:00:00Z")])
        );
        assert_eq!(d8, pairs(&[]));
        assert_eq!(
            d9,
            pairs(&[("2026-03-08T07:00:00Z", "2026-03-08T07:30:00Z")])
        );
    }

    #[test]
    fn overlap_takes_the_earlier_occurrence() {
        // D5: New York repeats 01:00-02:00 on 2026-11-01.
        let got = blocks(
            time(1, 30, 0, 0),
            time(3, 0, 0, 0),
            Weekdays::ALL,
            "America/New_York",
            "2026-11-01T00:00:00Z",
            "2026-11-02T00:00:00Z",
        );
        assert_eq!(
            got,
            pairs(&[("2026-11-01T05:30:00Z", "2026-11-01T08:00:00Z")])
        );
    }

    #[test]
    fn shifts_past_the_edges_of_jiff_range_are_clipped_to_it() {
        let all_day = (Time::midnight(), Time::midnight(), Weekdays::ALL);
        let first = blocks(
            all_day.0,
            all_day.1,
            all_day.2,
            "UTC",
            "-009999-01-02T01:59:59Z",
            "-009999-01-04T00:00:00Z",
        );
        let last = blocks(
            all_day.0,
            all_day.1,
            all_day.2,
            "UTC",
            "9999-12-29T00:00:00Z",
            "9999-12-30T22:00:00Z",
        );
        assert_eq!(
            first,
            pairs(&[
                ("-009999-01-02T01:59:59Z", "-009999-01-03T00:00:00Z"),
                ("-009999-01-03T00:00:00Z", "-009999-01-04T00:00:00Z"),
            ])
        );
        assert_eq!(
            last,
            pairs(&[
                ("9999-12-29T00:00:00Z", "9999-12-30T00:00:00Z"),
                ("9999-12-30T00:00:00Z", "9999-12-30T22:00:00Z"),
            ])
        );
    }
}
