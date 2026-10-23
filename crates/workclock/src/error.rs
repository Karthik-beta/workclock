use std::fmt;

/// An error from building a [`Schedule`](crate::Schedule) or from searching
/// it.
///
/// # Examples
///
/// ```
/// use workclock::Error;
///
/// let error = Error::UnknownZone { name: "Mars/Olympus_Mons".into() };
/// assert_eq!(error.to_string(), "unknown time zone `Mars/Olympus_Mons`");
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum Error {
    /// The schedule has no working time.
    ///
    /// Returned when building a schedule whose available time minus its
    /// breaks is empty, and when adding or subtracting working time crosses
    /// the search bound without finding any.
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
            Error::NoWorkingTime => f.write_str("schedule has no working time"),
            Error::OutOfRange => f.write_str("result is outside the supported time range"),
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
