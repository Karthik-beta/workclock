//! WebAssembly bindings for workclock, built with wasm-pack into the `workclock`
//! npm package.
//!
//! Instants come in as `Date` objects or ISO 8601 strings with an offset and go
//! out as `Date` objects; durations are numbers of milliseconds.

use jiff::civil::{Date, Time, Weekday};
use jiff::{SignedDuration, Timestamp};
use js_sys::{Array, Float64Array, Reflect};
use wasm_bindgen::prelude::*;
use workclock::{Break, Error, Holidays, Rule, Schedule as CoreSchedule, Weekdays, WorkDay};

/// The repository README's Rust example. It runs here because the README is
/// outside the published `workclock` crate.
#[doc = include_str!("../../../README.md")]
#[cfg(doctest)]
pub struct RepositoryReadmeDoctests;

/// The instants a `Date` can hold that the engine supports.
const RANGE: &str = "-009999-01-02T01:59:59Z to 9999-12-30T22:00:00Z";

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

/**
 * Batch methods. Instants come as an array of `Instant`s, returning numbers or
 * `Date`s, or as a `Float64Array` of milliseconds since the epoch, returning a
 * `Float64Array`. Durations come as one number for every item, or one per item.
 * A failing item throws, naming its index.
 */
export interface Schedule {
  /** `between` for each pair; `a` and `b` must have the same length. */
  betweenMany(a: Float64Array, b: Float64Array): Float64Array;
  betweenMany(a: readonly Instant[], b: readonly Instant[]): number[];
  /** `add` for each instant. */
  addMany(t: Float64Array, ms: number | readonly number[] | Float64Array): Float64Array;
  addMany(t: readonly Instant[], ms: number | readonly number[] | Float64Array): Date[];
  /** `sub` for each instant. */
  subMany(t: Float64Array, ms: number | readonly number[] | Float64Array): Float64Array;
  subMany(t: readonly Instant[], ms: number | readonly number[] | Float64Array): Date[];
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
        if !options.is_object() {
            return Err(type_error(&format!(
                "expected an options object, got {}",
                show(options)
            )));
        }
        let mut builder = CoreSchedule::builder();
        if let Some(zone) = optional_string(options, "timeZone")? {
            builder = builder.time_zone(zone);
        }
        let rules = property(options, "rules")?;
        if !Array::is_array(&rules) {
            return Err(type_error("`rules` must be an array"));
        }
        for (i, value) in Array::from(&rules).iter().enumerate() {
            builder = builder.rule(rule(&value).map_err(|e| prefixed(&format!("rules[{i}]"), e))?);
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

    /// Returns `between` for each pair of `a` and `b`.
    ///
    /// # Errors
    ///
    /// Throws `RangeError` if `a` and `b` differ in length, and otherwise what
    /// `between` throws, with the item's index in the message.
    #[wasm_bindgen(js_name = betweenMany, skip_typescript)]
    pub fn between_many(&self, a: &JsValue, b: &JsValue) -> Result<JsValue, JsValue> {
        let (a, typed) = instants(a)?;
        let (b, _) = instants(b)?;
        same_length(a.len(), b.len())?;
        let ms = a
            .into_iter()
            .zip(b)
            .enumerate()
            .map(|(i, (a, b))| {
                duration_millis(self.0.between(a, b))
                    .map(millis)
                    .map_err(|e| at(i, e))
            })
            .collect::<Result<Vec<f64>, JsValue>>()?;
        Ok(if typed {
            Float64Array::from(&ms[..]).into()
        } else {
            ms.into_iter()
                .map(JsValue::from_f64)
                .collect::<Array>()
                .into()
        })
    }

    /// Returns `add` for each instant in `t`.
    ///
    /// # Errors
    ///
    /// Throws `RangeError` if `t` and `ms` differ in length, and otherwise what
    /// `add` throws, with the item's index in the message.
    #[wasm_bindgen(js_name = addMany, skip_typescript)]
    pub fn add_many(&self, t: &JsValue, ms: &JsValue) -> Result<JsValue, JsValue> {
        shift_many(t, ms, |t, d| self.0.add(t, d))
    }

    /// Returns `sub` for each instant in `t`.
    ///
    /// # Errors
    ///
    /// Throws `RangeError` if `t` and `ms` differ in length, and otherwise what
    /// `sub` throws, with the item's index in the message.
    #[wasm_bindgen(js_name = subMany, skip_typescript)]
    pub fn sub_many(&self, t: &JsValue, ms: &JsValue) -> Result<JsValue, JsValue> {
        shift_many(t, ms, |t, d| self.0.sub(t, d))
    }
}

fn shift_many(
    t: &JsValue,
    ms: &JsValue,
    op: impl Fn(Timestamp, SignedDuration) -> Result<Timestamp, Error>,
) -> Result<JsValue, JsValue> {
    let (t, typed) = instants(t)?;
    let ms = durations(ms, t.len())?;
    let results = t
        .into_iter()
        .zip(ms)
        .enumerate()
        .map(|(i, (t, d))| op(t, d).map_err(|e| at(i, engine_error(&e))))
        .collect::<Result<Vec<Timestamp>, JsValue>>()?;
    Ok(if typed {
        let ms: Vec<f64> = results.iter().map(|t| millis(t.as_millisecond())).collect();
        Float64Array::from(&ms[..]).into()
    } else {
        results.into_iter().map(date).collect::<Array>().into()
    })
}

fn rule(value: &JsValue) -> Result<Rule, JsValue> {
    if !value.is_object() {
        return Err(type_error(&format!(
            "expected a rule object, got {}",
            show(value)
        )));
    }
    let zone = optional_string(value, "timeZone")?;
    Ok(match optional_string(value, "type")?.as_deref() {
        Some("workday") => {
            let (start, end, days) = hours(value)?;
            in_zone(WorkDay::new(start, end, days), zone, WorkDay::time_zone).into()
        }
        Some("break") => {
            let (start, end, days) = hours(value)?;
            in_zone(Break::new(start, end, days), zone, Break::time_zone).into()
        }
        Some("holidays") => in_zone(Holidays::new(dates(value)?), zone, Holidays::time_zone).into(),
        _ => {
            return Err(type_error(
                "rule `type` must be \"workday\", \"break\" or \"holidays\"",
            ))
        }
    })
}

/// `rule` with its own time zone, if it names one.
fn in_zone<R>(rule: R, zone: Option<String>, time_zone: impl FnOnce(R, String) -> R) -> R {
    match zone {
        Some(zone) => time_zone(rule, zone),
        None => rule,
    }
}

fn property(object: &JsValue, key: &str) -> Result<JsValue, JsValue> {
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
        let time: Time = text.parse().map_err(|_| {
            range_error(&format!(
                "`{key}` must be a time such as \"09:00\", got {text:?}"
            ))
        })?;
        if time.subsec_nanosecond() % 1_000_000 != 0 {
            return Err(range_error(&format!(
                "`{key}` has digits below a millisecond, which cannot be represented, got {text:?}"
            )));
        }
        Ok(time)
    };
    let (start, end) = (time("start")?, time("end")?);
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
    Ok((start, end, days))
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
        _ => Err(range_error(&format!(
            "days must be \"mon\", \"tue\", ... or \"sun\", got {}",
            show(day)
        ))),
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
            let text = value.as_string().ok_or_else(|| {
                type_error(&format!(
                    "holiday dates must be strings, got {}",
                    show(&value)
                ))
            })?;
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
        return epoch(ms);
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
    // jiff parses instants up to a fraction of a second beyond either end of
    // the range it accepts as milliseconds, which is the range for Dates.
    Timestamp::from_millisecond(t.as_millisecond()).map_err(|_| {
        workclock_error(
            "OutOfRangeError",
            "out_of_range",
            &format!("{text} is outside the supported range {RANGE}"),
        )
    })
}

/// An instant `ms` milliseconds after the Unix epoch.
fn epoch(ms: f64) -> Result<Timestamp, JsValue> {
    // Also true for NaN and the infinities.
    if ms.fract() != 0.0 {
        return Err(range_error(
            "instants must be whole milliseconds since the epoch",
        ));
    }
    integer(ms)
        .and_then(|ms| Timestamp::from_millisecond(ms).ok())
        .ok_or_else(|| engine_error(&Error::OutOfRange))
}

/// Instants from an array of `Instant`s, or from a `Float64Array` of epoch
/// milliseconds; the flag is true for the latter.
fn instants(value: &JsValue) -> Result<(Vec<Timestamp>, bool), JsValue> {
    if let Some(array) = value.dyn_ref::<Float64Array>() {
        let t = array
            .to_vec()
            .into_iter()
            .enumerate()
            .map(|(i, ms)| epoch(ms).map_err(|e| at(i, e)))
            .collect::<Result<_, _>>()?;
        return Ok((t, true));
    }
    if !Array::is_array(value) {
        return Err(type_error(
            "expected an array of instants or a Float64Array",
        ));
    }
    let t = Array::from(value)
        .iter()
        .enumerate()
        .map(|(i, value)| instant(&value).map_err(|e| at(i, e)))
        .collect::<Result<_, _>>()?;
    Ok((t, false))
}

/// `len` durations from one number of milliseconds, or from an array or
/// `Float64Array` of them.
fn durations(value: &JsValue, len: usize) -> Result<Vec<SignedDuration>, JsValue> {
    if let Some(ms) = value.as_f64() {
        return Ok(vec![duration(ms)?; len]);
    }
    let ms = if let Some(array) = value.dyn_ref::<Float64Array>() {
        array.to_vec()
    } else if Array::is_array(value) {
        Array::from(value)
            .iter()
            .enumerate()
            .map(|(i, ms)| {
                ms.as_f64()
                    .ok_or_else(|| at(i, type_error("durations must be numbers")))
            })
            .collect::<Result<_, _>>()?
    } else {
        return Err(type_error(
            "expected milliseconds as a number, an array or a Float64Array",
        ));
    };
    same_length(len, ms.len())?;
    ms.into_iter()
        .enumerate()
        .map(|(i, ms)| duration(ms).map_err(|e| at(i, e)))
        .collect()
}

fn same_length(a: usize, b: usize) -> Result<(), JsValue> {
    if a == b {
        Ok(())
    } else {
        Err(range_error(&format!(
            "batch inputs differ in length: {a} and {b}"
        )))
    }
}

/// Prefixes an error's message with the index of the batch item that caused it.
fn at(index: usize, error: JsValue) -> JsValue {
    prefixed(&format!("item {index}"), error)
}

fn prefixed(prefix: &str, error: JsValue) -> JsValue {
    if let Some(error) = error.dyn_ref::<js_sys::Error>() {
        let message = String::from(error.message());
        error.set_message(&format!("{prefix}: {message}"));
    }
    error
}

/// `value` for an error message: strings quoted, numbers as they are, other
/// values as JSON or, failing that, by their type.
fn show(value: &JsValue) -> String {
    if let Some(text) = value.as_string() {
        return format!("{text:?}");
    }
    if let Some(number) = value.as_f64() {
        return number_text(number);
    }
    js_sys::JSON::stringify(value)
        .ok()
        .and_then(|json| json.as_string())
        .or_else(|| value.js_typeof().as_string())
        .unwrap_or_default()
}

fn number_text(number: f64) -> String {
    if number.is_infinite() {
        let sign = if number < 0.0 { "-" } else { "" };
        format!("{sign}Infinity")
    } else {
        // As JavaScript prints them, except that Rust never uses an exponent.
        number.to_string()
    }
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
    workclock_error(name, kind, &error.to_string())
}

fn workclock_error(name: &str, kind: &str, message: &str) -> JsValue {
    let js_error = js_sys::Error::new(message);
    js_error.set_name(name);
    // Setting a property on a fresh Error object cannot fail.
    let _ = Reflect::set(&js_error, &"kind".into(), &kind.into());
    js_error.into()
}
