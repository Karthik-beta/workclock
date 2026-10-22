# Ported from businesstimedelta 1.0.1, test/rules/rules_tests.py.
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
def rules(btd: ModuleType) -> Any:
    workdayrule = btd.WorkDayRule(
        start_time=datetime.time(9),
        end_time=datetime.time(17),
        working_days=[0, 1, 2, 3, 4],
        tz=UTC,
    )
    lunchbreak = btd.LunchTimeRule(
        start_time=datetime.time(12),
        end_time=datetime.time(13),
        working_days=[0, 1, 2, 3, 4],
        tz=UTC,
    )
    return btd.Rules([workdayrule, lunchbreak])


def test_next_during_lunch_break(rules: Any) -> None:
    dt = utc(2016, 1, 25, 12, 30, 0)
    assert rules.next(dt) == (utc(2016, 1, 25, 13, 0, 0), utc(2016, 1, 25, 17, 0, 0))


def test_next_before_lunch_break(rules: Any) -> None:
    dt = utc(2016, 1, 25, 12, 0, 0)
    assert rules.next(dt) == (utc(2016, 1, 25, 13, 0, 0), utc(2016, 1, 25, 17, 0, 0))


def test_previous_during_lunch_break(rules: Any) -> None:
    dt = utc(2016, 1, 25, 12, 30, 0)
    assert rules.previous(dt) == (utc(2016, 1, 25, 9, 0, 0), utc(2016, 1, 25, 12, 0, 0))


def test_previous_at_end_of_lunch_break(rules: Any) -> None:
    dt = utc(2016, 1, 25, 13, 0, 0)
    assert rules.previous(dt) == (utc(2016, 1, 25, 9, 0, 0), utc(2016, 1, 25, 12, 0, 0))


def test_previous_after_lunch_break(rules: Any) -> None:
    dt = utc(2016, 1, 25, 13, 30, 0)
    assert rules.previous(dt) == (
        utc(2016, 1, 25, 13, 0, 0),
        utc(2016, 1, 25, 13, 30, 0),
    )
