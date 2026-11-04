"""Exceptions raised by workclock."""


class WorkclockError(Exception):
    """Base class for workclock errors."""


class NoWorkingTimeError(WorkclockError, ValueError):
    """The schedule has no working time, or a search found none within its bound.

    The bound is 366 days, plus seven days per holiday date.
    """


class OutOfRangeError(WorkclockError, OverflowError):
    """An instant, amount or result is outside the supported range."""


class UnknownZoneError(WorkclockError, ValueError):
    """A time zone name is not in the IANA time zone database."""
