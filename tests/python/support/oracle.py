"""Brute-force reference implementation of DESIGN.md.

It decides for every minute separately whether that minute is working time,
and never builds or merges intervals. That makes it slow but easy to check
against the spec by reading. Every instant, duration and rule time it is given
must be a whole number of minutes.
"""

from datetime import date, datetime, time, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from support.fixture import RuleSpec, ScheduleSpec

ErrorKind = Literal["no_working_time", "out_of_range", "unknown_zone"]
Block = tuple[datetime, datetime]

ZERO = timedelta(0)
MINUTE = timedelta(minutes=1)
DAY = timedelta(days=1)
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
# The engine's range ends at jiff's last instant. Python's starts much later
# than jiff's, and a day's margin keeps every local date representable.
FIRST = datetime(1, 1, 2, tzinfo=timezone.utc)
LAST = datetime(9999, 12, 30, 22, tzinfo=timezone.utc)
PY_MIN = datetime.min.replace(tzinfo=timezone.utc)
PY_MAX = datetime.max.replace(tzinfo=timezone.utc)


class OracleError(Exception):
    def __init__(self, kind: ErrorKind) -> None:
        super().__init__(kind)
        self.kind: ErrorKind = kind


class Oracle:
    def __init__(
        self,
        workdays: list["Rule"],
        breaks: list["Rule"],
        holidays: list["Holidays"],
    ) -> None:
        self.workdays = workdays
        self.breaks = breaks
        self.holidays = holidays
        holiday_dates = sum(len(h.dates) for h in holidays)
        self.search_limit = timedelta(days=366 + 7 * holiday_dates)

    @classmethod
    def build(cls, spec: ScheduleSpec) -> "Oracle":
        def rule(r: RuleSpec) -> Rule:
            return Rule(r, zone(spec.zone if r.zone is None else r.zone))

        zone(spec.zone)
        oracle = cls(
            [rule(r) for r in spec.workdays],
            [rule(r) for r in spec.breaks],
            [
                Holidays(h.all_dates(), zone(spec.zone if h.zone is None else h.zone))
                for h in spec.holidays
            ],
        )

        window_start = datetime(2001, 1, 1, tzinfo=timezone.utc)
        m = window_start
        while m < window_start + 14 * DAY:
            if oracle._available(m) and not oracle._on_break(m):
                return oracle
            m += MINUTE
        raise OracleError("no_working_time")

    def is_working(self, t: datetime) -> bool:
        """Whether the minute starting at `t` is working time."""
        return (
            self._available(t)
            and not self._on_break(t)
            and not any(h.contains(t) for h in self.holidays)
        )

    def between(self, a: datetime, b: datetime) -> timedelta:
        if b < a:
            return -self.between(b, a)
        total = ZERO
        m = a.astimezone(timezone.utc)
        while m < b:
            if self.is_working(m):
                total += MINUTE
            m += MINUTE
        return total

    def add(self, t: datetime, d: timedelta) -> datetime:
        if d < ZERO:
            return self.sub(t, -d)
        left = d
        idle = ZERO
        x = t.astimezone(timezone.utc)
        while left > ZERO:
            next_ = step(x, MINUTE)
            if self.is_working(x):
                left -= MINUTE
                idle = ZERO
            else:
                idle += MINUTE
                if idle > self.search_limit:
                    raise OracleError("no_working_time")
            x = next_
        return x

    def sub(self, t: datetime, d: timedelta) -> datetime:
        if d < ZERO:
            return self.add(t, -d)
        left = d
        idle = ZERO
        x = t.astimezone(timezone.utc)
        while left > ZERO:
            prev = step(x, -MINUTE)
            if self.is_working(prev):
                left -= MINUTE
                idle = ZERO
            else:
                idle += MINUTE
                if idle > self.search_limit:
                    raise OracleError("no_working_time")
            x = prev
        return x

    def next_period(self, t: datetime) -> Block:
        t = t.astimezone(timezone.utc)
        start = t
        while not self.is_working(start):
            start = step(start, MINUTE)
            if start - t > self.search_limit:
                raise OracleError("no_working_time")
        end = start
        while (
            end - start < self.search_limit
            and end + MINUTE <= LAST
            and self.is_working(end)
        ):
            end += MINUTE
        return start, end

    def previous_period(self, t: datetime) -> Block:
        t = t.astimezone(timezone.utc)
        end = t
        while not self.is_working(step(end, -MINUTE)):
            end -= MINUTE
            if t - end > self.search_limit:
                raise OracleError("no_working_time")
        start = end
        while (
            end - start < self.search_limit
            and start - MINUTE >= FIRST
            and self.is_working(start - MINUTE)
        ):
            start -= MINUTE
        return start, end

    def _available(self, t: datetime) -> bool:
        return any(r.contains(t) for r in self.workdays)

    def _on_break(self, t: datetime) -> bool:
        return any(r.contains(t) for r in self.breaks)


class Blocks:
    """Blocks of one rule, looked up by the local date of an instant.

    The blocks near each local date are resolved once and cached, because the
    oracle asks about every minute of that date.
    """

    def __init__(self, tz: ZoneInfo) -> None:
        self.tz = tz
        self._near: dict[date, list[Block]] = {}

    def contains(self, t: datetime) -> bool:
        today = t.astimezone(self.tz).date()
        blocks = self._near.get(today)
        if blocks is None:
            blocks = self._near[today] = self.blocks_near(today)
        for start, end in blocks:
            if start <= t < end:
                return True
        return False

    def blocks_near(self, today: date) -> list[Block]:
        raise NotImplementedError


class Rule(Blocks):
    """A WorkDay or a Break."""

    def __init__(self, spec: RuleSpec, tz: ZoneInfo) -> None:
        super().__init__(tz)
        self.start = time.fromisoformat(spec.start)
        self.end = time.fromisoformat(spec.end)
        self.days = {WEEKDAYS.index(d) for d in spec.days}

    def blocks_near(self, today: date) -> list[Block]:
        """A shift belongs to the date it starts on, so `t` can only fall in the
        shift of its own local date or of the day before.
        """
        overnight = self.end <= self.start
        return [
            (resolve(d, self.start, self.tz), resolve(d, self.end, self.tz, overnight))
            for d in dates_around(today, before=1, after=0)
            if d.weekday() in self.days
        ]


class Holidays(Blocks):
    def __init__(self, dates: set[date], tz: ZoneInfo) -> None:
        super().__init__(tz)
        self.dates = dates

    def blocks_near(self, today: date) -> list[Block]:
        """A holiday is `[00:00 on its date, 00:00 on the next date)`. Around DST
        transitions that block can reach into a neighbouring local date, so the
        dates either side are checked too.
        """
        return [
            (resolve(d, time(0), self.tz), resolve(d, time(0), self.tz, True))
            for d in dates_around(today, before=1, after=1)
            if d in self.dates
        ]


def zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        raise OracleError("unknown_zone") from None


def resolve(day: date, at: time, tz: ZoneInfo, next_day: bool = False) -> datetime:
    """Wall-clock time to instant with the "compatible" policy from DESIGN.md.

    With `fold=0`, zoneinfo gives a time in a gap the offset from before the
    gap, which moves it forward by the gap's length, and a repeated time its
    first occurrence. Times past either end of Python's range saturate to that
    end.
    """
    try:
        local = datetime.combine(day + (DAY if next_day else ZERO), at, tzinfo=tz)
        return local.astimezone(timezone.utc)
    except OverflowError:
        return PY_MIN if day.year == 1 else PY_MAX


def dates_around(today: date, before: int, after: int) -> list[date]:
    """`today` and its neighbours, skipping dates Python cannot represent."""
    n = today.toordinal()
    last = date.max.toordinal()
    return [
        date.fromordinal(k) for k in range(n - before, n + after + 1) if 1 <= k <= last
    ]


def step(x: datetime, by: timedelta) -> datetime:
    y = x + by
    if not FIRST <= y <= LAST:
        raise OracleError("out_of_range")
    return y
