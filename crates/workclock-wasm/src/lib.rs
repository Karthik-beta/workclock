//! WebAssembly bindings for workclock, built with wasm-pack into the `workclock`
//! npm package.
//!
//! Instants come in as `Date` objects or ISO 8601 strings with an offset and go
//! out as `Date` objects; durations are numbers of milliseconds.

use jiff::civil::{Date, Time, Weekday};
use jiff::{SignedDuration, Timestamp};
use js_sys::{Array, Reflect};
use wasm_bindgen::prelude::*;
use workclock::{Break, Error, Holidays, Schedule as CoreSchedule, Weekdays, WorkDay};

#[wasm_bindgen(typescript_custom_section)]
const TYPES: &str = r#"
/** A day of the week. */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Working hours or a break on some days of the week. */
export interface HoursRule {
  type: "workday" | "break";
  /** Wall-clock start, such as `"09:00"`. */
  start: string;
  /** Wall-clock end; at or before `start` means the shift ends the next day. */
  end: string;
  /** Defaults to Monday to Friday. */
  days?: Weekday[];
  /** IANA time zone; defaults to the schedule's. */
  timeZone?: string;
}

/** Dates that are not worked, each from 00:00 to the next 00:00. */
export interface HolidaysRule {
  type: "holidays";
  /** Dates such as `"2026-12-25"`. */
  dates: string[];
  /** IANA time zone; defaults to the schedule's. */
  timeZone?: string;
}

export type Rule = HoursRule | HolidaysRule;

export interface ScheduleOptions {
  /** IANA time zone for rules without their own; defaults to `"UTC"`. */
  timeZone?: string;
  rules: Rule[];
}

/** A `Date`, or an ISO 8601 string with a UTC offset. */
export type Instant = Date | string;

/** A stretch of working time. */
export interface Period {
  start: Date;
  end: Date;
}
"#;

/// Returns the workclock version this module was built from.
#[wasm_bindgen]
#[must_use]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}

/// Working time defined by rules, evaluated in IANA time zones.
#[wasm_bindgen]
pub struct Schedule(CoreSchedule);

#[wasm_bindgen]
impl Schedule {
    /// Builds a schedule.
    ///
    /// # Errors
    ///
    /// Throws `UnknownZoneError` for an unknown time zone, `NoWorkingTimeError`
    /// if the working hours minus the breaks are empty, and `TypeError` or
    /// `RangeError` for malformed options.
    #[wasm_bindgen(constructor)]
    pub fn new(
        #[wasm_bindgen(unchecked_param_type = "ScheduleOptions")] options: &JsValue,
    ) -> Result<Schedule, JsValue> {
        let mut builder = CoreSchedule::builder();
        if let Some(zone) = optional_string(options, "timeZone")? {
            builder = builder.time_zone(zone);
        }
        let rules = property(options, "rules")?;
        if !Array::is_array(&rules) {
            return Err(type_error("`rules` must be an array"));
        }
        for rule in Array::from(&rules).iter() {
            let zone = optional_string(&rule, "timeZone")?;
            let kind = optional_string(&rule, "type")?;
            builder = match kind.as_deref() {
                Some("workday") => {
                    let (start, end, days) = hours(&rule)?;
                    let rule = WorkDay::new(start, end, days);
                    builder.rule(match zone {
                        Some(zone) => rule.time_zone(zone),
                        None => rule,
                    })
                }
                Some("break") => {
                    let (start, end, days) = hours(&rule)?;
                    let rule = Break::new(start, end, days);
                    builder.rule(match zone {
                        Some(zone) => rule.time_zone(zone),
                        None => rule,
                    })
                }
                Some("holidays") => {
                    let rule = Holidays::new(dates(&rule)?);
                    builder.rule(match zone {
                        Some(zone) => rule.time_zone(zone),
                        None => rule,
                    })
                }
                _ => {
                    return Err(type_error(
                        "rule `type` must be \"workday\", \"break\" or \"holidays\"",
                    ))
                }
            };
        }
        builder.build().map(Schedule).map_err(|e| engine_error(&e))
    }

    /// Returns the working time between `a` and `b` in milliseconds; negative
    /// when `b` is before `a`.
    ///
    /// # Errors
    ///
    /// Throws `TypeError` or `RangeError` for a malformed instant.
    pub fn between(
        &self,
        #[wasm_bindgen(unchecked_param_type = "Instant")] a: &JsValue,
        #[wasm_bindgen(unchecked_param_type = "Instant")] b: &JsValue,
    ) -> Result<f64, JsValue> {
        let duration = self.0.between(instant(a)?, instant(b)?);
        Ok(millis(duration_millis(duration)?))
    }

    /// Returns the earliest instant with `ms` milliseconds of working time
    /// after `t`. Zero returns `t`; a negative amount subtracts.
    ///
    /// # Errors
    ///
    /// Throws `NoWorkingTimeError` if a year passes without working time,
    /// `OutOfRangeError` if the result is past the supported range, and
    /// `TypeError` or `RangeError` for malformed arguments.
    pub fn add(
        &self,
        #[wasm_bindgen(unchecked_param_type = "Instant")] t: &JsValue,
        ms: f64,
    ) -> Result<js_sys::Date, JsValue> {
        let result = self.0.add(instant(t)?, duration(ms)?);
        result.map(date).map_err(|e| engine_error(&e))
    }

    /// Returns the latest instant with `ms` milliseconds of working time
    /// before `t`. Zero returns `t`; a negative amount adds.
    ///
    /// # Errors
    ///
    /// Throws `NoWorkingTimeError` if a year passes without working time,
    /// `OutOfRangeError` if the result is past the supported range, and
    /// `TypeError` or `RangeError` for malformed arguments.
    pub fn sub(
        &self,
        #[wasm_bindgen(unchecked_param_type = "Instant")] t: &JsValue,
        ms: f64,
    ) -> Result<js_sys::Date, JsValue> {
        let result = self.0.sub(instant(t)?, duration(ms)?);
        result.map(date).map_err(|e| engine_error(&e))
    }

    /// Returns the stretch of working time that contains `t`, or the first
    /// one after it. If `t` is inside one, `start` is `t`.
    ///
    /// # Errors
    ///
    /// Throws `NoWorkingTimeError` if a year passes without working time,
    /// `OutOfRangeError` at the end of the supported range, and `TypeError`
    /// or `RangeError` for a malformed instant.
    #[wasm_bindgen(js_name = nextPeriod, unchecked_return_type = "Period")]
    pub fn next_period(
        &self,
        #[wasm_bindgen(unchecked_param_type = "Instant")] t: &JsValue,
    ) -> Result<JsValue, JsValue> {
        let period = self
            .0
            .next_period(instant(t)?)
            .map_err(|e| engine_error(&e))?;
        period_object(period.start, period.end)
    }

    /// Returns the stretch of working time that contains `t`, or the last one
    /// before it. If `t` is inside one, `end` is `t`.
    ///
    /// # Errors
    ///
    /// Throws `NoWorkingTimeError` if a year passes without working time,
    /// `OutOfRangeError` at the start of the supported range, and `TypeError`
    /// or `RangeError` for a malformed instant.
    #[wasm_bindgen(js_name = previousPeriod, unchecked_return_type = "Period")]
    pub fn previous_period(
        &self,
        #[wasm_bindgen(unchecked_param_type = "Instant")] t: &JsValue,
    ) -> Result<JsValue, JsValue> {
        let period = self
            .0
            .previous_period(instant(t)?)
            .map_err(|e| engine_error(&e))?;
        period_object(period.start, period.end)
    }
}

fn property(object: &JsValue, key: &str) -> Result<JsValue, JsValue> {
    if !object.is_object() {
        return Err(type_error("expected an object"));
    }
    Reflect::get(object, &JsValue::from_str(key))
}

fn optional_string(object: &JsValue, key: &str) -> Result<Option<String>, JsValue> {
    let value = property(object, key)?;
    if value.is_undefined() {
        return Ok(None);
    }
    value
        .as_string()
        .map(Some)
        .ok_or_else(|| type_error(&format!("`{key}` must be a string")))
}

fn hours(rule: &JsValue) -> Result<(Time, Time, Weekdays), JsValue> {
    let time = |key: &str| -> Result<Time, JsValue> {
        let text = optional_string(rule, key)?
            .ok_or_else(|| type_error(&format!("`{key}` is required")))?;
        text.parse().map_err(|_| {
            range_error(&format!(
                "`{key}` must be a time such as \"09:00\", got {text:?}"
            ))
        })
    };
    let days = property(rule, "days")?;
    let days = if days.is_undefined() {
        Weekdays::MON_TO_FRI
    } else if Array::is_array(&days) {
        Array::from(&days)
            .iter()
            .map(|day| weekday(&day))
            .collect::<Result<Weekdays, JsValue>>()?
    } else {
        return Err(type_error("`days` must be an array"));
    };
    Ok((time("start")?, time("end")?, days))
}

fn weekday(day: &JsValue) -> Result<Weekday, JsValue> {
    match day.as_string().as_deref() {
        Some("mon") => Ok(Weekday::Monday),
        Some("tue") => Ok(Weekday::Tuesday),
        Some("wed") => Ok(Weekday::Wednesday),
        Some("thu") => Ok(Weekday::Thursday),
        Some("fri") => Ok(Weekday::Friday),
        Some("sat") => Ok(Weekday::Saturday),
        Some("sun") => Ok(Weekday::Sunday),
        _ => Err(range_error("days must be \"mon\", \"tue\", ... or \"sun\"")),
    }
}

fn dates(rule: &JsValue) -> Result<Vec<Date>, JsValue> {
    let dates = property(rule, "dates")?;
    if !Array::is_array(&dates) {
        return Err(type_error("`dates` must be an array"));
    }
    Array::from(&dates)
        .iter()
        .map(|value| {
            let text = value
                .as_string()
                .ok_or_else(|| type_error("holiday dates must be strings"))?;
            text.parse().map_err(|_| {
                range_error(&format!(
                    "holiday dates must look like \"2026-12-25\", got {text:?}"
                ))
            })
        })
        .collect()
}

fn instant(value: &JsValue) -> Result<Timestamp, JsValue> {
    if let Some(date) = value.dyn_ref::<js_sys::Date>() {
        let ms = date.get_time();
        if ms.is_nan() {
            return Err(range_error("invalid Date"));
        }
        return integer(ms)
            .and_then(|ms| Timestamp::from_millisecond(ms).ok())
            .ok_or_else(|| engine_error(&Error::OutOfRange));
    }
    let Some(text) = value.as_string() else {
        return Err(type_error("expected a Date or an ISO 8601 string"));
    };
    let t: Timestamp = text.parse().map_err(|_| {
        range_error(&format!(
            "{text:?} is not an ISO 8601 instant with a UTC offset, such as \"2026-01-05T09:00:00Z\""
        ))
    })?;
    if t.subsec_nanosecond() % 1_000_000 != 0 {
        return Err(range_error(&format!(
            "{text:?} has digits below a millisecond, which a Date cannot hold"
        )));
    }
    Ok(t)
}

fn duration(ms: f64) -> Result<SignedDuration, JsValue> {
    integer(ms)
        .map(SignedDuration::from_millis)
        .ok_or_else(|| range_error("durations must be whole numbers of milliseconds"))
}

/// `value` as an `i64` if it is a whole number that a double holds exactly.
fn integer(value: f64) -> Option<i64> {
    const LIMIT: f64 = 9_007_199_254_740_991.0; // Number.MAX_SAFE_INTEGER
    #[allow(clippy::cast_possible_truncation)] // checked to be whole and in range
    (value.fract() == 0.0 && value.abs() <= LIMIT).then_some(value as i64)
}

fn duration_millis(duration: SignedDuration) -> Result<i64, JsValue> {
    i64::try_from(duration.as_millis()).map_err(|_| engine_error(&Error::OutOfRange))
}

#[allow(clippy::cast_precision_loss)] // every instant in jiff's range is below 2^53 ms
fn millis(ms: i64) -> f64 {
    ms as f64
}

fn date(t: Timestamp) -> js_sys::Date {
    js_sys::Date::new(&JsValue::from_f64(millis(t.as_millisecond())))
}

fn period_object(start: Timestamp, end: Timestamp) -> Result<JsValue, JsValue> {
    let period = js_sys::Object::new();
    Reflect::set(&period, &"start".into(), &date(start))?;
    Reflect::set(&period, &"end".into(), &date(end))?;
    Ok(period.into())
}

fn type_error(message: &str) -> JsValue {
    js_sys::TypeError::new(message).into()
}

fn range_error(message: &str) -> JsValue {
    js_sys::RangeError::new(message).into()
}

/// An `Error` named after the matching class in `errors.js`, with a `kind`
/// that the classes recognise in `instanceof` checks.
fn engine_error(error: &Error) -> JsValue {
    let (name, kind) = match error {
        Error::NoWorkingTime => ("NoWorkingTimeError", "no_working_time"),
        Error::OutOfRange => ("OutOfRangeError", "out_of_range"),
        Error::UnknownZone { .. } => ("UnknownZoneError", "unknown_zone"),
        _ => ("WorkclockError", "unknown"),
    };
    let js_error = js_sys::Error::new(&error.to_string());
    js_error.set_name(name);
    // Setting a property on a fresh Error object cannot fail.
    let _ = Reflect::set(&js_error, &"kind".into(), &kind.into());
    js_error.into()
}
