"""Fast, correct business-time arithmetic: working hours, SLAs and shifts."""

from workclock._errors import (
    NoWorkingTimeError,
    OutOfRangeError,
    UnknownZoneError,
    WorkclockError,
)
from workclock._schedule import Break, Holidays, Rule, Schedule, WorkDay
from workclock._workclock import __version__

__all__ = [
    "Break",
    "Holidays",
    "NoWorkingTimeError",
    "OutOfRangeError",
    "Rule",
    "Schedule",
    "UnknownZoneError",
    "WorkDay",
    "WorkclockError",
    "__version__",
]
