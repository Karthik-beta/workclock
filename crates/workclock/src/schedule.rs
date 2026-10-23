use jiff::tz::TimeZone;
use jiff::{SignedDuration, Timestamp};

use crate::engine::{subtract, union, Block};
use crate::holiday::HolidayDates;
use crate::workday::Shifts;
use crate::{Break, Error, Rule, WorkDay};

/// Working time defined by rules, evaluated in IANA time zones.
///
/// Working time is the union of every [`WorkDay`] minus every [`Break`] and
/// [`Holidays`](crate::Holidays) date, so the order of rules never matters.
///
/// # Examples
///
/// ```
/// use jiff::civil::{date, time};
/// use workclock::{Break, Holidays, Schedule, Weekdays, WorkDay};
///
/// let schedule = Schedule::builder()
///     .time_zone("America/New_York")
///     .rule(WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI))
///     .rule(Break::new(time(12, 0, 0, 0), time(13, 0, 0, 0), Weekdays::MON_TO_FRI))
///     .rule(Holidays::new([date(2026, 12, 25)]))
///     .build()?;
/// # Ok::<(), workclock::Error>(())
/// ```
#[derive(Clone, Debug)]
pub struct Schedule {
    work: Vec<Shifts>,
    breaks: Vec<Shifts>,
    holidays: Vec<HolidayDates>,
}

impl Schedule {
    /// Returns a builder for a schedule.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::time;
    /// use workclock::{Schedule, Weekdays, WorkDay};
    ///
    /// let schedule = Schedule::builder()
    ///     .rule(WorkDay::new(time(22, 0, 0, 0), time(6, 0, 0, 0), Weekdays::MON_TO_FRI))
    ///     .build()?;
    /// # Ok::<(), workclock::Error>(())
    /// ```
    #[must_use]
    pub fn builder() -> ScheduleBuilder {
        ScheduleBuilder::default()
    }

    /// Working time inside `[lo, hi)`, sorted and merged. Holidays are left
    /// out when `holidays` is false.
    fn working_time(&self, lo: Timestamp, hi: Timestamp, holidays: bool) -> Vec<Block> {
        let mut on = Vec::new();
        for rule in &self.work {
            rule.blocks(lo, hi, &mut on);
        }
        union(&mut on);
        if on.is_empty() {
            return on;
        }
        let mut off = Vec::new();
        for rule in &self.breaks {
            rule.blocks(lo, hi, &mut off);
        }
        if holidays {
            for rule in &self.holidays {
                rule.blocks(lo, hi, &mut off);
            }
        }
        union(&mut off);
        subtract(&on, &off)
    }
}

/// Builder for a [`Schedule`].
///
/// # Examples
///
/// ```
/// use jiff::civil::time;
/// use workclock::{Schedule, Weekdays, WorkDay};
///
/// let builder = Schedule::builder()
///     .time_zone("Asia/Kolkata")
///     .rule(WorkDay::new(time(9, 30, 0, 0), time(18, 0, 0, 0), Weekdays::MON_TO_FRI));
/// let schedule = builder.build()?;
/// # Ok::<(), workclock::Error>(())
/// ```
#[derive(Clone, Debug, Default)]
pub struct ScheduleBuilder {
    zone: Option<String>,
    rules: Vec<Rule>,
}

impl ScheduleBuilder {
    /// Sets the IANA time zone for rules that do not set their own. The
    /// default is `UTC`.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::time;
    /// use workclock::{Schedule, Weekdays, WorkDay};
    ///
    /// let schedule = Schedule::builder()
    ///     .time_zone("Europe/London")
    ///     .rule(WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI))
    ///     .build()?;
    /// # Ok::<(), workclock::Error>(())
    /// ```
    #[must_use]
    pub fn time_zone(mut self, name: impl Into<String>) -> Self {
        self.zone = Some(name.into());
        self
    }

    /// Adds a rule.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::{date, time};
    /// use workclock::{Holidays, Schedule, Weekdays, WorkDay};
    ///
    /// let schedule = Schedule::builder()
    ///     .rule(WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI))
    ///     .rule(Holidays::new([date(2026, 1, 1)]))
    ///     .build()?;
    /// # Ok::<(), workclock::Error>(())
    /// ```
    #[must_use]
    pub fn rule(mut self, rule: impl Into<Rule>) -> Self {
        self.rules.push(rule.into());
        self
    }

    /// Builds the schedule.
    ///
    /// # Errors
    ///
    /// - [`Error::UnknownZone`] if a time zone name is not in the IANA time
    ///   zone database.
    /// - [`Error::NoWorkingTime`] if the working hours minus the breaks are
    ///   empty over the two weeks from Monday 2001-01-01, UTC. Holidays are
    ///   not part of this check because there are finitely many of them.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::time;
    /// use workclock::{Break, Error, Schedule, Weekdays, WorkDay};
    ///
    /// let all_break = Schedule::builder()
    ///     .rule(WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI))
    ///     .rule(Break::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI))
    ///     .build();
    /// assert_eq!(all_break.unwrap_err(), Error::NoWorkingTime);
    /// ```
    pub fn build(self) -> Result<Schedule, Error> {
        let default = match &self.zone {
            Some(name) => lookup(name)?,
            None => TimeZone::UTC,
        };
        let zone = |name: &Option<String>| match name {
            Some(name) => lookup(name),
            None => Ok(default.clone()),
        };
        let mut schedule = Schedule {
            work: Vec::new(),
            breaks: Vec::new(),
            holidays: Vec::new(),
        };
        for rule in self.rules {
            match rule {
                Rule::WorkDay(WorkDay(hours)) => {
                    schedule.work.push(hours.resolve(zone(&hours.zone)?));
                }
                Rule::Break(Break(hours)) => {
                    schedule.breaks.push(hours.resolve(zone(&hours.zone)?));
                }
                Rule::Holidays(holidays) => {
                    let tz = zone(&holidays.zone)?;
                    schedule.holidays.push(holidays.resolve(tz));
                }
            }
        }

        let check_start = Timestamp::constant(978_307_200, 0);
        let check_end = check_start + SignedDuration::from_hours(14 * 24);
        if schedule
            .working_time(check_start, check_end, false)
            .is_empty()
        {
            return Err(Error::NoWorkingTime);
        }
        Ok(schedule)
    }
}

fn lookup(name: &str) -> Result<TimeZone, Error> {
    TimeZone::get(name).map_err(|_| Error::UnknownZone {
        name: name.to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use jiff::civil::{date, time};
    use jiff::Timestamp;

    use super::Schedule;
    use crate::{Break, Error, Holidays, Weekdays, WorkDay};

    fn office() -> WorkDay {
        WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI)
    }

    fn night() -> WorkDay {
        WorkDay::new(time(22, 0, 0, 0), time(6, 0, 0, 0), Weekdays::MON_TO_FRI)
    }

    fn working(schedule: &Schedule, lo: &str, hi: &str) -> Vec<String> {
        let (lo, hi): (Timestamp, Timestamp) = (lo.parse().unwrap(), hi.parse().unwrap());
        schedule
            .working_time(lo, hi, true)
            .into_iter()
            .map(|b| format!("{}/{}", b.start, b.end))
            .collect()
    }

    #[test]
    fn check_window_starts_on_monday_2001_01_01() {
        let start = Timestamp::constant(978_307_200, 0);
        assert_eq!(start.to_string(), "2001-01-01T00:00:00Z");
    }

    #[test]
    fn schedule_is_send_and_sync() {
        fn check<T: Send + Sync>() {}
        check::<Schedule>();
    }

    #[test]
    fn needs_working_time_outside_breaks() {
        // E1, E2, E3
        let no_days = WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::EMPTY);
        let all_day_break = Break::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI);
        for builder in [
            Schedule::builder(),
            Schedule::builder().rule(no_days),
            Schedule::builder().rule(office()).rule(all_day_break),
        ] {
            assert_eq!(builder.build().unwrap_err(), Error::NoWorkingTime);
        }
    }

    #[test]
    fn holidays_do_not_count_against_the_build_check() {
        let every_date_in_2001 = Holidays::new(
            std::iter::successors(Some(date(2001, 1, 1)), |d| d.tomorrow().ok())
                .take_while(|d| d.year() == 2001),
        );
        assert!(Schedule::builder()
            .rule(office())
            .rule(every_date_in_2001)
            .build()
            .is_ok());
    }

    #[test]
    fn unknown_zones_are_reported_by_name() {
        // E6
        let in_schedule = Schedule::builder()
            .time_zone("Mars/Olympus_Mons")
            .rule(office())
            .build();
        let in_rule = Schedule::builder()
            .rule(office().time_zone("Mars/Olympus_Mons"))
            .build();
        let in_holidays = Schedule::builder()
            .rule(office())
            .rule(Holidays::new([]).time_zone("Mars/Olympus_Mons"))
            .build();
        for result in [in_schedule, in_rule, in_holidays] {
            assert_eq!(
                result.unwrap_err(),
                Error::UnknownZone {
                    name: "Mars/Olympus_Mons".into()
                }
            );
        }
    }

    #[test]
    fn overlapping_rules_count_once() {
        // U1
        let late = WorkDay::new(time(13, 0, 0, 0), time(20, 0, 0, 0), Weekdays::MON_TO_FRI);
        let schedule = Schedule::builder()
            .rule(office())
            .rule(late)
            .build()
            .unwrap();
        assert_eq!(
            working(&schedule, "2026-01-05T00:00:00Z", "2026-01-06T00:00:00Z"),
            ["2026-01-05T09:00:00Z/2026-01-05T20:00:00Z"]
        );
    }

    #[test]
    fn holiday_removes_calendar_time_from_overnight_shifts() {
        // HO1, HO2
        let schedule = Schedule::builder()
            .rule(night())
            .rule(Holidays::new([date(2026, 1, 6)]))
            .build()
            .unwrap();
        assert_eq!(
            working(&schedule, "2026-01-05T00:00:00Z", "2026-01-07T12:00:00Z"),
            [
                "2026-01-05T22:00:00Z/2026-01-06T00:00:00Z",
                "2026-01-07T00:00:00Z/2026-01-07T06:00:00Z",
            ]
        );
    }

    #[test]
    fn rules_default_to_the_schedule_zone() {
        // Z3 and Z4: a Los Angeles office with a holiday in its own zone or in UTC.
        let holiday = || Holidays::new([date(2026, 1, 26)]);
        let local = Schedule::builder()
            .time_zone("America/Los_Angeles")
            .rule(office())
            .rule(holiday())
            .build()
            .unwrap();
        let utc = Schedule::builder()
            .time_zone("America/Los_Angeles")
            .rule(office())
            .rule(holiday().time_zone("UTC"))
            .build()
            .unwrap();
        let monday = ("2026-01-26T17:00:00Z", "2026-01-27T01:00:00Z");
        assert_eq!(working(&local, monday.0, monday.1), Vec::<String>::new());
        assert_eq!(
            working(&utc, monday.0, monday.1),
            ["2026-01-27T00:00:00Z/2026-01-27T01:00:00Z"]
        );
    }
}
