"""Overnight shifts in businesstimedelta 1.0.1 (DESIGN.md O1 to O3).

`WorkDayRule.next()` skips a shift that is already in progress, and
`previous()` never moves the end of an overnight shift to the next day.
"""

import datetime
from types import ModuleType
from typing import Any

import pytest

UTC = datetime.timezone.utc


def utc(day: int, hour: int) -> datetime.datetime:
    return datetime.datetime(2026, 1, day, hour, tzinfo=UTC)


@pytest.fixture
def night_shift(btd: ModuleType) -> Any:
    return btd.WorkDayRule(
        start_time=datetime.time(22),
        end_time=datetime.time(6),
        working_days=[0, 1, 2, 3, 4],
    )


@pytest.mark.upstream_bug(raises=AssertionError, reason="returns 0h")
def test_difference_counts_the_whole_shift(night_shift: Any) -> None:
    diff = night_shift.difference(utc(5, 22), utc(6, 6))
    assert (diff.hours, diff.seconds) == (8, 0)


@pytest.mark.upstream_bug(raises=AssertionError, reason="returns Wed 02:00")
def test_add_stays_in_the_shift_in_progress(btd: ModuleType, night_shift: Any) -> None:
    assert utc(5, 22) + btd.BusinessTimeDelta(night_shift, hours=4) == utc(6, 2)


@pytest.mark.upstream_bug(raises=OverflowError, reason="previous() inverts the shift")
def test_sub_stays_in_the_shift_in_progress(btd: ModuleType, night_shift: Any) -> None:
    assert utc(6, 6) - btd.BusinessTimeDelta(night_shift, hours=4) == utc(6, 2)
