//! Brute-force reference implementation of DESIGN.md.
//!
//! It decides for every minute separately whether that minute is working time,
//! and never builds or merges intervals. That makes it slow but easy to check
//! against the spec by reading. Every instant, duration and rule time it is
//! given must be a whole number of minutes.

use std::collections::BTreeSet;

use jiff::civil::{Date, Time, Weekday};
use jiff::tz::TimeZone;
use jiff::{SignedDuration, Timestamp};

use super::spec::{HolidaySpec, RuleSpec, ScheduleSpec};

const MINUTE: SignedDuration = SignedDuration::from_mins(1);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OracleError {
    NoWorkingTime,
    OutOfRange,
    UnknownZone,
}

pub struct Oracle {
    workdays: Vec<Rule>,
    breaks: Vec<Rule>,
    holidays: Vec<Holidays>,
    search_limit: SignedDuration,
}

impl Oracle {
    pub fn build(spec: &ScheduleSpec) -> Result<Self, OracleError> {
        let zone = |name: Option<&String>| {
            TimeZone::get(name.unwrap_or(&spec.zone)).map_err(|_| OracleError::UnknownZone)
        };
        let rule = |r: &RuleSpec| {
            Ok(Rule {
                start: r.start.parse().expect("rule start is HH:MM"),
                end: r.end.parse().expect("rule end is HH:MM"),
                days: r.days.iter().map(|d| weekday(d)).collect(),
                tz: zone(r.zone.as_ref())?,
            })
        };
        let holidays = |h: &HolidaySpec| {
            Ok(Holidays {
                dates: expand_dates(h),
                tz: zone(h.zone.as_ref())?,
            })
        };

        zone(None)?;
        let workdays = spec.workdays.iter().map(rule).collect::<Result<_, _>>()?;
        let breaks = spec.breaks.iter().map(rule).collect::<Result<_, _>>()?;
        let holidays: Vec<Holidays> = spec
            .holidays
            .iter()
            .map(holidays)
            .collect::<Result<_, _>>()?;
        let holiday_dates = i64::try_from(holidays.iter().map(|h| h.dates.len()).sum::<usize>())
            .expect("holiday count fits in i64");

        let oracle = Oracle {
            workdays,
            breaks,
            holidays,
            search_limit: SignedDuration::from_hours(24 * (366 + holiday_dates)),
        };

        let window_start: Timestamp = "2001-01-01T00:00:00Z".parse().unwrap();
        let window_end = window_start + SignedDuration::from_hours(14 * 24);
        let mut m = window_start;
        while m < window_end {
            if oracle.available(m) && !oracle.on_break(m) {
                return Ok(oracle);
            }
            m += MINUTE;
        }
        Err(OracleError::NoWorkingTime)
    }

    /// Whether the minute starting at `t` is working time.
    pub fn is_working(&self, t: Timestamp) -> bool {
        self.available(t) && !self.on_break(t) && !self.holidays.iter().any(|h| h.contains(t))
    }

    pub fn between(&self, a: Timestamp, b: Timestamp) -> SignedDuration {
        if b < a {
            return -self.between(b, a);
        }
        let mut total = SignedDuration::ZERO;
        let mut m = a;
        while m < b {
            if self.is_working(m) {
                total += MINUTE;
            }
            m += MINUTE;
        }
        total
    }

    pub fn add(&self, t: Timestamp, d: SignedDuration) -> Result<Timestamp, OracleError> {
        if d.is_negative() {
            return self.sub(t, -d);
        }
        let mut left = d;
        let mut idle = SignedDuration::ZERO;
        let mut x = t;
        while left.is_positive() {
            let next = x.checked_add(MINUTE).map_err(|_| OracleError::OutOfRange)?;
            if self.is_working(x) {
                left -= MINUTE;
                idle = SignedDuration::ZERO;
            } else {
                idle += MINUTE;
                if idle > self.search_limit {
                    return Err(OracleError::NoWorkingTime);
                }
            }
            x = next;
        }
        Ok(x)
    }

    pub fn sub(&self, t: Timestamp, d: SignedDuration) -> Result<Timestamp, OracleError> {
        if d.is_negative() {
            return self.add(t, -d);
        }
        let mut left = d;
        let mut idle = SignedDuration::ZERO;
        let mut x = t;
        while left.is_positive() {
            let prev = x.checked_sub(MINUTE).map_err(|_| OracleError::OutOfRange)?;
            if self.is_working(prev) {
                left -= MINUTE;
                idle = SignedDuration::ZERO;
            } else {
                idle += MINUTE;
                if idle > self.search_limit {
                    return Err(OracleError::NoWorkingTime);
                }
            }
            x = prev;
        }
        Ok(x)
    }

    fn available(&self, t: Timestamp) -> bool {
        self.workdays.iter().any(|r| r.contains(t))
    }

    fn on_break(&self, t: Timestamp) -> bool {
        self.breaks.iter().any(|r| r.contains(t))
    }
}

struct Rule {
    start: Time,
    end: Time,
    days: Vec<Weekday>,
    tz: TimeZone,
}

impl Rule {
    /// A shift belongs to the date it starts on, so `t` can only fall in the
    /// shift of its own local date or of the day before.
    fn contains(&self, t: Timestamp) -> bool {
        let today = t.to_zoned(self.tz.clone()).date();
        [today.yesterday().ok(), Some(today)]
            .into_iter()
            .flatten()
            .filter(|d| self.days.contains(&d.weekday()))
            .any(|d| {
                let end_date = if self.end <= self.start {
                    d.tomorrow().ok()
                } else {
                    Some(d)
                };
                let start = resolve(d, self.start, &self.tz);
                let end = end_date.and_then(|e| resolve(e, self.end, &self.tz));
                matches!((start, end), (Some(s), Some(e)) if s <= t && t < e)
            })
    }
}

struct Holidays {
    dates: BTreeSet<Date>,
    tz: TimeZone,
}

impl Holidays {
    /// A holiday is `[00:00 on its date, 00:00 on the next date)`. Around DST
    /// transitions that block can reach into a neighbouring local date, so the
    /// dates either side are checked too.
    fn contains(&self, t: Timestamp) -> bool {
        let today = t.to_zoned(self.tz.clone()).date();
        [today.yesterday().ok(), Some(today), today.tomorrow().ok()]
            .into_iter()
            .flatten()
            .filter(|d| self.dates.contains(d))
            .any(|d| {
                let start = resolve(d, Time::midnight(), &self.tz);
                let end = d
                    .tomorrow()
                    .ok()
                    .and_then(|e| resolve(e, Time::midnight(), &self.tz));
                matches!((start, end), (Some(s), Some(e)) if s <= t && t < e)
            })
    }
}

/// Wall-clock time to instant with the "compatible" policy from DESIGN.md.
fn resolve(date: Date, time: Time, tz: &TimeZone) -> Option<Timestamp> {
    tz.to_ambiguous_zoned(date.to_datetime(time))
        .compatible()
        .ok()
        .map(|z| z.timestamp())
}

fn weekday(name: &str) -> Weekday {
    match name {
        "mon" => Weekday::Monday,
        "tue" => Weekday::Tuesday,
        "wed" => Weekday::Wednesday,
        "thu" => Weekday::Thursday,
        "fri" => Weekday::Friday,
        "sat" => Weekday::Saturday,
        "sun" => Weekday::Sunday,
        other => panic!("unknown weekday {other:?}"),
    }
}

fn expand_dates(h: &HolidaySpec) -> BTreeSet<Date> {
    let mut dates: BTreeSet<Date> = h
        .dates
        .iter()
        .map(|d| d.parse().expect("date is YYYY-MM-DD"))
        .collect();
    for [from, to] in &h.ranges {
        let to: Date = to.parse().expect("date is YYYY-MM-DD");
        let mut d: Date = from.parse().expect("date is YYYY-MM-DD");
        while d <= to {
            dates.insert(d);
            d = d.tomorrow().expect("holiday range within jiff's range");
        }
    }
    dates
}
