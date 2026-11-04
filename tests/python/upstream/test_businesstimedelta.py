# Ported from businesstimedelta 1.0.1, test/businesstimedelta_tests.py.
# Copyright (c) 2015 Sebastiaan Boer, MIT License; see NOTICE.

import datetime
from types import ModuleType
from typing import Any

import holidays as pyholidays
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


def test_add_less_than_one_period(btd: ModuleType, workdayrule: Any) -> None:
    td = btd.BusinessTimeDelta(workdayrule, hours=2)
    dt = UTC.localize(datetime.datetime(2016, 1, 23, 13, 14, 0))
    assert dt + td == UTC.localize(datetime.datetime(2016, 1, 25, 11, 0, 0))


def test_add_exactly_one_period(btd: ModuleType, workdayrule: Any) -> None:
    td = btd.BusinessTimeDelta(workdayrule, hours=8)
    dt = UTC.localize(datetime.datetime(2016, 1, 22, 9, 0, 0))
    assert dt + td == UTC.localize(datetime.datetime(2016, 1, 22, 17, 0, 0))


def test_add_more_than_one_period(btd: ModuleType, workdayrule: Any) -> None:
    td = btd.BusinessTimeDelta(workdayrule, hours=12)
    dt = UTC.localize(datetime.datetime(2016, 1, 23, 13, 14, 0))
    assert dt + td == UTC.localize(datetime.datetime(2016, 1, 26, 13, 0, 0))


def test_subtract_less_than_one_period(btd: ModuleType, workdayrule: Any) -> None:
    td = btd.BusinessTimeDelta(workdayrule, hours=2)
    dt = UTC.localize(datetime.datetime(2016, 1, 25, 11, 14, 0))
    assert dt - td == UTC.localize(datetime.datetime(2016, 1, 25, 9, 14, 0))


def test_subtract_exactly_one_period(btd: ModuleType, workdayrule: Any) -> None:
    td = btd.BusinessTimeDelta(workdayrule, hours=8)
    dt = UTC.localize(datetime.datetime(2016, 1, 22, 18, 0, 0))
    assert dt - td == UTC.localize(datetime.datetime(2016, 1, 22, 9, 0, 0))


def test_subtract_more_than_one_period(btd: ModuleType, workdayrule: Any) -> None:
    td = btd.BusinessTimeDelta(workdayrule, hours=8)
    dt = UTC.localize(datetime.datetime(2016, 1, 25, 11, 14, 0))
    assert dt - td == UTC.localize(datetime.datetime(2016, 1, 22, 11, 14, 0))


def test_negation(btd: ModuleType, workdayrule: Any) -> None:
    td = btd.BusinessTimeDelta(workdayrule, hours=120)
    dt = UTC.localize(datetime.datetime(2016, 1, 25, 11, 14, 0))
    assert dt == dt + td - td


def test_hours_and_seconds_property(btd: ModuleType, workdayrule: Any) -> None:
    orig_td = datetime.timedelta(seconds=(3600 * 2) + 1)
    td = btd.BusinessTimeDelta(workdayrule, timedelta=orig_td)
    assert td.hours == 2
    assert td.seconds == 1


def test_large_hours_and_seconds_property(btd: ModuleType, workdayrule: Any) -> None:
    orig_td = datetime.timedelta(seconds=(3600 * 365) + 1)
    td = btd.BusinessTimeDelta(workdayrule, timedelta=orig_td)
    assert td.hours == 365
    assert td.seconds == 1


def test_small_hours_and_seconds_property(btd: ModuleType, workdayrule: Any) -> None:
    orig_td = datetime.timedelta(seconds=1)
    td = btd.BusinessTimeDelta(workdayrule, timedelta=orig_td)
    assert td.hours == 0
    assert td.seconds == 1


def test_addition(btd: ModuleType, workdayrule: Any) -> None:
    td = btd.BusinessTimeDelta(workdayrule, hours=2)
    td2 = btd.BusinessTimeDelta(workdayrule, hours=3)
    assert td + td2 == btd.BusinessTimeDelta(workdayrule, hours=5)


def test_subtraction(btd: ModuleType, workdayrule: Any) -> None:
    td = btd.BusinessTimeDelta(workdayrule, hours=3)
    td2 = btd.BusinessTimeDelta(workdayrule, hours=1)
    assert td - td2 == btd.BusinessTimeDelta(workdayrule, hours=2)


def test_readme(btd: ModuleType) -> None:
    workday = btd.WorkDayRule(
        start_time=datetime.time(9),
        end_time=datetime.time(18),
        working_days=[0, 1, 2, 3, 4],
        tz=pytz.utc,
    )
    lunchbreak = btd.LunchTimeRule(
        start_time=datetime.time(12),
        end_time=datetime.time(13),
        working_days=[0, 1, 2, 3, 4],
    )
    businesshrs = btd.Rules([workday, lunchbreak])

    start = datetime.datetime(2016, 1, 18, 9, 0, 0)
    end = datetime.datetime(2016, 1, 25, 9, 0, 0)

    bdiff = businesshrs.difference(start, end)
    assert bdiff.hours == 40
    assert bdiff.seconds == 0

    assert str(start + btd.BusinessTimeDelta(businesshrs, hours=40)) == (
        "2016-01-22 18:00:00+00:00"
    )
    assert str(end - btd.BusinessTimeDelta(businesshrs, hours=40)) == (
        "2016-01-18 09:00:00+00:00"
    )

    # Upstream wrote `pyholidays.US(state="CA")`; current python-holidays
    # spells the same calendar this way.
    ca_holidays = pyholidays.country_holidays("US", subdiv="CA")
    holidays = btd.HolidayRule(ca_holidays)
    businesshrs = btd.Rules([workday, lunchbreak, holidays])

    start = datetime.datetime(2015, 12, 21, 9, 0, 0)
    end = datetime.datetime(2015, 12, 28, 9, 0, 0)
    bdiff = businesshrs.difference(start, end)
    assert bdiff.hours == 32
    assert bdiff.seconds == 0


def test_readme_localized(btd: ModuleType) -> None:
    santiago_workday = btd.WorkDayRule(
        start_time=datetime.time(9),
        end_time=datetime.time(18),
        working_days=[0, 1, 2, 3, 4],
        tz=pytz.timezone("America/Santiago"),
    )
    santiago_lunchbreak = btd.LunchTimeRule(
        start_time=datetime.time(12),
        end_time=datetime.time(13),
        working_days=[0, 1, 2, 3, 4],
        tz=pytz.timezone("America/Santiago"),
    )
    santiago_businesshrs = btd.Rules([santiago_workday, santiago_lunchbreak])

    sf_tz = pytz.timezone("America/Los_Angeles")
    sf_start = sf_tz.localize(datetime.datetime(2016, 1, 18, 9, 0, 0))
    sf_end = sf_tz.localize(datetime.datetime(2016, 1, 18, 18, 0, 0))

    bdiff = santiago_businesshrs.difference(sf_start, sf_end)
    assert bdiff.hours == 4
    assert bdiff.seconds == 0


def test_readme_nightshift(btd: ModuleType) -> None:
    workday = btd.WorkDayRule(
        start_time=datetime.time(9),
        end_time=datetime.time(17),
        working_days=[0, 1, 2, 3, 4],
        tz=pytz.utc,
    )
    nightshift = btd.WorkDayRule(
        start_time=datetime.time(23),
        end_time=datetime.time(7),
        working_days=[0, 1, 2, 3, 4],
    )
    businesshrs = btd.Rules([workday, nightshift])

    start = datetime.datetime(2016, 1, 18, 9, 0, 0)
    end = datetime.datetime(2016, 1, 25, 9, 0, 0)

    bdiff = businesshrs.difference(start, end)
    assert bdiff.hours == 80
    assert bdiff.seconds == 0
