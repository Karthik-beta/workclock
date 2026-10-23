"""Fast, correct business-time arithmetic: working hours, SLAs and shifts."""

from workclock._errors import (
    NoWorkingTimeError,
    OutOfRangeError,
    UnknownZoneError,
    WorkclockError,
)
from workclock._schedule import Break, Holidays, Schedule, WorkDay
from workclock._workclock import __version__

__all__ = [
    "Break",
    "Holidays",
    "NoWorkingTimeError",
    "OutOfRangeError",
    "Schedule",
    "UnknownZoneError",
    "WorkDay",
    "WorkclockError",
    "__version__",
]
