# Ported from businesstimedelta 1.0.1, test/rules/workdayrule_tests.py.
# Copyright (c) 2015 Sebastiaan Boer, MIT License; see NOTICE.

import datetime
from types import ModuleType
from typing import Any

import pytest
import pytz

UTC = pytz.utc


def utc(
    year: int, month: int, day: int, hour: int = 0, minute: int = 0, second: int = 0
) -> datetime.datetime:
    dt: datetime.datetime = UTC.localize(
        datetime.datetime(year, month, day, hour, minute, second)
    )
    return dt


@pytest.fixture
def workdayrule(btd: ModuleType) -> Any:
    return btd.WorkDayRule(
        start_time=datetime.time(9),
        end_time=datetime.time(17),
        working_days=[0, 1, 2, 3, 4],
        tz=UTC,
    )


@pytest.fixture
def lunchtimerule(btd: ModuleType) -> Any:
    return btd.LunchTimeRule(
        start_time=datetime.time(12),
        end_time=datetime.time(13),
        working_days=[0, 1, 2, 3, 4],
        tz=UTC,
    )


def test_next_during_weekend(workdayrule: Any) -> None:
    dt = utc(2016, 1, 23, 13, 14, 0)
    assert workdayrule.next(dt) == (
        utc(2016, 1, 25, 9, 0, 0),
        utc(2016, 1, 25, 17, 0, 0),
    )


def test_next_during_working_day(workdayrule: Any) -> None:
    dt = utc(2016, 1, 25, 10, 0, 0)
    assert workdayrule.next(dt) == (dt, utc(2016, 1, 25, 17, 0, 0))


def test_next_before_working_day(workdayrule: Any) -> None:
    dt = utc(2016, 1, 25, 3, 0, 0)
    assert workdayrule.next(dt) == (
        utc(2016, 1, 25, 9, 0, 0),
        utc(2016, 1, 25, 17, 0, 0),
    )


def test_previous_during_working_day(workdayrule: Any) -> None:
    dt = utc(2016, 1, 25, 10, 0, 0)
    assert workdayrule.previous(dt) == (utc(2016, 1, 25, 9, 0, 0), dt)


def test_previous_during_weekend(workdayrule: Any) -> None:
    dt = utc(2016, 1, 23, 13, 14, 0)
    assert workdayrule.previous(dt) == (
        utc(2016, 1, 22, 9, 0, 0),
        utc(2016, 1, 22, 17, 0, 0),
    )


def test_previous_at_working_day_start(workdayrule: Any) -> None:
    dt = utc(2016, 1, 25, 9, 0, 0)
    assert workdayrule.previous(dt) == (
        utc(2016, 1, 22, 9, 0, 0),
        utc(2016, 1, 22, 17, 0, 0),
    )


def test_previous_at_working_day_end(workdayrule: Any) -> None:
    dt = utc(2016, 1, 25, 17, 0, 0)
    assert workdayrule.previous(dt) == (
        utc(2016, 1, 25, 9, 0, 0),
        utc(2016, 1, 25, 17, 0, 0),
    )


def test_previous_after_working_day_end(workdayrule: Any) -> None:
    dt = utc(2016, 1, 25, 18, 0, 0)
    assert workdayrule.previous(dt) == (
        utc(2016, 1, 25, 9, 0, 0),
        utc(2016, 1, 25, 17, 0, 0),
    )


def test_next_during_lunch_time(lunchtimerule: Any) -> None:
    dt = utc(2016, 1, 25, 12, 30, 0)
    assert lunchtimerule.next(dt) == (dt, utc(2016, 1, 25, 13, 0, 0))


def test_lunch_time_off(lunchtimerule: Any) -> None:
    assert lunchtimerule.time_off is True
