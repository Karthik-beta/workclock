//! Python bindings for workclock, built by maturin as `workclock._workclock`.
//!
//! Instants cross the boundary as microseconds since the Unix epoch and
//! durations as microseconds. The `workclock` Python package converts them to
//! and from `datetime` objects.

use jiff::civil::{Date, Time};
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
/// `(start, end, days, zone)` of a working-day or break rule.
type HoursTuple = (TimeTuple, TimeTuple, Vec<i8>, Option<String>);
/// `(dates, zone)` of a holiday rule; dates are `(year, month, day)`.
type HolidaysTuple = (Vec<(i16, i8, i8)>, Option<String>);

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

fn engine_error(error: &Error) -> PyErr {
    EngineError::new_err(describe(error))
}

fn time((hour, minute, second, micro): TimeTuple) -> PyResult<Time> {
    Time::new(hour, minute, second, micro.saturating_mul(1000))
        .map_err(|e| PyValueError::new_err(e.to_string()))
}

fn weekdays(days: &[i8]) -> PyResult<Weekdays> {
    days.iter()
        .map(|&day| {
            jiff::civil::Weekday::from_monday_zero_offset(day)
                .map_err(|e| PyValueError::new_err(e.to_string()))
        })
        .collect()
}

fn instant(micros: i64) -> PyResult<Timestamp> {
    Timestamp::from_microsecond(micros).map_err(|_| engine_error(&Error::OutOfRange))
}

fn micros(duration: SignedDuration) -> PyResult<i64> {
    i64::try_from(duration.as_micros()).map_err(|_| engine_error(&Error::OutOfRange))
}

/// A built schedule; see `workclock.Schedule` for the public API.
#[pyclass(frozen, module = "workclock._workclock")]
struct Schedule(CoreSchedule);

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
        for (start, end, days, zone) in workdays {
            let rule = WorkDay::new(time(start)?, time(end)?, weekdays(&days)?);
            builder = builder.rule(match zone {
                Some(zone) => rule.time_zone(zone),
                None => rule,
            });
        }
        for (start, end, days, zone) in breaks {
            let rule = Break::new(time(start)?, time(end)?, weekdays(&days)?);
            builder = builder.rule(match zone {
                Some(zone) => rule.time_zone(zone),
                None => rule,
            });
        }
        for (dates, zone) in holidays {
            let dates = dates
                .into_iter()
                .map(|(y, m, d)| {
                    Date::new(y, m, d).map_err(|e| PyValueError::new_err(e.to_string()))
                })
                .collect::<PyResult<Vec<Date>>>()?;
            let rule = Holidays::new(dates);
            builder = builder.rule(match zone {
                Some(zone) => rule.time_zone(zone),
                None => rule,
            });
        }
        builder.build().map(Self).map_err(|e| engine_error(&e))
    }

    fn between(&self, a: i64, b: i64) -> PyResult<i64> {
        micros(self.0.between(instant(a)?, instant(b)?))
    }

    fn add(&self, t: i64, d: i64) -> PyResult<i64> {
        let result = self.0.add(instant(t)?, SignedDuration::from_micros(d));
        Ok(result.map_err(|e| engine_error(&e))?.as_microsecond())
    }

    fn sub(&self, t: i64, d: i64) -> PyResult<i64> {
        let result = self.0.sub(instant(t)?, SignedDuration::from_micros(d));
        Ok(result.map_err(|e| engine_error(&e))?.as_microsecond())
    }

    fn between_many(&self, py: Python<'_>, a: Vec<i64>, b: Vec<i64>) -> PyResult<Vec<i64>> {
        let schedule = &self.0;
        batch(py, a, b, |a, b| {
            let duration = schedule.between(core_instant(a)?, core_instant(b)?);
            i64::try_from(duration.as_micros()).map_err(|_| Error::OutOfRange)
        })
    }

    fn add_many(&self, py: Python<'_>, t: Vec<i64>, d: Vec<i64>) -> PyResult<Vec<i64>> {
        let schedule = &self.0;
        batch(py, t, d, |t, d| {
            let result = schedule.add(core_instant(t)?, SignedDuration::from_micros(d))?;
            Ok(result.as_microsecond())
        })
    }

    fn sub_many(&self, py: Python<'_>, t: Vec<i64>, d: Vec<i64>) -> PyResult<Vec<i64>> {
        let schedule = &self.0;
        batch(py, t, d, |t, d| {
            let result = schedule.sub(core_instant(t)?, SignedDuration::from_micros(d))?;
            Ok(result.as_microsecond())
        })
    }
}

fn core_instant(micros: i64) -> Result<Timestamp, Error> {
    Timestamp::from_microsecond(micros).map_err(|_| Error::OutOfRange)
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

#[pymodule]
mod _workclock {
    use pyo3::prelude::*;

    #[pymodule_export]
    use super::{EngineError, Schedule};

    #[pymodule_init]
    fn init(m: &Bound<'_, PyModule>) -> PyResult<()> {
        m.add("__version__", env!("CARGO_PKG_VERSION"))
    }
}
