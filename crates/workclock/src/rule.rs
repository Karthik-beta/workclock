use crate::{Break, Holidays, WorkDay};

/// One rule of a [`Schedule`](crate::Schedule).
///
/// Each rule type converts into `Rule`, so
/// [`ScheduleBuilder::rule`](crate::ScheduleBuilder::rule) accepts any of
/// them directly.
///
/// # Examples
///
/// ```
/// use jiff::civil::{date, time};
/// use workclock::{Holidays, Rule, Schedule, ScheduleBuilder, Weekdays, WorkDay};
///
/// let rules: Vec<Rule> = vec![
///     WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI).into(),
///     Holidays::new([date(2026, 12, 25)]).into(),
/// ];
/// let schedule = rules
///     .into_iter()
///     .fold(Schedule::builder(), ScheduleBuilder::rule)
///     .build()?;
/// # Ok::<(), workclock::Error>(())
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum Rule {
    /// Working hours.
    WorkDay(WorkDay),
    /// Time off on some days of the week.
    Break(Break),
    /// Dates that are not worked.
    Holidays(Holidays),
}

impl From<WorkDay> for Rule {
    fn from(rule: WorkDay) -> Self {
        Rule::WorkDay(rule)
    }
}

impl From<Break> for Rule {
    fn from(rule: Break) -> Self {
        Rule::Break(rule)
    }
}

impl From<Holidays> for Rule {
    fn from(rule: Holidays) -> Self {
        Rule::Holidays(rule)
    }
}
