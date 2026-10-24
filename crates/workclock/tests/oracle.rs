//! Checks the oracle against every DESIGN.md example, so that it can serve as
//! the reference for property tests.

mod support {
    pub mod fixture;
    pub mod oracle;
    pub mod spec;
}

use jiff::SignedDuration;

use support::fixture::{self, instant, Op, Outcome};
use support::oracle::{Oracle, OracleError};
use support::spec::ScheduleSpec;

fn run(spec: &ScheduleSpec, op: &Op) -> Result<Outcome, OracleError> {
    let oracle = Oracle::build(spec)?;
    Ok(match op {
        Op::Between { a, b } => Outcome::Seconds(oracle.between(instant(a), instant(b)).as_secs()),
        Op::Add { t, seconds } => {
            Outcome::Instant(oracle.add(instant(t), SignedDuration::from_secs(*seconds))?)
        }
        Op::Sub { t, seconds } => {
            Outcome::Instant(oracle.sub(instant(t), SignedDuration::from_secs(*seconds))?)
        }
        Op::NextPeriod { t } => Outcome::Period(oracle.next_period(instant(t))?),
        Op::PreviousPeriod { t } => Outcome::Period(oracle.previous_period(instant(t))?),
        Op::Build => Outcome::Built,
    })
}

fn error_name(e: OracleError) -> &'static str {
    match e {
        OracleError::NoWorkingTime => "no_working_time",
        OracleError::OutOfRange => "out_of_range",
        OracleError::UnknownZone => "unknown_zone",
    }
}

#[test]
fn oracle_matches_every_design_example() {
    let fixture = fixture::load();
    let mut failures = Vec::new();
    for case in &fixture.cases {
        let actual = run(&fixture.schedules[&case.schedule], &case.op).map_err(error_name);
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

#[test]
fn fixture_covers_every_engine_example_in_design() {
    let design = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../DESIGN.md"))
        .expect("DESIGN.md is readable");
    let fixture = fixture::load();
    let missing: Vec<&str> = design
        .lines()
        .filter_map(|line| line.strip_prefix("| ")?.split(" |").next())
        .filter(|id| is_example_id(id) && !id.starts_with(['N', 'C']))
        .filter(|id| !fixture.cases.iter().any(|c| c.id == *id))
        .collect();
    assert!(
        missing.is_empty(),
        "examples missing from the fixture: {missing:?}"
    );
}

fn is_example_id(s: &str) -> bool {
    let digits = s.trim_start_matches(|c: char| c.is_ascii_uppercase());
    digits.len() < s.len() && !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit())
}
