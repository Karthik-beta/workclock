//! Loader for `tests/fixtures/design_examples.json`.

use std::collections::BTreeMap;

use jiff::Timestamp;
use serde::Deserialize;

use super::spec::ScheduleSpec;

pub const PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../tests/fixtures/design_examples.json"
);

#[derive(Debug, Deserialize)]
pub struct Fixture {
    pub schedules: BTreeMap<String, ScheduleSpec>,
    pub cases: Vec<Case>,
}

#[derive(Debug, Deserialize)]
pub struct Case {
    pub id: String,
    pub schedule: String,
    #[serde(flatten)]
    pub op: Op,
    pub expect: Expect,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum Op {
    Between { a: String, b: String },
    Add { t: String, seconds: i64 },
    Sub { t: String, seconds: i64 },
    Build,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Expect {
    Seconds(i64),
    Instant(String),
    Error(String),
}

/// What an operation returned, in the form the fixture expects.
#[derive(Debug, PartialEq)]
pub enum Outcome {
    Seconds(i64),
    Instant(Timestamp),
    Built,
}

impl Case {
    /// The expected outcome, or the fixture's name for the expected error.
    pub fn expected(&self) -> Result<Outcome, &str> {
        match &self.expect {
            Expect::Seconds(s) => Ok(Outcome::Seconds(*s)),
            Expect::Instant(t) => Ok(Outcome::Instant(instant(t))),
            Expect::Error(e) => Err(e),
        }
    }
}

pub fn instant(s: &str) -> Timestamp {
    s.parse().expect("fixture instant is RFC 3339")
}

pub fn load() -> Fixture {
    let text = std::fs::read_to_string(PATH).expect("fixture file is readable");
    serde_json::from_str(&text).expect("fixture file is valid")
}
