//! Checks the engine against every DESIGN.md example in the shared fixture.

mod support {
    pub mod engine;
    pub mod fixture;
    pub mod spec;
}

use jiff::SignedDuration;

use support::engine::{build, error_name};
use support::fixture::{self, instant, Op, Outcome};
use support::spec::ScheduleSpec;

fn run(spec: &ScheduleSpec, op: &Op) -> Result<Outcome, workclock::Error> {
    let schedule = build(spec)?;
    Ok(match op {
        Op::Between { a, b } => {
            Outcome::Seconds(schedule.between(instant(a), instant(b)).as_secs())
        }
        Op::Add { t, seconds } => {
            Outcome::Instant(schedule.add(instant(t), SignedDuration::from_secs(*seconds))?)
        }
        Op::Sub { t, seconds } => {
            Outcome::Instant(schedule.sub(instant(t), SignedDuration::from_secs(*seconds))?)
        }
        Op::NextPeriod { t } => Outcome::Period(schedule.next_period(instant(t))?),
        Op::PreviousPeriod { t } => Outcome::Period(schedule.previous_period(instant(t))?),
        Op::Build => Outcome::Built,
    })
}

#[test]
fn engine_matches_every_design_example() {
    let fixture = fixture::load();
    let mut failures = Vec::new();
    for case in &fixture.cases {
        let actual = run(&fixture.schedules[&case.schedule], &case.op).map_err(|e| error_name(&e));
        let expected = case.expected();
        if actual != expected {
            failures.push(format!(
                "{}: expected {expected:?}, got {actual:?}",
                case.id
            ));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
