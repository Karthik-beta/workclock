"""Drop-in replacement for businesstimedelta 1.0.1.

``import workclock.compat as businesstimedelta`` keeps code written for
businesstimedelta working, on workclock's engine. The classes take the same
arguments and defaults and support the same operators. Every intentional
difference is listed in MIGRATING.md.

>>> import datetime
>>> import workclock.compat as businesstimedelta
>>> rule = businesstimedelta.WorkDayRule(datetime.time(9), datetime.time(17))
>>> friday = datetime.datetime(2026, 1, 9, 16)
>>> print(friday + businesstimedelta.BusinessTimeDelta(rule, hours=2))
2026-01-12 10:00:00+00:00
>>> rule.difference(friday, datetime.datetime(2026, 1, 12, 10)).hours
2

Rules are checked when they are used rather than when they are created, so
any method that computes with a rule raises `TypeError` or `ValueError` for
invalid attributes, such as a ``working_days`` entry outside 0 to 6, and
`TypeError` for rule types that compat does not run.
"""

from __future__ import annotations

import bisect
import datetime as _dt
from collections.abc import Collection, Iterable
from typing import Union, overload

from workclock import _workclock
from workclock._errors import NoWorkingTimeError
from workclock._schedule import (
    Break,
    Holidays,
    Schedule,
    WorkDay,
    _datetime,
    _engine_errors,
    _micros,
)
from workclock._zones import zone_name

__all__ = [
    "BusinessTimeDelta",
    "HolidayRule",
    "LunchTimeRule",
    "Rule",
    "Rules",
    "WorkDayRule",
    "localize_unlocalized_dt",
]

_UTC = _dt.timezone.utc
_ZERO = _dt.timedelta(0)
# python-holidays objects fill in years on demand; these are filled in up front.
_HOLIDAY_YEARS = range(1970, 2101)

Zone = Union[str, _dt.tzinfo]
Period = tuple[_dt.datetime, _dt.datetime]


def localize_unlocalized_dt(dt: _dt.datetime) -> _dt.datetime:
    """Return ``dt`` unchanged if it is aware, and as UTC if it is naive."""
    if dt.tzinfo is not None and dt.tzinfo.utcoffset(dt) is not None:
        return dt
    return dt.replace(tzinfo=_UTC)


class Rule:
    """Base class for rules: blocks of either working time or time off."""

    def __init__(self, tz: Zone = _UTC, time_off: bool = False) -> None:
        """Set the rule's time zone and whether it is time off."""
        self.tz = tz
        self.time_off = time_off

    def next(self, dt: _dt.datetime) -> Period:
        """Return the block that contains ``dt``, or the first one after it.

        A naive ``dt`` is UTC. Raises `NoWorkingTimeError` if no block starts
        within 366 days plus seven per holiday date, and `OutOfRangeError` if
        ``dt`` or the block is outside the supported range.
        """
        return self._schedule().next_period(localize_unlocalized_dt(dt))

    def previous(self, dt: _dt.datetime) -> Period:
        """Return the block that contains ``dt``, or the last one before it.

        Raises the same errors as `next`.
        """
        return self._schedule().previous_period(localize_unlocalized_dt(dt))

    def difference(self, dt1: _dt.datetime, dt2: _dt.datetime) -> BusinessTimeDelta:
        """Return the business time between two datetimes, in either order.

        Naive datetimes are UTC. Raises `OutOfRangeError` if either is outside
        the supported range.
        """
        start, end = sorted(
            [localize_unlocalized_dt(dt1), localize_unlocalized_dt(dt2)]
        )
        try:
            result = self._schedule().between(start, end)
        except NoWorkingTimeError:
            result = _ZERO
        return BusinessTimeDelta(self, hours=result.days * 24, seconds=result.seconds)

    def _schedule(self) -> Schedule:
        """Return an engine schedule of this rule's blocks."""
        raise TypeError(
            f"{type(self).__name__} is not supported by workclock.compat, which "
            "runs WorkDayRule, LunchTimeRule, HolidayRule and Rules on its engine"
        )

    def _add(self, dt: _dt.datetime, td: _dt.timedelta) -> _dt.datetime:
        if td == _ZERO:
            return self.next(dt)[0]
        return self._schedule().add(dt, td)

    def _sub(self, dt: _dt.datetime, td: _dt.timedelta) -> _dt.datetime:
        if td == _ZERO:
            return self.previous(dt)[1]
        return self._schedule().sub(dt, td)


class WorkDayRule(Rule):
    """Working hours on some days of the week.

    ``end_time`` before ``start_time`` is an overnight shift. Equal times make
    an empty rule, as in businesstimedelta.
    """

    def __init__(
        self,
        start_time: _dt.time = _dt.time(9),
        end_time: _dt.time = _dt.time(18),
        working_days: Collection[int] | None = None,
        tz: Zone = _UTC,
        time_off: bool = False,
    ) -> None:
        """Create a rule; ``working_days`` defaults to Monday to Friday."""
        super().__init__(tz, time_off)
        self.start_time = start_time
        self.end_time = end_time
        self.working_days: Collection[int] = (
            [0, 1, 2, 3, 4] if working_days is None else working_days
        )

    def _engine_rule(self, kind: type[WorkDay | Break]) -> list[WorkDay | Break]:
        if self.start_time == self.end_time:
            return []
        # The typed API rejects bool days; businesstimedelta reads True as 1.
        days = [int(day) if isinstance(day, bool) else day for day in self.working_days]
        rule = kind(self.start_time, self.end_time, days, time_zone=self.tz)
        return [rule]

    def _schedule(self) -> Schedule:
        return Schedule(self._engine_rule(WorkDay))


class LunchTimeRule(WorkDayRule):
    """Time off on some days of the week, by default 12:00 to 13:00."""

    def __init__(
        self,
        start_time: _dt.time = _dt.time(12),
        end_time: _dt.time = _dt.time(13),
        working_days: Collection[int] | None = None,
        tz: Zone = _UTC,
    ) -> None:
        """Create a break; ``working_days`` defaults to Monday to Friday."""
        super().__init__(start_time, end_time, working_days, tz, time_off=True)


class HolidayRule(Rule):
    """Dates that are not worked: a list of dates or a python-holidays object.

    The dates are read once. A python-holidays object is filled in for every
    year from 1970 to 2100 first; later or earlier dates are not holidays.
    """

    def __init__(
        self,
        holidays: Iterable[_dt.date],
        tz: Zone = _UTC,
        time_off: bool = True,
    ) -> None:
        """Create a rule from ``holidays``; it is time off by default.

        Raises `TypeError` if ``holidays`` holds anything but
        ``datetime.date`` objects.
        """
        self.holidays = holidays
        super().__init__(tz, time_off)
        self._dates = sorted(_holiday_dates(holidays))

    def __repr__(self) -> str:
        """Return the rule as businesstimedelta shows it."""
        return f"<HolidayRule: {self.holidays}>"

    def next(self, dt: _dt.datetime) -> Period:
        """Return the holiday that contains ``dt``, or the first one after it.

        Raises `NoWorkingTimeError` if there is no holiday after ``dt``.
        """
        dt = localize_unlocalized_dt(dt)
        t = _micros(dt)
        # One date of slack: bounds are midnights resolved in the rule's zone,
        # which around a DST change need not line up with the local date of
        # ``t``. The loop checks each holiday's bounds, so slack is harmless.
        first = max(bisect.bisect_left(self._dates, self._local_date(t)) - 1, 0)
        for day in self._dates[first:]:
            start, end = self._bounds(day)
            if end > t:
                return _datetime(max(start, t), dt.tzinfo), _datetime(end, dt.tzinfo)
        raise NoWorkingTimeError(f"no holiday after {dt}")

    def previous(self, dt: _dt.datetime) -> Period:
        """Return the holiday that contains ``dt``, or the last one before it.

        Raises `NoWorkingTimeError` if there is no holiday before ``dt``.
        """
        dt = localize_unlocalized_dt(dt)
        t = _micros(dt)
        # One date of slack, as in next().
        last = bisect.bisect_right(self._dates, self._local_date(t)) + 1
        for day in reversed(self._dates[:last]):
            start, end = self._bounds(day)
            if start < t:
                return _datetime(start, dt.tzinfo), _datetime(min(end, t), dt.tzinfo)
        raise NoWorkingTimeError(f"no holiday before {dt}")

    def difference(self, dt1: _dt.datetime, dt2: _dt.datetime) -> BusinessTimeDelta:
        """Return the holiday time between two datetimes, in either order.

        Raises `OutOfRangeError` if either datetime is outside the supported
        range.
        """
        a, b = sorted(
            [
                _micros(localize_unlocalized_dt(dt1)),
                _micros(localize_unlocalized_dt(dt2)),
            ]
        )
        # One date of slack on each side, as in next().
        low = bisect.bisect_left(
            self._dates, self._local_date(a) - _dt.timedelta(days=1)
        )
        high = bisect.bisect_right(
            self._dates, self._local_date(b) + _dt.timedelta(days=1)
        )
        total = 0
        for day in self._dates[low:high]:
            start, end = self._bounds(day)
            total += max(0, min(end, b) - max(start, a))
        result = _dt.timedelta(microseconds=total)
        return BusinessTimeDelta(self, hours=result.days * 24, seconds=result.seconds)

    def _add(self, dt: _dt.datetime, td: _dt.timedelta) -> _dt.datetime:
        if td == _ZERO:
            return self.next(dt)[0]
        dt = localize_unlocalized_dt(dt)
        left = td
        x = dt
        while True:
            start, end = self.next(x)
            length = end.astimezone(_UTC) - start.astimezone(_UTC)
            if length >= left:
                return (start.astimezone(_UTC) + left).astimezone(dt.tzinfo)
            left -= length
            x = end

    def _sub(self, dt: _dt.datetime, td: _dt.timedelta) -> _dt.datetime:
        if td == _ZERO:
            return self.previous(dt)[1]
        dt = localize_unlocalized_dt(dt)
        left = td
        x = dt
        while True:
            start, end = self.previous(x)
            length = end.astimezone(_UTC) - start.astimezone(_UTC)
            if length >= left:
                return (end.astimezone(_UTC) - left).astimezone(dt.tzinfo)
            left -= length
            x = start

    def _engine_rule(self) -> Holidays:
        return Holidays(self._dates, time_zone=self.tz)

    def _local_date(self, t: int) -> _dt.date:
        with _engine_errors():
            return _dt.date(*_workclock.local_date(zone_name(self.tz), t))

    def _bounds(self, day: _dt.date) -> tuple[int, int]:
        with _engine_errors():
            return _workclock.day_bounds(
                zone_name(self.tz), (day.year, day.month, day.day)
            )


class Rules(Rule):
    """Combines rules: working time minus time off."""

    def __init__(
        self, rules: Iterable[Rule], tz: Zone = _UTC, time_off: bool = False
    ) -> None:
        """Split ``rules`` into available rules and time off."""
        rules = list(rules)
        self.available_rules = [x for x in rules if not x.time_off]
        self.unavailable_rules = [x for x in rules if x.time_off]
        super().__init__(tz, time_off)

    def _schedule(self) -> Schedule:
        engine_rules: list[WorkDay | Break | Holidays] = []
        for rule in self.available_rules:
            if not isinstance(rule, WorkDayRule):
                raise _unsupported(rule, "working time")
            engine_rules += rule._engine_rule(WorkDay)
        for rule in self.unavailable_rules:
            if isinstance(rule, WorkDayRule):
                engine_rules += rule._engine_rule(Break)
            elif isinstance(rule, HolidayRule):
                engine_rules.append(rule._engine_rule())
            else:
                raise _unsupported(rule, "time off")
        return Schedule(engine_rules)


class BusinessTimeDelta:
    """An amount of business time under a rule.

    Add it to or subtract it from a datetime to move by that much business
    time. Adding zero moves to the start of the next block of working time,
    and subtracting zero to the end of the previous one, as in
    businesstimedelta.
    """

    def __init__(
        self,
        rule: Rule,
        hours: float = 0,
        seconds: float = 0,
        timedelta: _dt.timedelta | None = None,
    ) -> None:
        """Create a delta from ``timedelta``, or from ``hours`` and ``seconds``."""
        self.rule = rule
        if timedelta:
            self.timedelta = timedelta
        else:
            self.timedelta = _dt.timedelta(seconds=seconds, hours=hours)

    def __repr__(self) -> str:
        """Return the delta as businesstimedelta shows it."""
        return f"<BusinessTimeDelta {self.hours} hours {self.seconds} seconds>"

    def __eq__(self, other: object) -> bool:
        """Compare the amounts of two deltas."""
        if not isinstance(other, BusinessTimeDelta):
            return NotImplemented
        return self.timedelta == other.timedelta

    @overload
    def __add__(self, other: BusinessTimeDelta) -> BusinessTimeDelta: ...
    @overload
    def __add__(self, other: _dt.datetime) -> _dt.datetime: ...
    def __add__(self, other: object) -> BusinessTimeDelta | _dt.datetime:
        """Add another delta under the same rule, or move a datetime forward.

        Raises `NotImplementedError` for anything else, as businesstimedelta
        does, and the errors of `Rule.next` when moving a datetime.
        """
        if isinstance(other, BusinessTimeDelta) and other.rule == self.rule:
            return BusinessTimeDelta(
                self.rule, timedelta=self.timedelta + other.timedelta
            )
        if isinstance(other, _dt.datetime):
            dt = localize_unlocalized_dt(other)
            if self.timedelta < _ZERO:
                return self.rule._sub(dt, -self.timedelta)
            return self.rule._add(dt, self.timedelta)
        raise NotImplementedError

    @overload
    def __radd__(self, other: BusinessTimeDelta) -> BusinessTimeDelta: ...
    @overload
    def __radd__(self, other: _dt.datetime) -> _dt.datetime: ...
    def __radd__(self, other: object) -> BusinessTimeDelta | _dt.datetime:
        """Move a datetime forward by this delta.

        Raises the same errors as `__add__`.
        """
        if isinstance(other, (BusinessTimeDelta, _dt.datetime)):
            return self.__add__(other)
        raise NotImplementedError

    @overload
    def __sub__(self, other: BusinessTimeDelta) -> BusinessTimeDelta: ...
    @overload
    def __sub__(self, other: _dt.datetime) -> _dt.datetime: ...
    def __sub__(self, other: object) -> BusinessTimeDelta | _dt.datetime:
        """Subtract another delta under the same rule, or move a datetime back.

        Returns ``NotImplemented`` for anything else, so Python raises
        `TypeError`, and raises the errors of `Rule.previous` when moving a
        datetime.
        """
        if isinstance(other, BusinessTimeDelta) and other.rule == self.rule:
            return BusinessTimeDelta(
                self.rule, timedelta=self.timedelta - other.timedelta
            )
        if isinstance(other, _dt.datetime):
            dt = localize_unlocalized_dt(other)
            if self.timedelta < _ZERO:
                return self.rule._add(dt, -self.timedelta)
            return self.rule._sub(dt, self.timedelta)
        return NotImplemented

    @overload
    def __rsub__(self, other: BusinessTimeDelta) -> BusinessTimeDelta: ...
    @overload
    def __rsub__(self, other: _dt.datetime) -> _dt.datetime: ...
    def __rsub__(self, other: object) -> BusinessTimeDelta | _dt.datetime:
        """Move a datetime back by this delta.

        Raises the same errors as `__sub__`.
        """
        if isinstance(other, (BusinessTimeDelta, _dt.datetime)):
            return self.__sub__(other)
        return NotImplemented

    @property
    def hours(self) -> int:
        """Whole hours in the delta."""
        return int(self.timedelta.total_seconds() // (60 * 60))

    @property
    def seconds(self) -> int:
        """Seconds in the delta beyond its whole hours."""
        return int(self.timedelta.total_seconds() % (60 * 60))


def _holiday_dates(holidays: Iterable[_dt.date]) -> set[_dt.date]:
    if isinstance(holidays, dict) and hasattr(holidays, "years"):
        for year in _HOLIDAY_YEARS:
            holidays.get(_dt.date(year, 1, 1))
    dates = set()
    for day in holidays:
        if isinstance(day, _dt.datetime) or not isinstance(day, _dt.date):
            raise TypeError(f"holidays must be datetime.date objects, got {day!r}")
        dates.add(day)
    return dates


def _unsupported(rule: Rule, role: str) -> TypeError:
    return TypeError(
        f"{type(rule).__name__} cannot be used as {role} in Rules under "
        "workclock.compat; see MIGRATING.md"
    )
