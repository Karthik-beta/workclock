"""Exceptions raised by workclock."""


class WorkclockError(Exception):
    """Base class for workclock errors."""


class NoWorkingTimeError(WorkclockError, ValueError):
    """The schedule has no working time, or a search found none within a year."""


class OutOfRangeError(WorkclockError, OverflowError):
    """The result is outside the supported range of datetimes."""


class UnknownZoneError(WorkclockError, ValueError):
    """A time zone name is not in the IANA time zone database."""
