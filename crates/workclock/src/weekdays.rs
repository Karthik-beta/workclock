use std::fmt;

use jiff::civil::Weekday;

const ALL_DAYS: [Weekday; 7] = [
    Weekday::Monday,
    Weekday::Tuesday,
    Weekday::Wednesday,
    Weekday::Thursday,
    Weekday::Friday,
    Weekday::Saturday,
    Weekday::Sunday,
];

/// A set of days of the week.
///
/// # Examples
///
/// ```
/// use jiff::civil::Weekday;
/// use workclock::Weekdays;
///
/// let weekend: Weekdays = [Weekday::Saturday, Weekday::Sunday].into_iter().collect();
/// assert!(weekend.contains(Weekday::Sunday));
/// assert!(!weekend.contains(Weekday::Monday));
/// assert!(Weekdays::MON_TO_FRI.contains(Weekday::Friday));
/// ```
#[derive(Clone, Copy, Default, PartialEq, Eq, Hash)]
pub struct Weekdays(u8);

impl Weekdays {
    /// No days.
    ///
    /// # Examples
    ///
    /// ```
    /// use workclock::Weekdays;
    ///
    /// assert!(Weekdays::EMPTY.is_empty());
    /// assert_eq!(Weekdays::EMPTY, Weekdays::default());
    /// ```
    pub const EMPTY: Self = Self(0);
    /// Monday to Friday.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::Weekday;
    /// use workclock::Weekdays;
    ///
    /// assert!(Weekdays::MON_TO_FRI.contains(Weekday::Friday));
    /// assert!(!Weekdays::MON_TO_FRI.contains(Weekday::Saturday));
    /// ```
    pub const MON_TO_FRI: Self = Self(0b001_1111);
    /// Every day of the week.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::Weekday;
    /// use workclock::Weekdays;
    ///
    /// assert!(Weekdays::ALL.contains(Weekday::Saturday));
    /// assert!(Weekdays::ALL.contains(Weekday::Sunday));
    /// ```
    pub const ALL: Self = Self(0b111_1111);

    /// Returns whether `day` is in the set.
    ///
    /// # Examples
    ///
    /// ```
    /// use jiff::civil::Weekday;
    /// use workclock::Weekdays;
    ///
    /// assert!(Weekdays::ALL.contains(Weekday::Saturday));
    /// assert!(!Weekdays::EMPTY.contains(Weekday::Saturday));
    /// ```
    #[must_use]
    pub fn contains(self, day: Weekday) -> bool {
        self.0 & bit(day) != 0
    }

    /// Returns whether the set has no days.
    ///
    /// # Examples
    ///
    /// ```
    /// use workclock::Weekdays;
    ///
    /// assert!(Weekdays::EMPTY.is_empty());
    /// assert!(!Weekdays::MON_TO_FRI.is_empty());
    /// ```
    #[must_use]
    pub fn is_empty(self) -> bool {
        self.0 == 0
    }
}

fn bit(day: Weekday) -> u8 {
    1 << day.to_monday_zero_offset()
}

impl FromIterator<Weekday> for Weekdays {
    fn from_iter<I: IntoIterator<Item = Weekday>>(days: I) -> Self {
        Self(days.into_iter().fold(0, |set, day| set | bit(day)))
    }
}

impl fmt::Debug for Weekdays {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_set()
            .entries(ALL_DAYS.into_iter().filter(|&day| self.contains(day)))
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use jiff::civil::Weekday;

    use super::{Weekdays, ALL_DAYS};

    #[test]
    fn constants_match_their_days() {
        assert_eq!(Weekdays::ALL, ALL_DAYS.into_iter().collect());
        assert_eq!(
            Weekdays::MON_TO_FRI,
            ALL_DAYS[..5].iter().copied().collect()
        );
        assert_eq!(Weekdays::EMPTY, std::iter::empty().collect());
        assert_eq!(Weekdays::default(), Weekdays::EMPTY);
    }

    #[test]
    fn duplicates_collapse() {
        let days: Weekdays = [Weekday::Monday, Weekday::Monday].into_iter().collect();
        assert_eq!(format!("{days:?}"), "{Monday}");
    }

    #[test]
    fn debug_lists_days_from_monday() {
        let days: Weekdays = [Weekday::Sunday, Weekday::Wednesday].into_iter().collect();
        assert_eq!(format!("{days:?}"), "{Wednesday, Sunday}");
    }
}
