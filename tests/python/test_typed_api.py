from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo

import holidays
import pytest
import pytz
import workclock
from workclock import (
    Break,
    Holidays,
    NoWorkingTimeError,
    OutOfRangeError,
    Schedule,
    UnknownZoneError,
    WorkDay,
)

UTC = timezone.utc


def utc(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 1, day, hour, minute, tzinfo=UTC)


@pytest.fixture
def office() -> Schedule:
    return Schedule([WorkDay(time(9), time(17)), Break(time(12), time(13))])


@pytest.fixture
def nights() -> Schedule:
    return Schedule([WorkDay(time(22), time(6))])


def test_overnight_shifts(nights: Schedule) -> None:
    # O1, O2, O3: the cases businesstimedelta 1.0.1 gets wrong.
    assert nights.between(utc(5, 22), utc(6, 6)) == timedelta(hours=8)
    assert nights.add(utc(5, 22), hours=4) == utc(6, 2)
    assert nights.sub(utc(6, 6), hours=4) == utc(6, 2)


def test_between_is_signed(office: Schedule) -> None:
    assert office.between(utc(5, 9), utc(5, 17)) == timedelta(hours=7)
    assert office.between(utc(5, 17), utc(5, 9)) == timedelta(hours=-7)


def test_amounts_combine_delta_and_keywords(office: Schedule) -> None:
    start = utc(5, 9)
    expected = utc(5, 14, 30)
    assert office.add(start, timedelta(hours=4, minutes=30)) == expected
    assert office.add(start, hours=4, minutes=30) == expected
    assert office.add(start, timedelta(hours=4), minutes=20, seconds=600) == expected
    assert office.add(start, hours=4.5) == expected


def test_zero_and_negative_amounts(office: Schedule) -> None:
    saturday = datetime(2026, 1, 10, 10, tzinfo=UTC)
    assert office.add(saturday) == saturday
    assert office.sub(saturday, hours=0) == saturday
    # One hour on Monday morning, then one before Friday's close.
    assert office.add(utc(5, 10), hours=-2) == datetime(2026, 1, 2, 16, tzinfo=UTC)
    assert office.sub(utc(5, 10), hours=-2) == office.add(utc(5, 10), hours=2)


def test_results_keep_the_input_tzinfo(office: Schedule) -> None:
    london = ZoneInfo("Europe/London")
    new_york = pytz.timezone("America/New_York")
    for start in [
        datetime(2026, 1, 5, 9, tzinfo=london),
        new_york.localize(datetime(2026, 1, 5, 4)),
    ]:
        result = office.add(start, hours=1)
        assert result.tzinfo is start.tzinfo or result.tzinfo == start.tzinfo
        assert result == utc(5, 10)
    pytz_result = office.add(new_york.localize(datetime(2026, 1, 5, 4)), hours=1)
    assert pytz_result.tzname() == "EST"


def test_zones_accept_names_and_tzinfo_objects() -> None:
    # Z3: a Los Angeles office whose holiday defaults to the schedule's zone.
    zones: list[str | tzinfo] = ["America/Los_Angeles", ZoneInfo("America/Los_Angeles")]
    for zone in zones:
        schedule = Schedule(
            [WorkDay(time(9), time(17)), Holidays([date(2026, 1, 26)])],
            time_zone=zone,
        )
        assert schedule.time_zone == "America/Los_Angeles"
        monday = datetime(2026, 1, 26, 9, tzinfo=ZoneInfo("America/Los_Angeles"))
        assert schedule.between(monday, monday + timedelta(hours=8)) == timedelta(0)


def test_holidays_accept_a_python_holidays_object() -> None:
    us = holidays.country_holidays("US", years=2026)
    schedule = Schedule([WorkDay(time(9), time(17)), Holidays(us)])
    independence_day_observed = datetime(2026, 7, 3, 9, tzinfo=UTC)
    assert schedule.between(
        independence_day_observed, independence_day_observed + timedelta(hours=8)
    ) == timedelta(0)


def test_naive_datetimes_are_rejected(office: Schedule) -> None:
    # N1
    with pytest.raises(ValueError, match="naive"):
        office.between(datetime(2026, 1, 5, 10), utc(5, 12))
    with pytest.raises(ValueError, match="naive"):
        office.add(datetime(2026, 1, 5, 10), hours=1)


def test_errors_subclass_builtin_exceptions() -> None:
    assert issubclass(NoWorkingTimeError, ValueError)
    assert issubclass(OutOfRangeError, OverflowError)
    assert issubclass(UnknownZoneError, ValueError)
    for error in (NoWorkingTimeError, OutOfRangeError, UnknownZoneError):
        assert issubclass(error, workclock.WorkclockError)


def test_build_errors() -> None:
    # E1, E3, E6
    with pytest.raises(NoWorkingTimeError):
        Schedule([])
    with pytest.raises(NoWorkingTimeError):
        Schedule([WorkDay(time(9), time(17)), Break(time(9), time(17))])
    with pytest.raises(UnknownZoneError, match="Mars/Olympus_Mons"):
        Schedule([WorkDay(time(9), time(17))], time_zone="Mars/Olympus_Mons")


def test_results_past_the_supported_range_are_errors() -> None:
    # E5
    schedule = Schedule([WorkDay(time(9), time(17))])
    with pytest.raises(OutOfRangeError):
        schedule.add(datetime(9999, 12, 30, 16, tzinfo=UTC), hours=2)


def test_inputs_past_the_supported_range_are_named(office: Schedule) -> None:
    last = datetime(9999, 12, 30, 22, tzinfo=UTC)
    assert office.between(last, last) == timedelta(0)
    with pytest.raises(
        OutOfRangeError,
        match=r"^9999-12-31T00:00:00\+00:00 is outside the supported range "
        r"-009999-01-02T01:59:59Z to 9999-12-30T22:00:00Z$",
    ):
        office.between(utc(5, 9), datetime(9999, 12, 31, tzinfo=UTC))
    with pytest.raises(OutOfRangeError, match=r"^item 1: 9999-12-30T22:00:00\.000001"):
        office.between_many([last] * 2, [last, last + timedelta(microseconds=1)])


def test_results_before_year_1_are_errors() -> None:
    always = Schedule([WorkDay(time(0), time(0), range(7))])
    with pytest.raises(OutOfRangeError, match=r"before 0001-01-01.* years 1 to 9999"):
        always.sub(datetime(1, 1, 1, 1, tzinfo=UTC), hours=2)
    eastern = timezone(timedelta(hours=-5))
    with pytest.raises(
        OutOfRangeError,
        match=r"result 0001-01-01T04:00:00\+00:00 .* years 1 to 9999 in UTC-05:00",
    ):
        always.sub(datetime(1, 1, 1, tzinfo=eastern), hours=1)


def test_amounts_past_the_engine_range_are_errors(office: Schedule) -> None:
    start = utc(5, 9)
    huge = timedelta(days=999_999_999)
    with pytest.raises(OutOfRangeError, match=r"amount .*days=999999999.* outside"):
        office.add(start, huge)
    with pytest.raises(OutOfRangeError, match=r"amount .*days=999999999.* outside"):
        office.sub(start, huge)
    with pytest.raises(OutOfRangeError, match=r"amount hours=1e\+20 is outside"):
        office.add(start, hours=1e20)
    with pytest.raises(OutOfRangeError, match="amount hours=inf is outside"):
        office.add(start, hours=float("inf"))
    with pytest.raises(OutOfRangeError, match=r"amount .* is outside"):
        office.add(start, timedelta(microseconds=2**63))
    with pytest.raises(OutOfRangeError, match="result is outside"):
        office.add(start, timedelta(microseconds=2**63 - 1))
    with pytest.raises(ValueError, match="amount hours=nan is not a number"):
        office.add(start, hours=float("nan"))


def test_invalid_rules_are_rejected() -> None:
    with pytest.raises(ValueError, match="days must be integers"):
        WorkDay(time(9), time(17), [7])
    with pytest.raises(ValueError, match="time_zone"):
        WorkDay(time(9, tzinfo=UTC), time(17))
    with pytest.raises(TypeError, match=r"datetime\.date"):
        Holidays([datetime(2026, 1, 1, tzinfo=UTC)])
    with pytest.raises(TypeError, match="WorkDay, Break or Holidays"):
        Schedule([object()])  # type: ignore[list-item]


def test_rules_are_comparable_values() -> None:
    assert WorkDay(time(9), time(17)) == WorkDay(time(9), time(17), [4, 3, 2, 1, 0])
    same_hours: list[object] = [WorkDay(time(9), time(17)), Break(time(9), time(17))]
    assert same_hours[0] != same_hours[1]
    assert hash(Holidays([date(2026, 1, 1)])) == hash(Holidays([date(2026, 1, 1)] * 2))
    assert repr(WorkDay(time(9), time(17), [0], time_zone="UTC")) == (
        "WorkDay(start=datetime.time(9, 0), end=datetime.time(17, 0), "
        "days=frozenset({0}), time_zone='UTC')"
    )


def test_periods(office: Schedule) -> None:
    saturday = datetime(2026, 1, 10, 10, tzinfo=UTC)
    assert office.next_period(saturday) == (utc(12, 9), utc(12, 12))
    assert office.previous_period(saturday) == (utc(9, 13), utc(9, 17))
    assert office.next_period(utc(5, 10)) == (utc(5, 10), utc(5, 12))
    assert office.previous_period(utc(5, 9)) == (utc(2, 13), utc(2, 17))
    london = datetime(2026, 1, 10, 10, tzinfo=ZoneInfo("Europe/London"))
    assert all(t.tzinfo is london.tzinfo for t in office.next_period(london))
