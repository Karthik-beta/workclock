use std::fmt;

/// An error from building a [`Schedule`](crate::Schedule) or from searching
/// it.
///
/// # Examples
///
/// ```
/// use jiff::civil::time;
/// use workclock::{Error, Schedule, Weekdays, WorkDay};
///
/// let error = Schedule::builder()
///     .time_zone("Mars/Olympus_Mons")
///     .rule(WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), Weekdays::MON_TO_FRI))
///     .build()
///     .unwrap_err();
/// assert_eq!(error.to_string(), "unknown time zone `Mars/Olympus_Mons`");
/// let hint = match error {
///     Error::UnknownZone { name } => format!("{name} is not an IANA zone name"),
///     Error::NoWorkingTime => "add working hours outside the breaks".to_owned(),
///     _ => error.to_string(),
/// };
/// assert_eq!(hint, "Mars/Olympus_Mons is not an IANA zone name");
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum Error {
    /// No working time was found.
    ///
    /// [`ScheduleBuilder::build`](crate::ScheduleBuilder::build) returns it
    /// when the working hours minus the breaks are empty.
    /// [`Schedule::add`](crate::Schedule::add),
    /// [`Schedule::sub`](crate::Schedule::sub),
    /// [`Schedule::next_period`](crate::Schedule::next_period) and
    /// [`Schedule::previous_period`](crate::Schedule::previous_period) return
    /// it when they find no working time within the search bound.
    NoWorkingTime,
    /// The result lies outside the range of `jiff::Timestamp`.
    OutOfRange,
    /// A time zone name is not in the IANA time zone database.
    UnknownZone {
        /// The name that was not found.
        name: String,
    },
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::NoWorkingTime => f.write_str("no working time found"),
            Error::OutOfRange => f.write_str(
                "result is outside the supported range -009999-01-02T01:59:59Z to 9999-12-30T22:00:00Z",
            ),
            Error::UnknownZone { name } => write!(f, "unknown time zone `{name}`"),
        }
    }
}

impl std::error::Error for Error {}

#[cfg(test)]
mod tests {
    use super::Error;

    #[test]
    fn is_a_thread_safe_std_error() {
        fn check<E: std::error::Error + Send + Sync + 'static>() {}
        check::<Error>();
    }

    #[test]
    fn is_hashable() {
        let errors: std::collections::HashSet<Error> = [
            Error::NoWorkingTime,
            Error::NoWorkingTime,
            Error::OutOfRange,
        ]
        .into();
        assert_eq!(errors.len(), 2);
    }

    #[test]
    fn no_working_time_message_names_no_cause() {
        assert_eq!(Error::NoWorkingTime.to_string(), "no working time found");
    }

    #[test]
    fn messages_are_lowercase_without_trailing_punctuation() {
        for error in [
            Error::NoWorkingTime,
            Error::OutOfRange,
            Error::UnknownZone { name: "X".into() },
        ] {
            let message = error.to_string();
            assert!(message.starts_with(char::is_lowercase), "{message}");
            assert!(!message.ends_with('.'), "{message}");
        }
    }
}
