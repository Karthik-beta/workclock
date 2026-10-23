use std::collections::BTreeSet;

use jiff::civil::{Date, Time};
use jiff::tz::TimeZone;
use jiff::Timestamp;

use crate::engine::{local_dates, resolve, Block};

/// Dates that are not worked.
///
/// Each date removes the time from 00:00 on that date to 00:00 on the next
/// date in the rule's time zone, which defaults to the schedule's. On a DST
/// transition day that is 23 or 25 hours. A holiday removes calendar time,
/// not whole shifts: an overnight shift that crosses into a holiday loses only
/// the part after midnight.
///
/// # Examples
///
/// ```
/// use jiff::civil::date;
/// use workclock::Holidays;
///
/// let holidays = Holidays::new([date(2026, 1, 1), date(2026, 12, 25)]);
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Holidays {
    dates: BTreeSet<Date>,
    pub(crate) zone: Option<String>,
}

impl Holidays {
    /// Creates a rule from a list of dates. Duplicates are ignored.
    #[must_use]
    pub fn new(dates: impl IntoIterator<Item = Date>) -> Self {
        Self {
            dates: dates.into_iter().collect(),
            zone: None,
        }
    }

    /// Sets the IANA time zone the dates are in.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::date;
    /// use workclock::Holidays;
    ///
    /// let holidays = Holidays::new([date(2026, 1, 26)]).time_zone("Asia/Kolkata");
    /// ```
    #[must_use]
    pub fn time_zone(mut self, name: impl Into<String>) -> Self {
        self.zone = Some(name.into());
        self
    }
}

impl Holidays {
    pub(crate) fn resolve(self, tz: TimeZone) -> HolidayDates {
        HolidayDates {
            dates: self.dates,
            tz,
        }
    }
}

/// [`Holidays`] with the time zone looked up.
#[derive(Clone, Debug)]
pub(crate) struct HolidayDates {
    dates: BTreeSet<Date>,
    tz: TimeZone,
}

impl HolidayDates {
    pub(crate) fn len(&self) -> usize {
        self.dates.len()
    }

    /// Appends the parts of every holiday inside `[lo, hi)`.
    pub(crate) fn blocks(&self, lo: Timestamp, hi: Timestamp, out: &mut Vec<Block>) {
        for &date in self.dates.range(local_dates(lo, hi, &self.tz)) {
            let start = resolve(date, Time::midnight(), &self.tz);
            let end = date.tomorrow().map_or(Timestamp::MAX, |next| {
                resolve(next, Time::midnight(), &self.tz)
            });
            out.extend(Block::clipped(start, end, lo, hi));
        }
    }
}

#[cfg(test)]
mod tests {
    use jiff::civil::date;
    use jiff::tz::TimeZone;
    use jiff::Timestamp;

    use super::Holidays;

    fn blocks(holidays: Holidays, zone: &str, lo: &str, hi: &str) -> Vec<String> {
        let mut out = Vec::new();
        holidays.resolve(TimeZone::get(zone).unwrap()).blocks(
            lo.parse().unwrap(),
            hi.parse().unwrap(),
            &mut out,
        );
        out.into_iter()
            .map(|b| format!("{}/{}", b.start, b.end))
            .collect()
    }

    #[test]
    fn a_holiday_is_a_whole_local_day() {
        let got = blocks(
            Holidays::new([date(2026, 1, 26)]),
            "Asia/Kolkata",
            "2026-01-01T00:00:00Z",
            "2026-02-01T00:00:00Z",
        );
        assert_eq!(got, ["2026-01-25T18:30:00Z/2026-01-26T18:30:00Z"]);
    }

    #[test]
    fn dst_days_are_23_or_25_hours() {
        let got = blocks(
            Holidays::new([date(2026, 3, 8), date(2026, 11, 1)]),
            "America/New_York",
            "2026-01-01T00:00:00Z",
            "2027-01-01T00:00:00Z",
        );
        assert_eq!(
            got,
            [
                "2026-03-08T05:00:00Z/2026-03-09T04:00:00Z",
                "2026-11-01T04:00:00Z/2026-11-02T05:00:00Z",
            ]
        );
    }

    #[test]
    fn only_dates_near_the_window_are_considered() {
        let got = blocks(
            Holidays::new([date(2026, 1, 1), date(2026, 1, 7), date(2026, 12, 25)]),
            "UTC",
            "2026-01-07T12:00:00Z",
            "2026-01-08T12:00:00Z",
        );
        assert_eq!(got, ["2026-01-07T12:00:00Z/2026-01-08T00:00:00Z"]);
    }

    #[test]
    fn duplicates_are_ignored() {
        let holidays = Holidays::new([date(2026, 1, 1), date(2026, 1, 1)]);
        assert_eq!(holidays, Holidays::new([date(2026, 1, 1)]));
        assert_eq!(holidays.resolve(TimeZone::UTC).len(), 1);
    }

    #[test]
    fn the_last_date_runs_to_the_end_of_the_range() {
        let got = blocks(
            Holidays::new([date(9999, 12, 31)]),
            "Etc/GMT-14",
            "9999-12-30T00:00:00Z",
            &Timestamp::MAX.to_string(),
        );
        assert_eq!(got, [format!("9999-12-30T10:00:00Z/{}", Timestamp::MAX)]);
    }
}
