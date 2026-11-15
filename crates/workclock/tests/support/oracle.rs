//! Brute-force reference implementation of DESIGN.md.
//!
//! It decides for every minute separately whether that minute is working time,
//! and never builds or merges intervals. That makes it slow but easy to check
//! against the spec by reading. Every instant, duration and rule time it is
//! given must be a whole number of minutes.

use std::collections::BTreeSet;
use std::ops::Range;

use jiff::civil::{Date, Time, Weekday};
use jiff::tz::TimeZone;
use jiff::{SignedDuration, Timestamp};

use super::spec::{HolidaySpec, RuleSpec, ScheduleSpec, SpecialDaySpec};

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
    special_days: Vec<SpecialDay>,
    /// The dates of every special day, on which no workday shift starts.
    special_dates: BTreeSet<Date>,
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
                start: r.start_time(),
                end: r.end_time(),
                days: r.weekdays(),
                tz: zone(r.zone.as_ref())?,
            })
        };
        let holidays = |h: &HolidaySpec| {
            Ok(Holidays {
                dates: h.all_dates(),
                tz: zone(h.zone.as_ref())?,
            })
        };
        let special_day = |s: &SpecialDaySpec| {
            Ok(SpecialDay {
                start: s.start_time(),
                end: s.end_time(),
                dates: s.all_dates(),
                tz: zone(s.zone.as_ref())?,
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
        let special_days: Vec<SpecialDay> = spec
            .specialdays
            .iter()
            .map(special_day)
            .collect::<Result<_, _>>()?;
        let special_dates: BTreeSet<Date> = special_days
            .iter()
            .flat_map(|s| s.dates.iter().copied())
            .collect();
        let dates = holidays.iter().map(|h| h.dates.len()).sum::<usize>() + special_dates.len();
        let dates = i64::try_from(dates).expect("date count fits in i64");

        // Special days join after the check: like holidays, they take no part
        // in it.
        let mut oracle = Oracle {
            workdays,
            breaks,
            special_days: Vec::new(),
            special_dates: BTreeSet::new(),
            holidays,
            search_limit: SignedDuration::from_hours(24 * (366 + 7 * dates)),
        };

        let window_start: Timestamp = "2001-01-01T00:00:00Z".parse().unwrap();
        let window_end = window_start + SignedDuration::from_hours(14 * 24);
        let mut m = window_start;
        while m < window_end {
            if oracle.available(m) && !oracle.on_break(m) {
                oracle.special_days = special_days;
                oracle.special_dates = special_dates;
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

    #[allow(dead_code, reason = "only the fixture test searches for periods")]
    pub fn next_period(&self, t: Timestamp) -> Result<Range<Timestamp>, OracleError> {
        let mut start = t;
        while !self.is_working(start) {
            start = start
                .checked_add(MINUTE)
                .map_err(|_| OracleError::OutOfRange)?;
            if start.duration_since(t) > self.search_limit {
                return Err(OracleError::NoWorkingTime);
            }
        }
        let mut end = start;
        while end.duration_since(start) < self.search_limit && self.is_working(end) {
            let Ok(next) = end.checked_add(MINUTE) else {
                break;
            };
            end = next;
        }
        Ok(start..end)
    }

    #[allow(dead_code, reason = "only the fixture test searches for periods")]
    pub fn previous_period(&self, t: Timestamp) -> Result<Range<Timestamp>, OracleError> {
        let mut end = t;
        loop {
            let prev = end
                .checked_sub(MINUTE)
                .map_err(|_| OracleError::OutOfRange)?;
            if self.is_working(prev) {
                break;
            }
            end = prev;
            if t.duration_since(end) > self.search_limit {
                return Err(OracleError::NoWorkingTime);
            }
        }
        let mut start = end;
        while end.duration_since(start) < self.search_limit {
            match start.checked_sub(MINUTE) {
                Ok(prev) if self.is_working(prev) => start = prev,
                _ => break,
            }
        }
        Ok(start..end)
    }

    /// Workday shifts that do not start on a special date, and special days.
    fn available(&self, t: Timestamp) -> bool {
        self.workdays
            .iter()
            .any(|r| r.contains(t, &self.special_dates))
            || self.special_days.iter().any(|s| s.contains(t))
    }

    fn on_break(&self, t: Timestamp) -> bool {
        self.breaks.iter().any(|r| r.contains(t, &BTreeSet::new()))
    }
}

struct Rule {
    start: Time,
    end: Time,
    days: Vec<Weekday>,
    tz: TimeZone,
}

impl Rule {
    /// Whether `t` falls in a shift that does not start on one of `except`.
    fn contains(&self, t: Timestamp, except: &BTreeSet<Date>) -> bool {
        in_shift(t, self.start, self.end, &self.tz, |d| {
            self.days.contains(&d.weekday()) && !except.contains(&d)
        })
    }
}

struct SpecialDay {
    start: Time,
    end: Time,
    dates: BTreeSet<Date>,
    tz: TimeZone,
}

impl SpecialDay {
    fn contains(&self, t: Timestamp) -> bool {
        in_shift(t, self.start, self.end, &self.tz, |d| {
            self.dates.contains(&d)
        })
    }
}

/// Whether `t` falls in the shift from `start` to `end` on a local date for
/// which `on` holds. A shift belongs to the date it starts on and nominally
/// ends on the next date. A zone gap of up to 24 hours (Pacific/Apia skipped
/// 2011-12-30) can move that end one date later, so `t` can fall in the shift
/// of its own local date or of either of the two days before.
fn in_shift(
    t: Timestamp,
    start: Time,
    end: Time,
    tz: &TimeZone,
    on: impl Fn(Date) -> bool,
) -> bool {
    let today = t.to_zoned(tz.clone()).date();
    let yesterday = today.yesterday().ok();
    let before = yesterday.and_then(|d| d.yesterday().ok());
    [before, yesterday, Some(today)]
        .into_iter()
        .flatten()
        .filter(|&d| on(d))
        .any(|d| {
            let until = match (end <= start, d.tomorrow()) {
                (false, _) => resolve(d, end, tz),
                (true, Ok(next)) => resolve(next, end, tz),
                (true, Err(_)) => Timestamp::MAX,
            };
            resolve(d, start, tz) <= t && t < until
        })
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
                let end = d.tomorrow().map_or(Timestamp::MAX, |next| {
                    resolve(next, Time::midnight(), &self.tz)
                });
                resolve(d, Time::midnight(), &self.tz) <= t && t < end
            })
    }
}

/// Wall-clock time to instant with the "compatible" policy from DESIGN.md.
/// Times past either end of jiff's range saturate to that end.
fn resolve(date: Date, time: Time, tz: &TimeZone) -> Timestamp {
    let beyond = if date.year() < 0 {
        Timestamp::MIN
    } else {
        Timestamp::MAX
    };
    tz.to_ambiguous_zoned(date.to_datetime(time))
        .compatible()
        .map_or(beyond, |z| z.timestamp())
}
