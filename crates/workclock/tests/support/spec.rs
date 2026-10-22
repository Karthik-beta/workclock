//! Plain-data schedule description, as written in `tests/fixtures`.

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct ScheduleSpec {
    pub zone: String,
    #[serde(default)]
    pub workdays: Vec<RuleSpec>,
    #[serde(default)]
    pub breaks: Vec<RuleSpec>,
    #[serde(default)]
    pub holidays: Vec<HolidaySpec>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RuleSpec {
    pub start: String,
    pub end: String,
    pub days: Vec<String>,
    #[serde(default)]
    pub zone: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct HolidaySpec {
    #[serde(default)]
    pub dates: Vec<String>,
    #[serde(default)]
    pub ranges: Vec<[String; 2]>,
    #[serde(default)]
    pub zone: Option<String>,
}
