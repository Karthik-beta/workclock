# Ported from businesstimedelta 1.0.1, test/rules/rule_tests.py.
# Copyright (c) 2015 Sebastiaan Boer, MIT License; see NOTICE.

import datetime
from types import ModuleType
from typing import Any

import pytest
import pytz

UTC = pytz.utc


@pytest.fixture
def workdayrule(btd: ModuleType) -> Any:
    return btd.WorkDayRule(
        start_time=datetime.time(9),
        end_time=datetime.time(17),
        working_days=[0, 1, 2, 3, 4],
        tz=UTC,
    )


def test_difference_less_than_one_period(btd: ModuleType, workdayrule: Any) -> None:
    start_dt = UTC.localize(datetime.datetime(2016, 1, 21, 10, 0, 0))
    end_dt = UTC.localize(datetime.datetime(2016, 1, 21, 10, 0, 5))
    assert workdayrule.difference(start_dt, end_dt) == btd.BusinessTimeDelta(
        workdayrule, seconds=5
    )


def test_difference_more_than_one_period(btd: ModuleType, workdayrule: Any) -> None:
    start_dt = UTC.localize(datetime.datetime(2016, 1, 20, 10, 0, 0))
    end_dt = UTC.localize(datetime.datetime(2016, 1, 21, 10, 0, 5))
    assert workdayrule.difference(start_dt, end_dt) == btd.BusinessTimeDelta(
        workdayrule, hours=8, seconds=5
    )


def test_difference_several_days_period(btd: ModuleType, workdayrule: Any) -> None:
    start_dt = UTC.localize(datetime.datetime(2016, 1, 18, 2, 0, 0))
    end_dt = UTC.localize(datetime.datetime(2016, 1, 24, 0, 0, 0))
    assert workdayrule.difference(start_dt, end_dt) == btd.BusinessTimeDelta(
        workdayrule, hours=8 * 5
    )


def test_no_workday_hours(btd: ModuleType) -> None:
    workdayrule = btd.WorkDayRule(
        start_time=datetime.time(9),
        end_time=datetime.time(9),
        working_days=[0, 1, 2, 3, 4],
    )
    start_dt = datetime.datetime(2016, 1, 21, 10, 0, 0)
    end_dt = datetime.datetime(2016, 1, 21, 10, 0, 5)
    assert workdayrule.difference(start_dt, end_dt) == btd.BusinessTimeDelta(
        workdayrule, seconds=0, hours=0
    )


def test_difference_overnight(btd: ModuleType) -> None:
    workdayrule = btd.WorkDayRule(
        start_time=datetime.time(23),
        end_time=datetime.time(1),
        working_days=[0, 1, 2, 3, 4],
        tz=UTC,
    )
    start_dt = UTC.localize(datetime.datetime(2016, 1, 21, 10, 0, 0))
    end_dt = UTC.localize(datetime.datetime(2016, 1, 22, 10, 0, 0))
    assert btd.BusinessTimeDelta(workdayrule, hours=2) == workdayrule.difference(
        start_dt, end_dt
    )
