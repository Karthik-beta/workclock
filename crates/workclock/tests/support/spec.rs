//! Plain-data schedule description, as written in `tests/fixtures`.

use std::collections::BTreeSet;

use jiff::civil::{Date, Time, Weekday};
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

impl RuleSpec {
    pub fn start_time(&self) -> Time {
        self.start.parse().expect("rule start is HH:MM")
    }

    pub fn end_time(&self) -> Time {
        self.end.parse().expect("rule end is HH:MM")
    }

    pub fn weekdays(&self) -> Vec<Weekday> {
        self.days.iter().map(|d| weekday(d)).collect()
    }
}

impl HolidaySpec {
    /// Every date listed or inside a range.
    pub fn all_dates(&self) -> BTreeSet<Date> {
        let mut dates: BTreeSet<Date> = self
            .dates
            .iter()
            .map(|d| d.parse().expect("date is YYYY-MM-DD"))
            .collect();
        for [from, to] in &self.ranges {
            let to: Date = to.parse().expect("date is YYYY-MM-DD");
            let mut d: Date = from.parse().expect("date is YYYY-MM-DD");
            while d <= to {
                dates.insert(d);
                d = d.tomorrow().expect("holiday range within jiff's range");
            }
        }
        dates
    }
}

fn weekday(name: &str) -> Weekday {
    match name {
        "mon" => Weekday::Monday,
        "tue" => Weekday::Tuesday,
        "wed" => Weekday::Wednesday,
        "thu" => Weekday::Thursday,
        "fri" => Weekday::Friday,
        "sat" => Weekday::Saturday,
        "sun" => Weekday::Sunday,
        other => panic!("unknown weekday {other:?}"),
    }
}
