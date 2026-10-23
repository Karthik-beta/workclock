//! Checks the engine against every DESIGN.md example in the shared fixture.

mod support {
    pub mod engine;
    pub mod fixture;
    pub mod spec;
}

use jiff::{SignedDuration, Timestamp};

use support::engine::{build, error_name};
use support::fixture::{self, Expect, Op};
use support::spec::ScheduleSpec;

#[derive(Debug, PartialEq)]
enum Outcome {
    Seconds(i64),
    Instant(Timestamp),
    Built,
}

fn run(spec: &ScheduleSpec, op: &Op) -> Result<Outcome, workclock::Error> {
    let schedule = build(spec)?;
    let instant = |s: &str| s.parse::<Timestamp>().expect("fixture instant is RFC 3339");
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
        Op::Build => Outcome::Built,
    })
}

#[test]
fn engine_matches_every_design_example() {
    let fixture = fixture::load();
    let mut failures = Vec::new();
    for case in &fixture.cases {
        let actual = run(&fixture.schedules[&case.schedule], &case.op);
        let expected = match &case.expect {
            Expect::Seconds(s) => Ok(Outcome::Seconds(*s)),
            Expect::Instant(t) => Ok(Outcome::Instant(
                t.parse().expect("fixture instant is RFC 3339"),
            )),
            Expect::Error(e) => Err(e.as_str()),
        };
        if actual.as_ref().map_err(error_name) != expected.as_ref().map_err(|e| *e) {
            failures.push(format!(
                "{}: expected {expected:?}, got {actual:?}",
                case.id
            ));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
