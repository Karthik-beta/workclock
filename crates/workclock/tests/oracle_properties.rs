//! Invariants the oracle must satisfy on random schedules. They check the
//! oracle and the generators before the engine is compared against them.
//!
//! The oracle is slow by design, so the case count is kept low; set
//! `PROPTEST_CASES` for a deeper run.

mod support {
    pub mod oracle;
    pub mod spec;
    pub mod strategies;
}

use jiff::SignedDuration;
use proptest::prelude::*;

use support::oracle::{Oracle, OracleError};
use support::strategies::{duration, moment, schedule, span};

const MINUTE: SignedDuration = SignedDuration::from_mins(1);

fn config() -> ProptestConfig {
    ProptestConfig::with_cases(32)
}

/// Builds the oracle, skipping schedules that have no working time.
fn oracle(spec: &support::spec::ScheduleSpec) -> Option<Oracle> {
    match Oracle::build(spec) {
        Ok(o) => Some(o),
        Err(OracleError::NoWorkingTime) => None,
        Err(e) => panic!("unexpected build error {e:?}"),
    }
}

proptest! {
    #![proptest_config(config())]

    #[test]
    fn between_is_antisymmetric(spec in schedule(), (a, b) in span(3)) {
        let Some(o) = oracle(&spec) else { return Ok(()) };
        prop_assert_eq!(o.between(a, b), -o.between(b, a));
    }

    #[test]
    fn between_is_additive(spec in schedule(), (a, b) in span(2), extra in 0i64..=2 * 24 * 60) {
        let Some(o) = oracle(&spec) else { return Ok(()) };
        let c = b + SignedDuration::from_mins(extra);
        prop_assert_eq!(o.between(a, b) + o.between(b, c), o.between(a, c));
    }

    #[test]
    fn add_consumes_exactly_d(spec in schedule(), t in moment(), d in duration(8)) {
        let Some(o) = oracle(&spec) else { return Ok(()) };
        let x = o.add(t, d).expect("2026 is far from the range limits");
        prop_assert_eq!(o.between(t, x), d);
    }

    #[test]
    fn add_returns_the_earliest_instant(spec in schedule(), t in moment(), d in duration(8)) {
        let Some(o) = oracle(&spec) else { return Ok(()) };
        prop_assume!(d.is_positive());
        let x = o.add(t, d).expect("2026 is far from the range limits");
        prop_assert!(o.is_working(x - MINUTE), "the minute before {x} is not working time");
    }

    #[test]
    fn sub_returns_the_latest_instant(spec in schedule(), t in moment(), d in duration(8)) {
        let Some(o) = oracle(&spec) else { return Ok(()) };
        prop_assume!(d.is_positive());
        let x = o.sub(t, d).expect("2026 is far from the range limits");
        prop_assert_eq!(o.between(x, t), d);
        prop_assert!(o.is_working(x), "the minute at {x} is not working time");
    }

    #[test]
    fn zero_duration_is_identity(spec in schedule(), t in moment()) {
        let Some(o) = oracle(&spec) else { return Ok(()) };
        prop_assert_eq!(o.add(t, SignedDuration::ZERO), Ok(t));
        prop_assert_eq!(o.sub(t, SignedDuration::ZERO), Ok(t));
    }
}
