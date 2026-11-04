"""`between` for the benchmark schedule, written with the standard library only.

This is the loop a developer would write without a library: walk the local
dates from `a` to `b` and add the overlap with each working day's hours. It
knows only this one schedule, and none of its hours are near a daylight saving
change, so subtracting two London times is exact.
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from cases import HOLIDAYS, WEEKDAYS

LONDON = ZoneInfo("Europe/London")
HOURS = [(time(9), time(12)), (time(13), time(17))]
CLOSED = frozenset(HOLIDAYS)
DAY = timedelta(days=1)


def between(a: datetime, b: datetime) -> timedelta:
    if b < a:
        return -between(b, a)
    total = timedelta(0)
    day = a.astimezone(LONDON).date()
    last = b.astimezone(LONDON).date()
    while day <= last:
        if day.weekday() in WEEKDAYS and day not in CLOSED:
            for start, end in HOURS:
                s = max(a, datetime.combine(day, start, LONDON))
                e = min(b, datetime.combine(day, end, LONDON))
                if s < e:
                    total += e - s
        day += DAY
    return total
