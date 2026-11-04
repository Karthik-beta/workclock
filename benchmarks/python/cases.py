"""The schedule and inputs shared by the Python benchmarks."""

from collections.abc import Callable
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

import pytz
import workclock

LONDON = pytz.timezone("Europe/London")
HOLIDAYS = [
    date(2026, 1, 1),
    date(2026, 4, 3),
    date(2026, 4, 6),
    date(2026, 5, 4),
    date(2026, 5, 25),
    date(2026, 8, 31),
    date(2026, 12, 25),
    date(2026, 12, 28),
    date(2027, 1, 1),
    date(2027, 3, 26),
    date(2027, 3, 29),
    date(2027, 5, 3),
    date(2027, 5, 31),
    date(2027, 8, 30),
    date(2027, 12, 27),
    date(2027, 12, 28),
]
WEEKDAYS = [0, 1, 2, 3, 4]
BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)

Between = Callable[[datetime, datetime], Any]


def office() -> workclock.Schedule:
    return workclock.Schedule(
        [
            workclock.WorkDay(time(9), time(17)),
            workclock.Break(time(12), time(13)),
            workclock.Holidays(HOLIDAYS),
        ],
        time_zone="Europe/London",
    )


def rules(module: Any, holiday_dates: Any = HOLIDAYS) -> Between:  # noqa: ANN401
    days = {"working_days": WEEKDAYS, "tz": LONDON}
    difference: Between = module.Rules(
        [
            module.WorkDayRule(start_time=time(9), end_time=time(17), **days),
            module.LunchTimeRule(start_time=time(12), end_time=time(13), **days),
            module.HolidayRule(holiday_dates, tz=LONDON),
        ]
    ).difference
    return difference


def pairs(n: int) -> tuple[list[datetime], list[datetime]]:
    starts = [BASE + timedelta(minutes=i * 7919 % 525_600) for i in range(n)]
    ends = [s + timedelta(minutes=i * 104_729 % 10_080) for i, s in enumerate(starts)]
    return starts, ends
