"""Typed API: rules and schedules over timezone-aware datetimes."""

from __future__ import annotations

import math
from collections.abc import Callable, Iterable, Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from typing import TYPE_CHECKING, Any, Optional, TypeVar, Union, overload

from workclock import _arrays, _workclock
from workclock._errors import (
    NoWorkingTimeError,
    OutOfRangeError,
    UnknownZoneError,
    WorkclockError,
)
from workclock._zones import zone_name

if TYPE_CHECKING:
    import numpy as np
    from numpy.typing import NDArray

_T = TypeVar("_T")
_TimeTuple = tuple[int, int, int, int]
_HoursSpec = tuple[_TimeTuple, _TimeTuple, list[int], Optional[str]]

_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
_MICROSECOND = timedelta(microseconds=1)
# The engine takes amounts as signed 64-bit microseconds.
_MIN_AMOUNT = -(2**63)
_MAX_AMOUNT = 2**63 - 1
_AMOUNT_RANGE = f"{_MIN_AMOUNT} to {_MAX_AMOUNT} microseconds"
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


def _delta_micros(value: timedelta) -> int:
    micros = value // _MICROSECOND
    if not _MIN_AMOUNT <= micros <= _MAX_AMOUNT:
        raise OutOfRangeError(
            f"amount {value!r} is outside the supported range {_AMOUNT_RANGE}"
        )
    return micros


def _each(convert: Callable[..., _T], *columns: Iterable[Any]) -> list[_T]:
    """Apply ``convert`` to each row of ``columns``, naming the row that fails."""
    results: list[_T] = []
    try:
        for row in zip(*columns):
            results.append(convert(*row))
    except (TypeError, ValueError, OutOfRangeError) as error:
        raise type(error)(f"item {len(results)}: {error}") from None
    return results


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

    def next_period(self, dt: datetime) -> tuple[datetime, datetime]:
        """Return the working period that contains ``dt``, or the first after it.

        A period is a maximal stretch of working time, returned as
        ``(start, end)`` in the ``tzinfo`` of ``dt``. If ``dt`` is inside one,
        ``start`` is ``dt``. A period never runs longer than the search bound
        of a year plus a day per holiday date.
        """
        with _engine_errors():
            start, end = self._schedule.next_period(_micros(dt))
        return _datetime(start, dt.tzinfo), _datetime(end, dt.tzinfo)

    def previous_period(self, dt: datetime) -> tuple[datetime, datetime]:
        """Return the working period that contains ``dt``, or the last before it.

        Mirrors `next_period`: if ``dt`` is inside a period, ``end`` is ``dt``.
        """
        with _engine_errors():
            start, end = self._schedule.previous_period(_micros(dt))
        return _datetime(start, dt.tzinfo), _datetime(end, dt.tzinfo)

    @overload
    def between_many(
        self, starts: Sequence[datetime], ends: Sequence[datetime]
    ) -> list[timedelta]: ...
    @overload
    def between_many(
        self, starts: NDArray[np.datetime64], ends: NDArray[np.datetime64]
    ) -> NDArray[np.timedelta64]: ...
    def between_many(
        self,
        starts: Sequence[datetime] | NDArray[np.datetime64],
        ends: Sequence[datetime] | NDArray[np.datetime64],
    ) -> list[timedelta] | NDArray[np.timedelta64]:
        """Return `between` for each pair of ``starts`` and ``ends`` in one call.

        Accepts sequences of aware datetimes, or NumPy ``datetime64`` arrays
        read as UTC, which give a ``timedelta64[us]`` array of the same shape.
        """
        if _arrays.is_array(starts):
            shape = starts.shape
            with _engine_errors():
                micros = self._schedule.between_many(
                    _arrays.to_micros(starts, "datetime64", shape),
                    _arrays.to_micros(ends, "datetime64", shape),
                )
            return _arrays.from_micros(micros, "timedelta64", shape)
        a, b = _each(_micros, starts), _each(_micros, ends)
        with _engine_errors():
            micros = self._schedule.between_many(a, b)
        return [timedelta(microseconds=m) for m in micros]

    @overload
    def add_many(
        self, dts: Sequence[datetime], deltas: Sequence[timedelta] | timedelta
    ) -> list[datetime]: ...
    @overload
    def add_many(
        self,
        dts: NDArray[np.datetime64],
        deltas: NDArray[np.timedelta64] | timedelta,
    ) -> NDArray[np.datetime64]: ...
    def add_many(
        self,
        dts: Sequence[datetime] | NDArray[np.datetime64],
        deltas: Sequence[timedelta] | NDArray[np.timedelta64] | timedelta,
    ) -> list[datetime] | NDArray[np.datetime64]:
        """Return `add` for each datetime and amount in one call.

        ``deltas`` is one amount per datetime, or a single amount for all.
        Accepts the same inputs as `between_many`.
        """
        return self._shift_many(self._schedule.add_many, dts, deltas)

    @overload
    def sub_many(
        self, dts: Sequence[datetime], deltas: Sequence[timedelta] | timedelta
    ) -> list[datetime]: ...
    @overload
    def sub_many(
        self,
        dts: NDArray[np.datetime64],
        deltas: NDArray[np.timedelta64] | timedelta,
    ) -> NDArray[np.datetime64]: ...
    def sub_many(
        self,
        dts: Sequence[datetime] | NDArray[np.datetime64],
        deltas: Sequence[timedelta] | NDArray[np.timedelta64] | timedelta,
    ) -> list[datetime] | NDArray[np.datetime64]:
        """Return `sub` for each datetime and amount in one call.

        ``deltas`` is one amount per datetime, or a single amount for all.
        Accepts the same inputs as `between_many`.
        """
        return self._shift_many(self._schedule.sub_many, dts, deltas)

    def _shift_many(
        self,
        shift: Callable[[list[int], list[int]], list[int]],
        dts: Sequence[datetime] | NDArray[np.datetime64],
        deltas: Sequence[timedelta] | NDArray[np.timedelta64] | timedelta,
    ) -> list[datetime] | NDArray[np.datetime64]:
        if _arrays.is_array(dts):
            shape = dts.shape
            with _engine_errors():
                micros = shift(
                    _arrays.to_micros(dts, "datetime64", shape),
                    _arrays.to_micros(deltas, "timedelta64", shape),
                )
            return _arrays.from_micros(micros, "datetime64", shape)
        dts = list(dts)
        if isinstance(deltas, timedelta):
            deltas = [deltas] * len(dts)
        amounts = _each(_delta_micros, deltas)
        with _engine_errors():
            micros = shift(_each(_micros, dts), amounts)
        return _each(_datetime, micros, [t.tzinfo for t in dts])


def _amount(
    delta: timedelta | None, hours: float, minutes: float, seconds: float
) -> int:
    keywords = {"hours": hours, "minutes": minutes, "seconds": seconds}
    for name, value in keywords.items():
        if isinstance(value, float) and math.isnan(value):
            raise ValueError(f"amount {name}={value!r} is not a number")
    try:
        total = timedelta(**keywords)
        if delta is not None:
            total += delta
    except OverflowError:
        given = [] if delta is None else [repr(delta)]
        given += [f"{name}={value!r}" for name, value in keywords.items() if value]
        raise OutOfRangeError(
            f"amount {' + '.join(given)} is outside the supported range {_AMOUNT_RANGE}"
        ) from None
    return _delta_micros(total)
