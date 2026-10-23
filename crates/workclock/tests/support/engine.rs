//! Builds engine schedules from fixture specs.

use workclock::{Break, Error, Holidays, Schedule, WorkDay};

use super::spec::ScheduleSpec;

pub fn build(spec: &ScheduleSpec) -> Result<Schedule, Error> {
    let mut builder = Schedule::builder().time_zone(&spec.zone);
    for r in &spec.workdays {
        let rule = WorkDay::new(
            r.start_time(),
            r.end_time(),
            r.weekdays().into_iter().collect(),
        );
        builder = builder.rule(match &r.zone {
            Some(zone) => rule.time_zone(zone),
            None => rule,
        });
    }
    for r in &spec.breaks {
        let rule = Break::new(
            r.start_time(),
            r.end_time(),
            r.weekdays().into_iter().collect(),
        );
        builder = builder.rule(match &r.zone {
            Some(zone) => rule.time_zone(zone),
            None => rule,
        });
    }
    for h in &spec.holidays {
        let rule = Holidays::new(h.all_dates());
        builder = builder.rule(match &h.zone {
            Some(zone) => rule.time_zone(zone),
            None => rule,
        });
    }
    builder.build()
}

/// The fixture's name for an error.
pub fn error_name(error: &Error) -> &'static str {
    match error {
        Error::NoWorkingTime => "no_working_time",
        Error::OutOfRange => "out_of_range",
        Error::UnknownZone { .. } => "unknown_zone",
        _ => "unexpected",
    }
}
