use std::collections::BTreeSet;

use jiff::civil::{Date, Time};
use jiff::tz::TimeZone;
use jiff::Timestamp;

use crate::engine::{local_dates, shift, Block};

/// Other working hours on some dates.
///
/// On each date in `dates`, the rule makes the time from `start` to `end`
/// available for work, exactly as a [`WorkDay`](crate::WorkDay) does on a
/// matching weekday: if `end <= start`, the block is overnight and ends on the
/// next date.
///
/// A special day replaces the shifts of every `WorkDay` in the schedule that
/// start on one of its dates, compared as calendar dates in each `WorkDay`'s
/// own time zone. A shift that starts the date before and runs into a special
/// date is kept. Breaks and holidays still apply, so a special day on a
/// holiday is not worked. Several special days on the same date add up.
///
/// Dates and times are in the rule's time zone, which defaults to the
/// schedule's.
///
/// # Examples
///
/// ```
/// use jiff::civil::{date, time};
/// use workclock::SpecialDay;
///
/// let christmas_eve =
///     SpecialDay::new(time(8, 0, 0, 0), time(12, 0, 0, 0), [date(2026, 12, 24)]);
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct SpecialDay {
    start: Time,
    end: Time,
    dates: BTreeSet<Date>,
    pub(crate) zone: Option<String>,
}

impl SpecialDay {
    /// Creates a rule for `start` to `end` on `dates`. Duplicate dates are
    /// ignored.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::{date, time};
    /// use jiff::{SignedDuration, Timestamp};
    /// use workclock::{Schedule, SpecialDay, Weekdays, WorkDay};
    ///
    /// let schedule = Schedule::builder()
    ///     .rule(WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI))
    ///     .rule(SpecialDay::new(time(8, 0, 0, 0), time(12, 0, 0, 0), [date(2026, 12, 24)]))
    ///     .build()?;
    /// let morning: Timestamp = "2026-12-24T00:00:00Z".parse()?;
    /// let evening: Timestamp = "2026-12-25T00:00:00Z".parse()?;
    /// assert_eq!(schedule.between(morning, evening), SignedDuration::from_hours(4));
    /// # Ok::<(), Box<dyn std::error::Error>>(())
    /// ```
    #[must_use]
    pub fn new(start: Time, end: Time, dates: impl IntoIterator<Item = Date>) -> Self {
        Self {
            start,
            end,
            dates: dates.into_iter().collect(),
            zone: None,
        }
    }

    /// Sets the IANA time zone the dates and times are in.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::{date, time};
    /// use workclock::SpecialDay;
    ///
    /// let rule = SpecialDay::new(time(8, 0, 0, 0), time(12, 0, 0, 0), [date(2026, 12, 24)])
    ///     .time_zone("Europe/London");
    /// ```
    #[must_use]
    pub fn time_zone(mut self, name: impl Into<String>) -> Self {
        self.zone = Some(name.into());
        self
    }

    pub(crate) fn resolve(self, tz: TimeZone) -> SpecialShifts {
        SpecialShifts {
            start: self.start,
            end: self.end,
            dates: self.dates,
            tz,
        }
    }
}

/// [`SpecialDay`] with the time zone looked up.
#[derive(Clone, Debug)]
pub(crate) struct SpecialShifts {
    start: Time,
    end: Time,
    dates: BTreeSet<Date>,
    tz: TimeZone,
}

impl SpecialShifts {
    pub(crate) fn dates(&self) -> &BTreeSet<Date> {
        &self.dates
    }

    /// Whether no special date falls near `[lo, hi)`.
    pub(crate) fn none_near(&self, lo: Timestamp, hi: Timestamp) -> bool {
        self.dates
            .range(local_dates(lo, hi, &self.tz))
            .next()
            .is_none()
    }

    /// Appends the parts of every special day inside `[lo, hi)`.
    pub(crate) fn blocks(&self, lo: Timestamp, hi: Timestamp, out: &mut Vec<Block>) {
        for &date in self.dates.range(local_dates(lo, hi, &self.tz)) {
            let (start, end) = shift(date, self.start, self.end, &self.tz);
            out.extend(Block::clipped(start, end, lo, hi));
        }
    }
}

#[cfg(test)]
mod tests {
    use jiff::civil::{date, time, Time};
    use jiff::tz::TimeZone;
    use jiff::Timestamp;

    use super::SpecialDay;

    fn blocks(rule: SpecialDay, zone: &str, lo: &str, hi: &str) -> Vec<String> {
        let mut out = Vec::new();
        rule.resolve(TimeZone::get(zone).unwrap()).blocks(
            lo.parse().unwrap(),
            hi.parse().unwrap(),
            &mut out,
        );
        out.into_iter()
            .map(|b| format!("{}/{}", b.start, b.end))
            .collect()
    }

    #[test]
    fn one_block_on_each_date() {
        let rule = SpecialDay::new(
            time(8, 0, 0, 0),
            time(12, 0, 0, 0),
            [date(2026, 1, 10), date(2026, 1, 7)],
        );
        let got = blocks(rule, "UTC", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z");
        assert_eq!(
            got,
            [
                "2026-01-07T08:00:00Z/2026-01-07T12:00:00Z",
                "2026-01-10T08:00:00Z/2026-01-10T12:00:00Z",
            ]
        );
    }

    #[test]
    fn overnight_block_ends_on_the_next_date() {
        let night = |start: Time, end: Time| {
            blocks(
                SpecialDay::new(start, end, [date(2026, 1, 6)]),
                "UTC",
                "2026-01-06T00:00:00Z",
                "2026-01-08T00:00:00Z",
            )
        };
        assert_eq!(
            night(time(22, 0, 0, 0), time(2, 0, 0, 0)),
            ["2026-01-06T22:00:00Z/2026-01-07T02:00:00Z"]
        );
        assert_eq!(
            night(time(9, 0, 0, 0), time(9, 0, 0, 0)),
            ["2026-01-06T09:00:00Z/2026-01-07T09:00:00Z"]
        );
    }

    #[test]
    fn dst_changes_shorten_or_lengthen_the_block() {
        // S16, S17
        let got = blocks(
            SpecialDay::new(
                time(1, 0, 0, 0),
                time(5, 0, 0, 0),
                [date(2026, 3, 8), date(2026, 11, 1)],
            ),
            "America/New_York",
            "2026-01-01T00:00:00Z",
            "2027-01-01T00:00:00Z",
        );
        assert_eq!(
            got,
            [
                "2026-03-08T06:00:00Z/2026-03-08T09:00:00Z",
                "2026-11-01T05:00:00Z/2026-11-01T10:00:00Z",
            ]
        );
    }

    #[test]
    fn a_block_that_resolves_empty_is_dropped() {
        // D8 for a special day: 02:30 and 03:00 both resolve to 03:00 EDT.
        let got = blocks(
            SpecialDay::new(time(2, 30, 0, 0), time(3, 0, 0, 0), [date(2026, 3, 8)]),
            "America/New_York",
            "2026-03-01T00:00:00Z",
            "2026-03-15T00:00:00Z",
        );
        assert_eq!(got, Vec::<String>::new());
    }

    #[test]
    fn only_dates_near_the_window_are_considered() {
        let rule = SpecialDay::new(
            time(22, 0, 0, 0),
            time(6, 0, 0, 0),
            [date(2026, 1, 1), date(2026, 1, 6), date(2026, 12, 25)],
        );
        let got = blocks(rule, "UTC", "2026-01-07T02:00:00Z", "2026-01-08T00:00:00Z");
        assert_eq!(got, ["2026-01-07T02:00:00Z/2026-01-07T06:00:00Z"]);
    }

    #[test]
    fn none_near_finds_dates_whose_blocks_reach_the_window() {
        let rule = SpecialDay::new(time(22, 0, 0, 0), time(6, 0, 0, 0), [date(2026, 1, 6)])
            .resolve(TimeZone::UTC);
        let at = |s: &str| s.parse::<Timestamp>().unwrap();
        assert!(!rule.none_near(at("2026-01-07T02:00:00Z"), at("2026-01-08T00:00:00Z")));
        assert!(rule.none_near(at("2026-06-01T00:00:00Z"), at("2026-06-02T00:00:00Z")));
    }

    #[test]
    fn duplicates_are_ignored() {
        let (start, end) = (time(8, 0, 0, 0), time(12, 0, 0, 0));
        let rule = SpecialDay::new(start, end, [date(2026, 1, 7), date(2026, 1, 7)]);
        assert_eq!(rule, SpecialDay::new(start, end, [date(2026, 1, 7)]));
        assert_eq!(rule.resolve(TimeZone::UTC).dates().len(), 1);
    }

    #[test]
    fn the_last_date_runs_to_the_end_of_the_range() {
        let got = blocks(
            SpecialDay::new(Time::midnight(), Time::midnight(), [date(9999, 12, 31)]),
            "Etc/GMT-14",
            "9999-12-30T00:00:00Z",
            &Timestamp::MAX.to_string(),
        );
        assert_eq!(got, [format!("9999-12-30T10:00:00Z/{}", Timestamp::MAX)]);
    }
}
