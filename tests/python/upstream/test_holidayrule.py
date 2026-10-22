# Ported from businesstimedelta 1.0.1, test/rules/holidayrule_tests.py.
# Copyright (c) 2015 Sebastiaan Boer, MIT License; see NOTICE.

import datetime
from types import ModuleType

import holidays as holidaymodule
import pytz

UTC = pytz.utc
PST = pytz.timezone("US/Pacific")
HOLIDAYS = [
    datetime.date(2015, 12, 25),
    datetime.date(2016, 12, 25),
    datetime.date(2017, 12, 25),
]


def utc(
    year: int, month: int, day: int, hour: int = 0, minute: int = 0, second: int = 0
) -> datetime.datetime:
    dt: datetime.datetime = UTC.localize(
        datetime.datetime(year, month, day, hour, minute, second)
    )
    return dt


def test_repr(btd: ModuleType) -> None:
    holiday = btd.HolidayRule(HOLIDAYS)
    assert str(holiday)[:12] == "<HolidayRule"


def test_next_before_holiday(btd: ModuleType) -> None:
    dt = utc(2016, 1, 23, 12, 43, 0)
    holiday = btd.HolidayRule(HOLIDAYS)
    assert holiday.next(dt) == (utc(2016, 12, 25, 0, 0, 0), utc(2016, 12, 26, 0, 0, 0))


def test_next_before_holiday_non_localized(btd: ModuleType) -> None:
    dt = datetime.datetime(2016, 1, 23, 12, 43, 0)
    holiday = btd.HolidayRule(HOLIDAYS)
    assert holiday.next(dt) == (utc(2016, 12, 25, 0, 0, 0), utc(2016, 12, 26, 0, 0, 0))


def test_next_during_holiday(btd: ModuleType) -> None:
    dt = utc(2016, 12, 25, 12, 0, 0)
    holiday = btd.HolidayRule(HOLIDAYS)
    assert holiday.next(dt) == (dt, utc(2016, 12, 26, 0, 0, 0))


def test_next_during_holiday_start_edge(btd: ModuleType) -> None:
    dt = utc(2016, 12, 25, 0, 0, 0)
    holiday = btd.HolidayRule(HOLIDAYS)
    assert holiday.next(dt) == (dt, utc(2016, 12, 26, 0, 0, 0))


def test_next_during_holiday_end_edge(btd: ModuleType) -> None:
    dt = utc(2016, 12, 26, 0, 0, 0)
    holiday = btd.HolidayRule(HOLIDAYS)
    assert holiday.next(dt) == (utc(2017, 12, 25, 0, 0, 0), utc(2017, 12, 26, 0, 0, 0))


def test_next_during_holiday_cross_timezone(btd: ModuleType) -> None:
    dt = PST.localize(datetime.datetime(2016, 12, 24, 20, 0, 0))
    holiday = btd.HolidayRule(HOLIDAYS)
    assert holiday.next(dt) == (dt.astimezone(UTC), utc(2016, 12, 26, 0, 0, 0))


def test_previous_before_holiday(btd: ModuleType) -> None:
    dt = utc(2016, 1, 22, 0, 0, 0)
    holiday = btd.HolidayRule(HOLIDAYS)
    assert holiday.previous(dt) == (
        utc(2015, 12, 25, 0, 0, 0),
        utc(2015, 12, 26, 0, 0, 0),
    )


def test_previous_after_holiday(btd: ModuleType) -> None:
    dt = utc(2016, 12, 27, 0, 0, 0)
    holiday = btd.HolidayRule(HOLIDAYS)
    assert holiday.previous(dt) == (
        utc(2016, 12, 25, 0, 0, 0),
        utc(2016, 12, 26, 0, 0, 0),
    )


def test_previous_during_holiday(btd: ModuleType) -> None:
    dt = utc(2016, 12, 25, 12, 0, 0)
    holiday = btd.HolidayRule(HOLIDAYS)
    assert holiday.previous(dt) == (utc(2016, 12, 25, 0, 0, 0), dt)


def test_next_with_holiday_module(btd: ModuleType) -> None:
    dt = utc(2015, 12, 23, 12, 0, 0)
    holiday = btd.HolidayRule(holidaymodule.country_holidays("US"))
    assert holiday.next(dt) == (utc(2015, 12, 25, 0, 0, 0), utc(2015, 12, 26, 0, 0, 0))


def test_previous_with_holiday_module(btd: ModuleType) -> None:
    dt = utc(2015, 12, 26, 12, 0, 0)
    holiday = btd.HolidayRule(holidaymodule.country_holidays("US"))
    assert holiday.previous(dt) == (
        utc(2015, 12, 25, 0, 0, 0),
        utc(2015, 12, 26, 0, 0, 0),
    )
