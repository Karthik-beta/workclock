"""DESIGN.md's compatibility examples (C1-C9) and compat's own behaviour.

Tests that take `btd` also run against businesstimedelta 1.0.1, where the
design says both agree.
"""

from __future__ import annotations

import datetime
from types import ModuleType
from zoneinfo import ZoneInfo

import holidays
import pytest
from workclock import NoWorkingTimeError, OutOfRangeError, UnknownZoneError, compat

UTC = datetime.timezone.utc


def utc(
    year: int,
    month: int,
    day: int,
    hour: int = 0,
    minute: int = 0,
    second: int = 0,
    microsecond: int = 0,
) -> datetime.datetime:
    return datetime.datetime(
        year, month, day, hour, minute, second, microsecond, tzinfo=UTC
    )


def test_difference_is_absolute(btd: ModuleType) -> None:
    # C1
    diff = btd.WorkDayRule(datetime.time(9), datetime.time(17)).difference(
        utc(2026, 1, 5, 12), utc(2026, 1, 5, 10)
    )
    assert diff.timedelta == datetime.timedelta(hours=2)


def test_naive_datetimes_are_utc(btd: ModuleType) -> None:
    # N3
    diff = btd.WorkDayRule(datetime.time(9), datetime.time(17)).difference(
        datetime.datetime(2026, 1, 5, 10), datetime.datetime(2026, 1, 5, 12)
    )
    assert diff.timedelta == datetime.timedelta(hours=2)


def test_adding_and_subtracting_zero_snaps(btd: ModuleType) -> None:
    # C2, C3
    zero = btd.BusinessTimeDelta(
        btd.WorkDayRule(datetime.time(9), datetime.time(17)), hours=0
    )
    saturday = utc(2026, 1, 10, 10)
    assert saturday + zero == utc(2026, 1, 12, 9)
    assert saturday - zero == utc(2026, 1, 9, 17)


def test_working_days_compare_as_integers(btd: ModuleType) -> None:
    # businesstimedelta tests `weekday() in working_days`, and True == 1.
    rule = btd.WorkDayRule(datetime.time(9), datetime.time(17), working_days=[True])
    diff = rule.difference(utc(2026, 1, 5), utc(2026, 1, 7))
    assert diff.timedelta == datetime.timedelta(hours=8)


def test_hours_and_seconds_split_the_delta(btd: ModuleType) -> None:
    # C5
    delta = btd.BusinessTimeDelta(
        btd.WorkDayRule(datetime.time(9), datetime.time(17)),
        timedelta=datetime.timedelta(hours=2, seconds=1),
    )
    assert (delta.hours, delta.seconds) == (2, 1)


def test_difference_drops_microseconds(btd: ModuleType) -> None:
    # C6
    diff = btd.WorkDayRule(datetime.time(9), datetime.time(17)).difference(
        utc(2026, 1, 5, 10), utc(2026, 1, 5, 10, 0, 0, 999999)
    )
    assert (diff.hours, diff.seconds) == (0, 0)


def test_python_holidays_objects(btd: ModuleType) -> None:
    # C8: Independence Day 2026 is observed on Friday 3 July.
    rules = btd.Rules(
        [
            btd.WorkDayRule(datetime.time(9), datetime.time(17)),
            btd.HolidayRule(holidays.country_holidays("US")),
        ]
    )
    diff = rules.difference(utc(2026, 7, 3, 9), utc(2026, 7, 3, 17))
    assert (diff.hours, diff.seconds) == (0, 0)


@pytest.mark.upstream_bug(raises=TypeError, reason="the holiday look-ahead ends")
def test_python_holidays_are_filled_in_up_to_2100(btd: ModuleType) -> None:
    # C9: 2101 is outside the filled-in window, so 4 July is a working day.
    rules = btd.Rules(
        [
            btd.WorkDayRule(datetime.time(9), datetime.time(17)),
            btd.HolidayRule(holidays.country_holidays("US")),
        ]
    )
    diff = rules.difference(utc(2101, 7, 4, 9), utc(2101, 7, 4, 17))
    assert (diff.hours, diff.seconds) == (8, 0)


def test_equal_start_and_end_is_an_empty_rule() -> None:
    # C4: businesstimedelta hangs on the addition.
    rule = compat.WorkDayRule(datetime.time(9), datetime.time(9))
    diff = rule.difference(utc(2026, 1, 5, 12), utc(2026, 1, 6, 12))
    assert (diff.hours, diff.seconds) == (0, 0)
    with pytest.raises(NoWorkingTimeError):
        utc(2026, 1, 5, 12) + compat.BusinessTimeDelta(rule, hours=1)


def test_negative_deltas_move_the_other_way() -> None:
    rule = compat.WorkDayRule(datetime.time(9), datetime.time(17))
    back = compat.BusinessTimeDelta(rule, hours=-2)
    assert utc(2026, 1, 5, 10) + back == utc(2026, 1, 2, 16)
    assert utc(2026, 1, 2, 16) - back == utc(2026, 1, 5, 10)


def test_naive_datetimes_are_utc_and_results_keep_the_input_zone() -> None:
    rule = compat.WorkDayRule(datetime.time(9), datetime.time(17))
    hour = compat.BusinessTimeDelta(rule, hours=1)
    assert datetime.datetime(2026, 1, 5, 9) + hour == utc(2026, 1, 5, 10)
    london = datetime.datetime(2026, 1, 5, 9, tzinfo=ZoneInfo("Europe/London"))
    result = london + hour
    assert isinstance(result, datetime.datetime)
    assert result.tzinfo is london.tzinfo


def test_rule_attributes_can_change_after_construction() -> None:
    rule = compat.WorkDayRule(datetime.time(9), datetime.time(17))
    rule.end_time = datetime.time(18)
    diff = rule.difference(utc(2026, 1, 5, 9), utc(2026, 1, 5, 20))
    assert diff.hours == 9


def test_rules_see_changes_to_the_rules_they_combine(btd: ModuleType) -> None:
    workday = btd.WorkDayRule(
        datetime.time(9), datetime.time(17), working_days=[0, 1, 2, 3, 4]
    )
    lunch = btd.LunchTimeRule(working_days=[0, 1, 2, 3, 4])
    rules = btd.Rules([workday, lunch])

    def monday() -> int:
        hours: int = rules.difference(utc(2026, 1, 5, 9), utc(2026, 1, 5, 20)).hours
        return hours

    assert monday() == 7
    workday.end_time = datetime.time(18)
    assert monday() == 8
    lunch.start_time = datetime.time(11)
    assert monday() == 7
    workday.working_days.remove(0)
    assert monday() == 0
    workday.working_days.append(0)
    rules.unavailable_rules.clear()
    assert monday() == 9


def test_rules_build_their_schedule_again_only_after_a_change() -> None:
    workday = compat.WorkDayRule(datetime.time(9), datetime.time(17))
    us = compat.HolidayRule(holidays.country_holidays("US", years=2026))
    rules = compat.Rules([workday, us])
    built = rules._schedule()
    assert rules._schedule() is built
    workday.tz = ZoneInfo("America/New_York")
    assert rules._schedule() is not built
    diff = rules.difference(utc(2026, 1, 5, 14), utc(2026, 1, 5, 23))
    assert diff.hours == 8
    built = rules._schedule()
    us.tz = ZoneInfo("Pacific/Kiritimati")
    assert rules._schedule() is not built


def test_holiday_rule_errors_are_workclock_errors() -> None:
    mars = compat.HolidayRule([datetime.date(2026, 1, 1)], tz="Mars/Olympus_Mons")
    with pytest.raises(UnknownZoneError, match="Mars/Olympus_Mons"):
        mars.next(utc(2026, 1, 1))
    last = compat.HolidayRule([datetime.date(9999, 12, 31)])
    with pytest.raises(OutOfRangeError):
        last.next(utc(9999, 12, 30, 12))


def test_holiday_rules_work_on_their_own() -> None:
    rule = compat.HolidayRule([datetime.date(2026, 1, 1), datetime.date(2026, 1, 2)])
    two_hours = compat.BusinessTimeDelta(rule, hours=2)
    assert utc(2025, 12, 31) + two_hours == utc(2026, 1, 1, 2)
    assert utc(2026, 1, 1, 23) + two_hours == utc(2026, 1, 2, 1)
    assert rule.difference(utc(2025, 12, 31), utc(2026, 1, 5)).hours == 48
    with pytest.raises(NoWorkingTimeError):
        rule.next(utc(2026, 1, 3))


def test_unsupported_rules_are_rejected() -> None:
    class Custom(compat.Rule):
        pass

    rule = compat.WorkDayRule(datetime.time(9), datetime.time(17))
    with pytest.raises(TypeError, match="not supported"):
        Custom().difference(utc(2026, 1, 5), utc(2026, 1, 6))
    available_holidays = compat.HolidayRule([datetime.date(2026, 1, 1)], time_off=False)
    with pytest.raises(TypeError, match="as working time"):
        compat.Rules([rule, available_holidays]).difference(
            utc(2026, 1, 5), utc(2026, 1, 6)
        )
    with pytest.raises(TypeError, match=r"datetime\.date"):
        compat.HolidayRule([utc(2026, 1, 1)])
