"""Typed API: rules and schedules over timezone-aware datetimes."""

from __future__ import annotations

import math
from collections.abc import Callable, Iterable, Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field
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
# The engine's instants are jiff timestamps, in microseconds since the epoch.
_FIRST_INSTANT = -377_705_023_201_000_000
_LAST_INSTANT = 253_402_207_200_000_000
_INSTANT_RANGE = "-009999-01-02T01:59:59Z to 9999-12-30T22:00:00Z"
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
    micros = (value - _EPOCH) // _MICROSECOND
    if not _FIRST_INSTANT <= micros <= _LAST_INSTANT:
        raise OutOfRangeError(
            f"{value.isoformat()} is outside the supported range {_INSTANT_RANGE}"
        )
    return micros


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
        utc = _EPOCH + timedelta(microseconds=micros)
    except OverflowError:
        raise OutOfRangeError(
            "result is before 0001-01-01T00:00:00+00:00, outside datetime's "
            "range of years 1 to 9999"
        ) from None
    try:
        return utc.astimezone(tz)
    except OverflowError:
        raise OutOfRangeError(
            f"result {utc.isoformat()} is outside datetime's range of years "
            f"1 to 9999 in {tz}"
        ) from None


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
        if isinstance(days, str):
            raise ValueError(
                "days must be a list of integers from 0 (Monday) to 6, "
                f"not the string {days!r}"
            )
        given = tuple(days)
        unique = frozenset(given)
        bad = [day for day in given if not (isinstance(day, int) and 0 <= day <= 6)]
        if bad:
            raise ValueError(
                "days must be integers from 0 (Monday) to 6, got "
                + ", ".join(map(repr, bad))
            )
        object.__setattr__(self, "start", start)
        object.__setattr__(self, "end", end)
        object.__setattr__(self, "days", unique)
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

    Raises `TypeError` if ``start`` or ``end`` is not a ``datetime.time`` or
    ``time_zone`` has no IANA name, and `ValueError` if a time has a tzinfo
    or ``days`` is a string or holds anything but integers from 0 to 6.

    >>> from datetime import datetime, time, timezone
    >>> from workclock import Schedule, WorkDay
    >>> nights = Schedule([WorkDay(time(22), time(6), days=[0, 1, 2, 3, 4])])
    >>> monday = datetime(2026, 1, 5, 22, tzinfo=timezone.utc)
    >>> print(nights.add(monday, hours=4))
    2026-01-06 02:00:00+00:00
    """


class Break(_Hours):
    """Time off on some days of the week, such as a lunch break.

    Takes the same arguments as `WorkDay`, including overnight breaks, and
    removes its time from the working time. Raises the same errors as
    `WorkDay`.
    """


@dataclass(frozen=True, init=False)
class Holidays:
    """Dates that are not worked.

    Each date removes the time from 00:00 to the next 00:00 in ``time_zone``,
    which defaults to the schedule's. ``dates`` is read once; a
    python-holidays object contributes only the years it already holds, so
    create it with ``years=...``.

    Raises `TypeError` if ``dates`` is a string or holds anything but
    ``datetime.date`` objects, or if ``time_zone`` has no IANA name.

    >>> from datetime import date, datetime, time, timezone
    >>> from workclock import Holidays, Schedule, WorkDay
    >>> office = Schedule([WorkDay(time(9), time(17)), Holidays([date(2026, 1, 1)])])
    >>> start, end = office.next_period(datetime(2026, 1, 1, 9, tzinfo=timezone.utc))
    >>> print(start, end)
    2026-01-02 09:00:00+00:00 2026-01-02 17:00:00+00:00
    """

    dates: frozenset[date]
    time_zone: str | None
    _sorted_dates: list[tuple[int, int, int]] = field(
        init=False, repr=False, compare=False
    )

    def __init__(
        self, dates: Iterable[date], *, time_zone: str | tzinfo | None = None
    ) -> None:
        if isinstance(dates, str):
            raise TypeError(
                "dates must be a list of datetime.date objects, "
                f"not the string {dates!r}"
            )
        dates = frozenset(dates)
        for value in dates:
            if isinstance(value, datetime) or not isinstance(value, date):
                raise TypeError(
                    f"holidays must be datetime.date objects, got {value!r}"
                )
        object.__setattr__(self, "dates", dates)
        object.__setattr__(self, "time_zone", _optional_zone(time_zone))
        object.__setattr__(
            self, "_sorted_dates", [(d.year, d.month, d.day) for d in sorted(dates)]
        )

    def _spec(self) -> tuple[list[tuple[int, int, int]], str | None]:
        return (self._sorted_dates, self.time_zone)


Rule = Union[WorkDay, Break, Holidays]
"""Any rule a `Schedule` takes: a `WorkDay`, `Break` or `Holidays`."""


class Schedule:
    """Working time defined by rules, evaluated in IANA time zones.

    Working time is the union of every `WorkDay` minus every `Break` and
    `Holidays` date, so the order of rules never matters. ``time_zone`` is
    the default for rules that do not set their own, and is UTC if omitted.
    A schedule pickles and deep-copies as its rules and zone, and is built
    again from them.

    Raises `TypeError` for a rule that is not a `WorkDay`, `Break` or
    `Holidays`, or a ``time_zone`` with no IANA name, `UnknownZoneError` for
    a zone that is not in the IANA database, and `NoWorkingTimeError` if the
    working hours minus the breaks are empty.

    Every method that takes datetimes raises `TypeError` for a value that is
    not a ``datetime``, `ValueError` for a naive one, and `OutOfRangeError`
    for one outside the supported range, -009999-01-02T01:59:59Z to
    9999-12-30T22:00:00Z.

    >>> from datetime import datetime, time, timezone
    >>> from workclock import Break, Schedule, WorkDay
    >>> office = Schedule([WorkDay(time(9), time(17)), Break(time(12), time(13))])
    >>> monday = datetime(2026, 1, 5, 9, tzinfo=timezone.utc)
    >>> print(office.add(monday, hours=4))
    2026-01-05 14:00:00+00:00
    >>> print(office.between(monday, datetime(2026, 1, 6, 9, tzinfo=timezone.utc)))
    7:00:00
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

    def __reduce__(self) -> tuple[Callable[..., Schedule], tuple[Any, ...]]:
        """Pickle the schedule as its rules and zone, to be built again."""
        return _rebuild, (type(self), self._rules, self._time_zone)

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

        The result is negative when ``b`` is before ``a``. Raises `TypeError`,
        `ValueError` or `OutOfRangeError` for ``a`` or ``b`` as described on
        `Schedule`.
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

        Raises the errors described on `Schedule` for ``dt``, `TypeError` if
        ``delta`` is not a timedelta, `ValueError` if an amount is NaN,
        `NoWorkingTimeError` if the search crosses 366 days plus seven per
        holiday date without finding working time, and `OutOfRangeError` if
        the amount does not fit in 64-bit microseconds or the result is
        outside the supported range or the years 1 to 9999 of ``datetime``.
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
        has the same ``tzinfo`` as ``dt``. Raises the same errors as `add`.
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
        of 366 days plus seven per holiday date.

        Raises the errors described on `Schedule` for ``dt``,
        `NoWorkingTimeError` if no working time starts within the search
        bound, and `OutOfRangeError` if the period reaches past the supported
        range or the years 1 to 9999 of ``datetime``.
        """
        with _engine_errors():
            start, end = self._schedule.next_period(_micros(dt))
        return _datetime(start, dt.tzinfo), _datetime(end, dt.tzinfo)

    def previous_period(self, dt: datetime) -> tuple[datetime, datetime]:
        """Return the working period that contains ``dt``, or the last before it.

        Mirrors `next_period`: if ``dt`` is inside a period, ``end`` is ``dt``.
        Raises the same errors as `next_period`.
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

        Takes two sequences of aware datetimes of the same length and returns
        a list. If ``starts`` is a NumPy array, both arguments are read as
        ``datetime64`` values in UTC, ``ends`` is broadcast to the shape of
        ``starts`` (so it may be a single value), and the result is a
        ``timedelta64[us]`` array of that shape.

        Raises the errors of `between`, with ``item {i}:`` before the message,
        where ``{i}`` is the position of the failing item in the flattened
        input. Also raises `ValueError` if the sequences differ in length, if
        ``ends`` does not broadcast to the shape of ``starts``, or if an array
        holds NaT or a value with digits below a microsecond, which would
        otherwise be rounded.
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

        ``deltas`` is a sequence of timedeltas, one per datetime, or a single
        timedelta for all, and the results keep the ``tzinfo`` of each
        datetime. If ``dts`` is a NumPy array, it is read as ``datetime64``
        values in UTC, ``deltas`` is read as ``timedelta64`` and broadcast to
        the shape of ``dts``, and the result is a ``datetime64[us]`` array of
        that shape.

        Raises the errors of `add` and `between_many`, with ``item {i}:``
        before the message.
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

        Takes the same arguments and raises the same errors as `add_many`.
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


def _rebuild(
    kind: type[Schedule], rules: tuple[Rule, ...], time_zone: str | None
) -> Schedule:
    return kind(rules, time_zone=time_zone)


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
    except TypeError:
        if delta is None or isinstance(delta, timedelta):
            raise
        raise TypeError(
            f"delta must be a timedelta, got {delta!r}; pass a number of hours, "
            "minutes or seconds as hours=, minutes= or seconds="
        ) from None
    return _delta_micros(total)
