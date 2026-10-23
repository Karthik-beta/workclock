//! Python bindings for workclock, built by maturin as `workclock._workclock`.
//!
//! Instants cross the boundary as microseconds since the Unix epoch and
//! durations as microseconds. The `workclock` Python package converts them to
//! and from `datetime` objects.

use std::fmt::Display;
use std::ops::Range;

use jiff::civil::{Date, Time, Weekday};
use jiff::tz::TimeZone;
use jiff::{SignedDuration, Timestamp};
use pyo3::exceptions::{PyException, PyValueError};
use pyo3::prelude::*;
use workclock::{Break, Error, Holidays, Schedule as CoreSchedule, Weekdays, WorkDay};

pyo3::create_exception!(
    _workclock,
    EngineError,
    PyException,
    "An engine error. `args` is `(kind, message)`."
);

/// `(hour, minute, second, microsecond)`, as the fields of `datetime.time`.
type TimeTuple = (i8, i8, i8, i32);
/// `(year, month, day)`, as the fields of `datetime.date`.
type DateTuple = (i16, i8, i8);
/// `(start, end, days, zone)` of a working-day or break rule.
type HoursTuple = (TimeTuple, TimeTuple, Vec<i8>, Option<String>);
/// `(dates, zone)` of a holiday rule.
type HolidaysTuple = (Vec<DateTuple>, Option<String>);

/// The `(kind, message)` arguments of an `EngineError`.
fn describe(error: &Error) -> (&'static str, String) {
    let kind = match error {
        Error::NoWorkingTime => "no_working_time",
        Error::OutOfRange => "out_of_range",
        Error::UnknownZone { .. } => "unknown_zone",
        _ => "unknown",
    };
    (kind, error.to_string())
}

/// Raises engine errors as `EngineError`.
fn engine<T>(result: Result<T, Error>) -> PyResult<T> {
    result.map_err(|error| EngineError::new_err(describe(&error)))
}

fn value_error(error: impl Display) -> PyErr {
    PyValueError::new_err(error.to_string())
}

fn time((hour, minute, second, micro): TimeTuple) -> PyResult<Time> {
    Time::new(hour, minute, second, micro.saturating_mul(1000)).map_err(value_error)
}

fn date((year, month, day): DateTuple) -> PyResult<Date> {
    Date::new(year, month, day).map_err(value_error)
}

fn weekdays(days: &[i8]) -> PyResult<Weekdays> {
    days.iter()
        .map(|&day| Weekday::from_monday_zero_offset(day).map_err(value_error))
        .collect()
}

/// Sets the rule's zone if it names one; otherwise it uses the schedule's.
fn in_zone<R>(rule: R, zone: Option<String>, time_zone: impl FnOnce(R, String) -> R) -> R {
    match zone {
        Some(zone) => time_zone(rule, zone),
        None => rule,
    }
}

/// Builds a working-day or break rule from its tuple.
fn hours<R>(
    (start, end, days, zone): HoursTuple,
    new: impl FnOnce(Time, Time, Weekdays) -> R,
    time_zone: impl FnOnce(R, String) -> R,
) -> PyResult<R> {
    let rule = new(time(start)?, time(end)?, weekdays(&days)?);
    Ok(in_zone(rule, zone, time_zone))
}

fn instant(micros: i64) -> Result<Timestamp, Error> {
    Timestamp::from_microsecond(micros).map_err(|_| Error::OutOfRange)
}

fn micros(duration: SignedDuration) -> Result<i64, Error> {
    i64::try_from(duration.as_micros()).map_err(|_| Error::OutOfRange)
}

fn period(period: Range<Timestamp>) -> (i64, i64) {
    (period.start.as_microsecond(), period.end.as_microsecond())
}

/// A built schedule; see `workclock.Schedule` for the public API.
#[pyclass(frozen, module = "workclock._workclock")]
struct Schedule(CoreSchedule);

impl Schedule {
    fn between_micros(&self, a: i64, b: i64) -> Result<i64, Error> {
        micros(self.0.between(instant(a)?, instant(b)?))
    }

    fn add_micros(&self, t: i64, d: i64) -> Result<i64, Error> {
        let result = self.0.add(instant(t)?, SignedDuration::from_micros(d))?;
        Ok(result.as_microsecond())
    }

    fn sub_micros(&self, t: i64, d: i64) -> Result<i64, Error> {
        let result = self.0.sub(instant(t)?, SignedDuration::from_micros(d))?;
        Ok(result.as_microsecond())
    }
}

#[pymethods]
impl Schedule {
    #[new]
    #[pyo3(signature = (zone, workdays, breaks, holidays))]
    fn new(
        zone: Option<String>,
        workdays: Vec<HoursTuple>,
        breaks: Vec<HoursTuple>,
        holidays: Vec<HolidaysTuple>,
    ) -> PyResult<Self> {
        let mut builder = CoreSchedule::builder();
        if let Some(zone) = zone {
            builder = builder.time_zone(zone);
        }
        for spec in workdays {
            builder = builder.rule(hours(spec, WorkDay::new, WorkDay::time_zone)?);
        }
        for spec in breaks {
            builder = builder.rule(hours(spec, Break::new, Break::time_zone)?);
        }
        for (dates, zone) in holidays {
            let dates = dates.into_iter().map(date).collect::<PyResult<Vec<_>>>()?;
            builder = builder.rule(in_zone(Holidays::new(dates), zone, Holidays::time_zone));
        }
        engine(builder.build().map(Self))
    }

    fn between(&self, a: i64, b: i64) -> PyResult<i64> {
        engine(self.between_micros(a, b))
    }

    fn add(&self, t: i64, d: i64) -> PyResult<i64> {
        engine(self.add_micros(t, d))
    }

    fn sub(&self, t: i64, d: i64) -> PyResult<i64> {
        engine(self.sub_micros(t, d))
    }

    fn next_period(&self, t: i64) -> PyResult<(i64, i64)> {
        engine(instant(t).and_then(|t| self.0.next_period(t)).map(period))
    }

    fn previous_period(&self, t: i64) -> PyResult<(i64, i64)> {
        engine(
            instant(t)
                .and_then(|t| self.0.previous_period(t))
                .map(period),
        )
    }

    fn between_many(&self, py: Python<'_>, a: Vec<i64>, b: Vec<i64>) -> PyResult<Vec<i64>> {
        batch(py, a, b, |a, b| self.between_micros(a, b))
    }

    fn add_many(&self, py: Python<'_>, t: Vec<i64>, d: Vec<i64>) -> PyResult<Vec<i64>> {
        batch(py, t, d, |t, d| self.add_micros(t, d))
    }

    fn sub_many(&self, py: Python<'_>, t: Vec<i64>, d: Vec<i64>) -> PyResult<Vec<i64>> {
        batch(py, t, d, |t, d| self.sub_micros(t, d))
    }
}

/// Applies `op` to each pair without holding the GIL. The first error stops
/// the batch and names the index it occurred at.
fn batch(
    py: Python<'_>,
    left: Vec<i64>,
    right: Vec<i64>,
    op: impl Fn(i64, i64) -> Result<i64, Error> + Sync,
) -> PyResult<Vec<i64>> {
    if left.len() != right.len() {
        return Err(PyValueError::new_err(format!(
            "batch inputs differ in length: {} and {}",
            left.len(),
            right.len()
        )));
    }
    py.detach(|| {
        left.into_iter()
            .zip(right)
            .enumerate()
            .map(|(i, (l, r))| op(l, r).map_err(|e| (i, e)))
            .collect::<Result<Vec<i64>, (usize, Error)>>()
    })
    .map_err(|(i, error)| {
        let (kind, message) = describe(&error);
        EngineError::new_err((kind, format!("item {i}: {message}")))
    })
}

fn zone(name: &str) -> PyResult<TimeZone> {
    engine(TimeZone::get(name).map_err(|_| Error::UnknownZone {
        name: name.to_owned(),
    }))
}

/// The local date of an instant in a zone, as `(year, month, day)`.
#[pyfunction]
fn local_date(zone_name: &str, t: i64) -> PyResult<DateTuple> {
    let date = engine(instant(t))?.to_zoned(zone(zone_name)?).date();
    Ok((date.year(), date.month(), date.day()))
}

/// `[00:00, next 00:00)` of a local date, resolved as the engine resolves
/// holidays.
#[pyfunction]
fn day_bounds(zone_name: &str, date: DateTuple) -> PyResult<(i64, i64)> {
    let tz = zone(zone_name)?;
    let date = self::date(date)?;
    let midnight = |date: Date| {
        tz.to_ambiguous_zoned(date.to_datetime(Time::midnight()))
            .compatible()
            .map(|zoned| zoned.timestamp().as_microsecond())
            .map_err(|_| Error::OutOfRange)
    };
    let next = date.tomorrow().map_err(|_| Error::OutOfRange);
    engine(next.and_then(|next| Ok((midnight(date)?, midnight(next)?))))
}

#[pymodule]
mod _workclock {
    use pyo3::prelude::*;

    #[pymodule_export]
    use super::{day_bounds, local_date, EngineError, Schedule};

    #[pymodule_init]
    fn init(m: &Bound<'_, PyModule>) -> PyResult<()> {
        m.add("__version__", env!("CARGO_PKG_VERSION"))
    }
}
