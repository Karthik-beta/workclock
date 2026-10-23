//! Compares the engine with the oracle on random schedules, then checks
//! invariants over ranges too long for the oracle.
//!
//! Set `PROPTEST_CASES` for a deeper run.

mod support {
    pub mod engine;
    pub mod oracle;
    pub mod spec;
    pub mod strategies;
}

use jiff::{SignedDuration, Timestamp};
use proptest::prelude::*;
use workclock::{Error, Schedule};

use support::engine::{build, error_name};
use support::oracle::{Oracle, OracleError};
use support::spec::ScheduleSpec;
use support::strategies::{duration, moment, schedule, span};

fn oracle_error_name(error: OracleError) -> &'static str {
    match error {
        OracleError::NoWorkingTime => "no_working_time",
        OracleError::OutOfRange => "out_of_range",
        OracleError::UnknownZone => "unknown_zone",
    }
}

/// Builds both, skipping schedules that have no working time.
fn both(spec: &ScheduleSpec) -> Option<(Schedule, Oracle)> {
    match (build(spec), Oracle::build(spec)) {
        (Ok(engine), Ok(oracle)) => Some((engine, oracle)),
        (Err(Error::NoWorkingTime), Err(OracleError::NoWorkingTime)) => None,
        (engine, oracle) => panic!(
            "build disagrees: engine {:?}, oracle {:?}",
            engine.map(|_| ()),
            oracle.map(|_| ())
        ),
    }
}

/// The result of `add` or `sub`, or `None` if the search hit the bound. Sparse
/// schedules can hit it decades away, where zones had other DST rules.
fn found(result: Result<Timestamp, Error>) -> Option<Timestamp> {
    match result {
        Ok(t) => Some(t),
        Err(Error::NoWorkingTime) => None,
        Err(e) => panic!("unexpected error {e:?}"),
    }
}

fn engine(spec: &ScheduleSpec) -> Option<Schedule> {
    match build(spec) {
        Ok(schedule) => Some(schedule),
        Err(Error::NoWorkingTime) => None,
        Err(e) => panic!("unexpected build error {e:?}"),
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    #[test]
    fn between_matches_oracle(spec in schedule(), (a, b) in span(7)) {
        let Some((engine, oracle)) = both(&spec) else { return Ok(()) };
        prop_assert_eq!(engine.between(a, b), oracle.between(a, b));
        prop_assert_eq!(engine.between(b, a), oracle.between(b, a));
    }

    #[test]
    fn add_matches_oracle(spec in schedule(), t in moment(), d in duration(48)) {
        let Some((engine, oracle)) = both(&spec) else { return Ok(()) };
        prop_assert_eq!(
            engine.add(t, d).map_err(|e| error_name(&e)),
            oracle.add(t, d).map_err(oracle_error_name)
        );
    }

    #[test]
    fn sub_matches_oracle(spec in schedule(), t in moment(), d in duration(48)) {
        let Some((engine, oracle)) = both(&spec) else { return Ok(()) };
        prop_assert_eq!(
            engine.sub(t, d).map_err(|e| error_name(&e)),
            oracle.sub(t, d).map_err(oracle_error_name)
        );
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    fn add_then_between_round_trips_over_long_ranges(spec in schedule(), t in moment(), d in duration(2000)) {
        let Some(engine) = engine(&spec) else { return Ok(()) };
        let Some(x) = found(engine.add(t, d)) else { return Ok(()) };
        prop_assert_eq!(engine.between(t, x), d);
    }

    #[test]
    fn sub_undoes_add_up_to_idle_time(spec in schedule(), t in moment(), d in duration(2000)) {
        let Some(engine) = engine(&spec) else { return Ok(()) };
        let Some(x) = found(engine.add(t, d)) else { return Ok(()) };
        let back = found(engine.sub(x, d)).expect("the way back has the same working time");
        // From outside working time, sub lands on the start of the working
        // time that add consumed (DESIGN.md A4, A9), so only one side holds.
        if d.is_negative() {
            prop_assert!(back <= t, "sub(add(t, d), d) = {back} is after t = {t}");
        } else {
            prop_assert!(back >= t, "sub(add(t, d), d) = {back} is before t = {t}");
        }
        prop_assert_eq!(engine.between(back, x), d);
    }

    #[test]
    fn between_is_additive_over_long_ranges(spec in schedule(), (a, b) in span(400), extra in 0i64..=400 * 24 * 60) {
        let Some(engine) = engine(&spec) else { return Ok(()) };
        let c = b + SignedDuration::from_mins(extra);
        prop_assert_eq!(engine.between(a, b) + engine.between(b, c), engine.between(a, c));
    }
}
