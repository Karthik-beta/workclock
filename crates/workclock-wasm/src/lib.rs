//! WebAssembly bindings for workclock, built with wasm-pack into the `workclock`
//! npm package.
//!
//! Instants come in as `Date` objects or ISO 8601 strings with an offset and go
//! out as `Date` objects; durations are numbers of milliseconds.
//!
//! The doc comments on exported items become the `JSDoc` of the generated
//! TypeScript declarations, so they are written for JavaScript users.

// The crate is not published and its docs are JSDoc: errors are documented
// with `@throws` tags, and the type names in their braces take no backticks.
#![allow(clippy::missing_errors_doc, clippy::doc_markdown)]

use jiff::civil::{Date, Time, Weekday};
use jiff::fmt::temporal::{Pieces, PiecesOffset};
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

/**
 * Working hours (`"workday"`) or time off within them (`"break"`) on some days
 * of the week. Times are wall-clock times in the rule's time zone, written
 * `HH:MM`, `HH:MM:SS` or `HH:MM:SS.fff` on a 24-hour clock, such as `"09:00"`
 * or `"17:30:00"`.
 */
export interface HoursRule {
  type: "workday" | "break";
  /** Wall-clock start, such as `"09:00"`. */
  start: string;
  /** Wall-clock end; at or before `start` means the hours end the next day. */
  end: string;
  /**
   * Days on which the hours start. Defaults to Monday to Friday, for breaks
   * too, so a break on a weekend workday needs its own `days`.
   */
  days?: readonly Weekday[];
  /** IANA time zone; defaults to the schedule's. */
  timeZone?: string;
}

/** Dates that are not worked, each from 00:00 to the next 00:00. */
export interface HolidaysRule {
  type: "holidays";
  /** Dates such as `"2026-12-25"`. */
  dates: readonly string[];
  /** IANA time zone; defaults to the schedule's. */
  timeZone?: string;
}

/**
 * One rule of a schedule. Working time is the time inside workdays and
 * outside breaks and holidays.
 */
export type Rule = HoursRule | HolidaysRule;

/** What `new Schedule` takes. */
export interface ScheduleOptions {
  /** IANA time zone for rules without their own; defaults to `"UTC"`. */
  timeZone?: string;
  /** The rules, in any order. */
  rules: readonly Rule[];
}

/** A `Date`, or an ISO 8601 string with a UTC offset. */
export type Instant = Date | string;

/** A period: a maximal stretch of working time. */
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
  /**
   * `between` for each pair.
   * @throws {RangeError} If `a` and `b` differ in length.
   */
  betweenMany(a: Float64Array, b: Float64Array): Float64Array;
  betweenMany(a: readonly Instant[], b: readonly Instant[]): number[];
  betweenMany(a: Float64Array | readonly Instant[], b: Float64Array | readonly Instant[]): Float64Array | number[];
  /** `add` for each instant. */
  addMany(t: Float64Array, ms: number | readonly number[] | Float64Array): Float64Array;
  addMany(t: readonly Instant[], ms: number | readonly number[] | Float64Array): Date[];
  addMany(t: Float64Array | readonly Instant[], ms: number | readonly number[] | Float64Array): Float64Array | Date[];
  /** `sub` for each instant. */
  subMany(t: Float64Array, ms: number | readonly number[] | Float64Array): Float64Array;
  subMany(t: readonly Instant[], ms: number | readonly number[] | Float64Array): Date[];
  subMany(t: Float64Array | readonly Instant[], ms: number | readonly number[] | Float64Array): Float64Array | Date[];
}
"#;

/// Returns the version of workclock this module was built from, such as
/// `"0.1.0"`.
#[wasm_bindgen]
#[must_use]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}

/// Working time defined by rules, evaluated in IANA time zones.
///
/// Instants are `Date`s or ISO 8601 strings with a UTC offset, and durations
/// are numbers of milliseconds. Results are exact to the millisecond.
#[wasm_bindgen]
pub struct Schedule(CoreSchedule);

#[wasm_bindgen]
impl Schedule {
    /// Builds a schedule from its rules.
    ///
    /// @param options The default time zone and the rules.
    /// @throws {UnknownZoneError} If a time zone is not in the IANA database.
    /// @throws {NoWorkingTimeError} If the working hours minus the breaks are
    /// empty.
    /// @throws {TypeError} If `options` or a rule has the wrong shape; the
    /// message names the rule, such as `rules[1]`.
    /// @throws {RangeError} If a time, day or date cannot be read.
    /// @example
    /// ```js
    /// const support = new Schedule({
    ///   timeZone: "Europe/London",
    ///   rules: [
    ///     { type: "workday", start: "09:00", end: "17:00" },
    ///     { type: "break", start: "12:00", end: "13:00" },
    ///     { type: "holidays", dates: ["2026-12-25", "2026-12-28"] },
    ///   ],
    /// });
    /// ```
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
            return Err(type_error(&format!(
                "`rules` must be an array, got {}",
                show(&rules)
            )));
        }
        for (i, value) in Array::from(&rules).iter().enumerate() {
            builder = builder.rule(rule(&value).map_err(|e| prefixed(&format!("rules[{i}]"), e))?);
        }
        builder.build().map(Schedule).map_err(|e| engine_error(&e))
    }

    /// Measures the working time between two instants.
    ///
    /// @param a The start.
    /// @param b The end.
    /// @returns The working time in milliseconds; negative when `b` is before
    /// `a`.
    /// @throws {OutOfRangeError} If an instant is outside the supported range.
    /// @throws {TypeError} If an instant is neither a `Date` nor a string.
    /// @throws {RangeError} If an instant is an invalid `Date` or a string
    /// without a UTC offset.
    /// @example
    /// ```js
    /// support.between("2026-01-05T09:00:00Z", "2026-01-06T09:00:00Z"); // 25200000, 7 hours
    /// ```
    pub fn between(
        &self,
        #[wasm_bindgen(unchecked_param_type = "Instant")] a: &JsValue,
        #[wasm_bindgen(unchecked_param_type = "Instant")] b: &JsValue,
    ) -> Result<f64, JsValue> {
        let duration = self.0.between(instant(a)?, instant(b)?);
        Ok(millis(duration_millis(duration)?))
    }

    /// Finds the instant a given amount of working time after another.
    ///
    /// @param t The instant to count from.
    /// @param ms Working time in milliseconds; a negative amount counts back.
    /// @returns The earliest instant with `ms` of working time after `t`, or
    /// `t` itself when `ms` is zero.
    /// @throws {NoWorkingTimeError} If no working time is found within 366
    /// days, plus one day per holiday date.
    /// @throws {OutOfRangeError} If `t` or the result is outside the supported
    /// range.
    /// @throws {TypeError} If `t` is neither a `Date` nor a string, or `ms` is
    /// not a number.
    /// @throws {RangeError} If `t` is malformed, or `ms` is not a whole number
    /// within ±`Number.MAX_SAFE_INTEGER`.
    /// @example
    /// ```js
    /// const due = support.add("2026-12-24T16:30:00Z", 8 * 3_600_000);
    /// due.toISOString(); // "2026-12-30T09:30:00.000Z"
    /// ```
    pub fn add(
        &self,
        #[wasm_bindgen(unchecked_param_type = "Instant")] t: &JsValue,
        #[wasm_bindgen(unchecked_param_type = "number")] ms: &JsValue,
    ) -> Result<js_sys::Date, JsValue> {
        let result = self.0.add(instant(t)?, duration(number(ms)?)?);
        result.map(date).map_err(|e| engine_error(&e))
    }

    /// Finds the instant a given amount of working time before another.
    ///
    /// @param t The instant to count back from.
    /// @param ms Working time in milliseconds; a negative amount counts
    /// forward.
    /// @returns The latest instant with `ms` of working time before `t`, or
    /// `t` itself when `ms` is zero.
    /// @throws {NoWorkingTimeError} If no working time is found within 366
    /// days, plus one day per holiday date.
    /// @throws {OutOfRangeError} If `t` or the result is outside the supported
    /// range.
    /// @throws {TypeError} If `t` is neither a `Date` nor a string, or `ms` is
    /// not a number.
    /// @throws {RangeError} If `t` is malformed, or `ms` is not a whole number
    /// within ±`Number.MAX_SAFE_INTEGER`.
    pub fn sub(
        &self,
        #[wasm_bindgen(unchecked_param_type = "Instant")] t: &JsValue,
        #[wasm_bindgen(unchecked_param_type = "number")] ms: &JsValue,
    ) -> Result<js_sys::Date, JsValue> {
        let result = self.0.sub(instant(t)?, duration(number(ms)?)?);
        result.map(date).map_err(|e| engine_error(&e))
    }

    /// Finds the period of working time at or after an instant.
    ///
    /// @param t The instant to search from.
    /// @returns The period that contains `t`, starting at `t`, or else the
    /// first one after it.
    /// @throws {NoWorkingTimeError} If no working time is found within 366
    /// days, plus one day per holiday date.
    /// @throws {OutOfRangeError} If `t` is outside the supported range, or the
    /// search reaches its end.
    /// @throws {TypeError} If `t` is neither a `Date` nor a string.
    /// @throws {RangeError} If `t` is malformed.
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

    /// Finds the period of working time at or before an instant.
    ///
    /// @param t The instant to search back from.
    /// @returns The period that contains `t`, ending at `t`, or else the last
    /// one before it.
    /// @throws {NoWorkingTimeError} If no working time is found within 366
    /// days, plus one day per holiday date.
    /// @throws {OutOfRangeError} If `t` is outside the supported range, or the
    /// search reaches its start.
    /// @throws {TypeError} If `t` is neither a `Date` nor a string.
    /// @throws {RangeError} If `t` is malformed.
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
    /// @throws {RangeError} If `a` and `b` differ in length.
    /// @throws What `between` throws, with the failing item's index in the
    /// message.
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
    /// @throws {RangeError} If `t` and `ms` differ in length.
    /// @throws What `add` throws, with the failing item's index in the
    /// message.
    #[wasm_bindgen(js_name = addMany, skip_typescript)]
    pub fn add_many(&self, t: &JsValue, ms: &JsValue) -> Result<JsValue, JsValue> {
        shift_many(t, ms, |t, d| self.0.add(t, d))
    }

    /// Returns `sub` for each instant in `t`.
    ///
    /// @throws {RangeError} If `t` and `ms` differ in length.
    /// @throws What `sub` throws, with the failing item's index in the
    /// message.
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
        .ok_or_else(|| type_error(&format!("`{key}` must be a string, got {}", show(&value))))
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
        return Err(type_error(&format!(
            "`days` must be an array, got {}",
            show(&days)
        )));
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
        return Err(type_error(&format!(
            "`dates` must be an array, got {}",
            show(&dates)
        )));
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
        return from_millis(ms).ok_or_else(|| out_of_range(&String::from(date.to_iso_string())));
    }
    let Some(text) = value.as_string() else {
        return Err(type_error(&format!(
            "expected a Date or an ISO 8601 string, got {}",
            show(value)
        )));
    };
    let t: Timestamp = text.parse().map_err(|_| {
        if is_instant_outside_range(&text) {
            out_of_range(&text)
        } else {
            range_error(&format!(
                "{text:?} is not an ISO 8601 instant with a UTC offset in the supported range {RANGE}, such as \"2026-01-05T09:00:00Z\""
            ))
        }
    })?;
    if t.subsec_nanosecond() % 1_000_000 != 0 {
        return Err(range_error(&format!(
            "{text:?} has digits below a millisecond, which a Date cannot hold"
        )));
    }
    // jiff parses instants up to a fraction of a second beyond either end of
    // the range it accepts as whole milliseconds.
    Timestamp::from_millisecond(t.as_millisecond()).map_err(|_| out_of_range(&text))
}

/// Whether `text` is a well-formed date, time and offset that lies outside
/// the range of a `Timestamp`, such as "9999-12-31T23:00:00Z".
fn is_instant_outside_range(text: &str) -> bool {
    Pieces::parse(text).is_ok_and(|pieces| {
        pieces.time().is_some()
            && matches!(
                pieces.offset(),
                Some(PiecesOffset::Zulu | PiecesOffset::Numeric(_))
            )
    })
}

/// An instant `ms` milliseconds after the Unix epoch.
fn epoch(ms: f64) -> Result<Timestamp, JsValue> {
    // Also true for NaN and the infinities.
    if ms.fract() != 0.0 {
        return Err(range_error(&format!(
            "instants must be whole milliseconds since the epoch, got {}",
            number_text(ms)
        )));
    }
    from_millis(ms).ok_or_else(|| out_of_range(&number_text(ms)))
}

fn from_millis(ms: f64) -> Option<Timestamp> {
    integer(ms).and_then(|ms| Timestamp::from_millisecond(ms).ok())
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
                ms.as_f64().ok_or_else(|| {
                    at(
                        i,
                        type_error(&format!("durations must be numbers, got {}", show(&ms))),
                    )
                })
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
    if let Some(big) = value.dyn_ref::<js_sys::BigInt>() {
        if let Ok(digits) = big.to_string(10) {
            return format!("{}n", String::from(digits));
        }
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

/// `ms` as a number, without the coercion JavaScript would apply.
fn number(ms: &JsValue) -> Result<f64, JsValue> {
    ms.as_f64().ok_or_else(|| {
        type_error(&format!(
            "`ms` must be a number of milliseconds, got {}",
            show(ms)
        ))
    })
}

fn duration(ms: f64) -> Result<SignedDuration, JsValue> {
    integer(ms)
        .map(SignedDuration::from_millis)
        .ok_or_else(|| {
            range_error(&format!(
                "durations must be whole numbers of milliseconds within ±Number.MAX_SAFE_INTEGER, got {}",
                number_text(ms)
            ))
        })
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

/// An `OutOfRangeError` for an input instant, shown as `value`.
fn out_of_range(value: &str) -> JsValue {
    workclock_error(
        "OutOfRangeError",
        "out_of_range",
        &format!("{value} is outside the supported range {RANGE}"),
    )
}

fn workclock_error(name: &str, kind: &str, message: &str) -> JsValue {
    let js_error = js_sys::Error::new(message);
    js_error.set_name(name);
    // Setting a property on a fresh Error object cannot fail.
    let _ = Reflect::set(&js_error, &"kind".into(), &kind.into());
    js_error.into()
}
