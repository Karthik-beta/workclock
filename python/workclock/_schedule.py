"""Typed API: rules and schedules over timezone-aware datetimes."""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from typing import Optional, Union

from workclock import _workclock
from workclock._errors import (
    NoWorkingTimeError,
    OutOfRangeError,
    UnknownZoneError,
    WorkclockError,
)
from workclock._zones import zone_name

_TimeTuple = tuple[int, int, int, int]
_HoursSpec = tuple[_TimeTuple, _TimeTuple, list[int], Optional[str]]

_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
_MICROSECOND = timedelta(microseconds=1)
_ERRORS: dict[str, type[WorkclockError]] = {
    "no_working_time": NoWorkingTimeError,
    "out_of_range": OutOfRangeError,
    "unknown_zone": UnknownZoneError,
}


@contextmanager
def _engine_errors() -> Iterator[None]:
    try:
        yield
    except _workclock.EngineError as error:
        kind, message = error.args
        raise _ERRORS.get(kind, WorkclockError)(message) from None


def _optional_zone(zone: str | tzinfo | None) -> str | None:
    return None if zone is None else zone_name(zone)


def _time_tuple(value: time) -> _TimeTuple:
    if not isinstance(value, time):
        raise TypeError(f"expected a datetime.time, got {value!r}")
    if value.tzinfo is not None:
        raise ValueError(f"{value!r} has a tzinfo; set the rule's time_zone instead")
    return (value.hour, value.minute, value.second, value.microsecond)


def _micros(value: datetime) -> int:
    if not isinstance(value, datetime):
        raise TypeError(f"expected a datetime, got {value!r}")
    if value.utcoffset() is None:
        raise ValueError(
            f"{value!r} is naive; workclock needs timezone-aware datetimes"
        )
    return (value - _EPOCH) // _MICROSECOND


def _datetime(micros: int, tz: tzinfo | None) -> datetime:
    try:
        return (_EPOCH + timedelta(microseconds=micros)).astimezone(tz)
    except OverflowError:
        raise OutOfRangeError("result is outside the range of datetime") from None


@dataclass(frozen=True, init=False)
class _Hours:
    start: time
    end: time
    days: frozenset[int]
    time_zone: str | None

    def __init__(
        self,
        start: time,
        end: time,
        days: Iterable[int] = range(5),
        *,
        time_zone: str | tzinfo | None = None,
    ) -> None:
        _time_tuple(start)
        _time_tuple(end)
        days = frozenset(days)
        if not all(isinstance(day, int) and 0 <= day <= 6 for day in days):
            raise ValueError(
                f"days must be integers from 0 (Monday) to 6, got {sorted(days)}"
            )
        object.__setattr__(self, "start", start)
        object.__setattr__(self, "end", end)
        object.__setattr__(self, "days", days)
        object.__setattr__(self, "time_zone", _optional_zone(time_zone))

    def _spec(self) -> _HoursSpec:
        return (
            _time_tuple(self.start),
            _time_tuple(self.end),
            sorted(self.days),
            self.time_zone,
        )


class WorkDay(_Hours):
    """Working hours on some days of the week.

    On each local date whose weekday is in ``days`` (0 is Monday), the rule
    makes the time from ``start`` to ``end`` available for work. If ``end``
    is not after ``start``, the shift is overnight and ends on the next date,
    so ``start == end`` is a 24-hour shift. A shift belongs to the day it
    starts on. ``time_zone`` defaults to the schedule's.
    """


class Break(_Hours):
    """Time off on some days of the week, such as a lunch break.

    Takes the same arguments as `WorkDay`, including overnight breaks, and
    removes its time from the working time.
    """


@dataclass(frozen=True, init=False)
class Holidays:
    """Dates that are not worked.

    Each date removes the time from 00:00 to the next 00:00 in ``time_zone``,
    which defaults to the schedule's. ``dates`` is read once; a
    python-holidays object contributes only the years it already holds, so
    create it with ``years=...``.
    """

    dates: frozenset[date]
    time_zone: str | None

    def __init__(
        self, dates: Iterable[date], *, time_zone: str | tzinfo | None = None
    ) -> None:
        dates = frozenset(dates)
        for value in dates:
            if isinstance(value, datetime) or not isinstance(value, date):
                raise TypeError(
                    f"holidays must be datetime.date objects, got {value!r}"
                )
        object.__setattr__(self, "dates", dates)
        object.__setattr__(self, "time_zone", _optional_zone(time_zone))

    def _spec(self) -> tuple[list[tuple[int, int, int]], str | None]:
        return ([(d.year, d.month, d.day) for d in sorted(self.dates)], self.time_zone)


Rule = Union[WorkDay, Break, Holidays]


class Schedule:
    """Working time defined by rules, evaluated in IANA time zones.

    Working time is the union of every `WorkDay` minus every `Break` and
    `Holidays` date, so the order of rules never matters. ``time_zone`` is
    the default for rules that do not set their own, and is UTC if omitted.

    Raises `UnknownZoneError` for a zone that is not in the IANA database,
    and `NoWorkingTimeError` if the working hours minus the breaks are empty.
    """

    def __init__(
        self, rules: Iterable[Rule], *, time_zone: str | tzinfo | None = None
    ) -> None:
        self._rules = tuple(rules)
        self._time_zone = _optional_zone(time_zone)
        workdays, breaks, holidays = [], [], []
        for rule in self._rules:
            if isinstance(rule, WorkDay):
                workdays.append(rule._spec())
            elif isinstance(rule, Break):
                breaks.append(rule._spec())
            elif isinstance(rule, Holidays):
                holidays.append(rule._spec())
            else:
                raise TypeError(f"expected WorkDay, Break or Holidays, got {rule!r}")
        with _engine_errors():
            self._schedule = _workclock.Schedule(
                self._time_zone, workdays, breaks, holidays
            )

    def __repr__(self) -> str:
        """Return the rules and zone the schedule was built from."""
        return f"Schedule({list(self._rules)!r}, time_zone={self._time_zone!r})"

    @property
    def rules(self) -> tuple[Rule, ...]:
        """The rules the schedule was built from."""
        return self._rules

    @property
    def time_zone(self) -> str | None:
        """The default time zone of the rules."""
        return self._time_zone

    def between(self, a: datetime, b: datetime) -> timedelta:
        """Return the working time between ``a`` and ``b``.

        The result is negative when ``b`` is before ``a``.
        """
        with _engine_errors():
            micros = self._schedule.between(_micros(a), _micros(b))
        return timedelta(microseconds=micros)

    def add(
        self,
        dt: datetime,
        delta: timedelta | None = None,
        /,
        *,
        hours: float = 0,
        minutes: float = 0,
        seconds: float = 0,
    ) -> datetime:
        """Return the earliest datetime with the given working time after ``dt``.

        The amount is ``delta`` plus ``hours``, ``minutes`` and ``seconds``.
        Zero returns ``dt`` unchanged, and a negative amount subtracts. The
        result has the same ``tzinfo`` as ``dt``.
        """
        amount = _amount(delta, hours, minutes, seconds)
        with _engine_errors():
            micros = self._schedule.add(_micros(dt), amount)
        return _datetime(micros, dt.tzinfo)

    def sub(
        self,
        dt: datetime,
        delta: timedelta | None = None,
        /,
        *,
        hours: float = 0,
        minutes: float = 0,
        seconds: float = 0,
    ) -> datetime:
        """Return the latest datetime with the given working time before ``dt``.

        The amount is ``delta`` plus ``hours``, ``minutes`` and ``seconds``.
        Zero returns ``dt`` unchanged, and a negative amount adds. The result
        has the same ``tzinfo`` as ``dt``.
        """
        amount = _amount(delta, hours, minutes, seconds)
        with _engine_errors():
            micros = self._schedule.sub(_micros(dt), amount)
        return _datetime(micros, dt.tzinfo)


def _amount(
    delta: timedelta | None, hours: float, minutes: float, seconds: float
) -> int:
    total = timedelta(hours=hours, minutes=minutes, seconds=seconds)
    if delta is not None:
        total += delta
    return total // _MICROSECOND
