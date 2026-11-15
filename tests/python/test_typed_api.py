from __future__ import annotations

import copy
import dataclasses
import pickle
from datetime import UTC, date, datetime, time, timedelta, timezone, tzinfo
from typing import get_args, get_type_hints
from zoneinfo import ZoneInfo

import holidays
import numpy as np
import pytest
import pytz
import workclock
from workclock import (
    Break,
    Holidays,
    NoWorkingTimeError,
    OutOfRangeError,
    Rule,
    Schedule,
    SpecialDay,
    UnknownZoneError,
    WorkDay,
)

WEDNESDAY = date(2026, 1, 7)


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


def test_a_number_as_delta_is_rejected(office: Schedule) -> None:
    with pytest.raises(TypeError, match=r"delta must be a timedelta.*hours=.*seconds="):
        office.add(utc(5, 9), 3600)  # type: ignore[arg-type]
    with pytest.raises(TypeError, match="delta must be a timedelta"):
        office.sub(utc(5, 9), 1.5)  # type: ignore[arg-type]


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
        assert result.tzinfo is start.tzinfo
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
    assert date(2026, 7, 3) in Holidays(us).dates


def test_python_holidays_objects_need_years() -> None:
    with pytest.raises(ValueError, match=r"create it with years="):
        Holidays(holidays.country_holidays("US"))


def test_naive_datetimes_are_rejected(office: Schedule) -> None:
    # N1
    with pytest.raises(ValueError, match="naive"):
        office.between(datetime(2026, 1, 5, 10), utc(5, 12))
    with pytest.raises(ValueError, match="naive"):
        office.add(datetime(2026, 1, 5, 10), hours=1)


def test_instants_that_are_not_datetimes_are_type_errors(office: Schedule) -> None:
    text = "2026-01-05T10:00:00+00:00"
    for call in (
        lambda: office.between(text, utc(5, 12)),  # type: ignore[arg-type]
        lambda: office.add(text, hours=1),  # type: ignore[arg-type]
        lambda: office.sub(text, hours=1),  # type: ignore[arg-type]
        lambda: office.next_period(text),  # type: ignore[arg-type]
        lambda: office.previous_period(text),  # type: ignore[arg-type]
    ):
        with pytest.raises(TypeError, match="expected a datetime, got '2026"):
            call()


def test_errors_subclass_builtin_exceptions() -> None:
    assert issubclass(NoWorkingTimeError, ValueError)
    assert issubclass(OutOfRangeError, OverflowError)
    assert issubclass(UnknownZoneError, ValueError)
    for error in (NoWorkingTimeError, OutOfRangeError, UnknownZoneError):
        assert issubclass(error, workclock.WorkclockError)


def test_build_errors() -> None:
    # E1, E3, E6, S19
    empty = (
        r"^schedule has no working time: its working hours minus its breaks "
        r"are empty$"
    )
    with pytest.raises(NoWorkingTimeError, match=empty):
        Schedule([])
    with pytest.raises(NoWorkingTimeError, match=empty):
        Schedule([WorkDay(time(9), time(17)), Break(time(9), time(17))])
    with pytest.raises(NoWorkingTimeError, match=empty):
        Schedule([SpecialDay(time(8), time(12), [WEDNESDAY])])
    with pytest.raises(NoWorkingTimeError, match=empty):
        Schedule(
            [
                WorkDay(time(9), time(17)),
                Break(time(9), time(17)),
                SpecialDay(time(10), time(12), [WEDNESDAY]),
            ]
        )
    with pytest.raises(UnknownZoneError, match="Mars/Olympus_Mons"):
        Schedule([WorkDay(time(9), time(17))], time_zone="Mars/Olympus_Mons")
    with pytest.raises(UnknownZoneError, match="Mars/Olympus_Mons"):
        Schedule(
            [
                WorkDay(time(9), time(17)),
                SpecialDay(time(8), time(12), [], time_zone="Mars/Olympus_Mons"),
            ]
        )


def test_failed_searches_name_their_start() -> None:
    # Brazil dropped summer time in 2019; since then the break, in Sao Paulo,
    # covers the whole shift, but in 2001 it missed it, so the schedule builds.
    schedule = Schedule(
        [
            WorkDay(time(9), time(10), range(7), time_zone="Etc/GMT+3"),
            Break(time(9), time(10), range(7), time_zone="America/Sao_Paulo"),
        ]
    )
    start = datetime(2021, 1, 1, tzinfo=ZoneInfo("Asia/Tokyo"))
    message = (
        r"^no working time within 366 days, plus seven days per holiday date "
        r"and per special date, of 2021-01-01T00:00:00\+09:00$"
    )
    for search in (
        lambda: schedule.add(start, hours=1),
        lambda: schedule.sub(start, hours=1),
        lambda: schedule.next_period(start),
        lambda: schedule.previous_period(start),
    ):
        with pytest.raises(NoWorkingTimeError, match=message):
            search()
    with pytest.raises(NoWorkingTimeError, match=rf"^item 1: {message[1:]}"):
        schedule.add_many([datetime(2001, 1, 1, tzinfo=UTC), start], timedelta(hours=1))
    with pytest.raises(
        NoWorkingTimeError, match=r"^item 2: no working time .* of 2021-01-01T00:00$"
    ):
        schedule.sub_many(
            np.array([["2001-01-01T00:00"], ["2021-01-01T00:00"]], dtype="M8[m]"),
            np.array([1, 2], dtype="m8[h]"),
        )


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
    with pytest.raises(
        TypeError,
        match=r"^expected WorkDay, Break, Holidays or SpecialDay, got <object",
    ):
        Schedule([object()])  # type: ignore[list-item]


def test_rule_errors_name_the_bad_values() -> None:
    with pytest.raises(ValueError, match=r"to 6, got 'mon', 7$"):
        WorkDay(time(9), time(17), [1, "mon", 7])  # type: ignore[list-item]
    with pytest.raises(ValueError, match=r"to 6, got True, False$"):
        WorkDay(time(9), time(17), [1, True, False])
    with pytest.raises(ValueError, match="days must be a list"):
        WorkDay(time(9), time(17), "01")  # type: ignore[arg-type]
    with pytest.raises(TypeError, match="dates must be a list"):
        Holidays("2026-01-01")  # type: ignore[arg-type]


def test_days_accept_any_integer_type() -> None:
    rule = WorkDay(time(9), time(17), [np.int64(1), np.uint8(2)])
    assert rule == WorkDay(time(9), time(17), [1, 2])
    assert {type(day) for day in rule.days} == {int}


def test_rules_are_comparable_values() -> None:
    assert WorkDay(time(9), time(17)) == WorkDay(time(9), time(17), [4, 3, 2, 1, 0])
    same_hours: list[object] = [WorkDay(time(9), time(17)), Break(time(9), time(17))]
    assert same_hours[0] != same_hours[1]
    assert hash(Holidays([date(2026, 1, 1)])) == hash(Holidays([date(2026, 1, 1)] * 2))
    assert repr(WorkDay(time(9), time(17), [0], time_zone="UTC")) == (
        "WorkDay(start=datetime.time(9, 0), end=datetime.time(17, 0), "
        "days=frozenset({0}), time_zone='UTC')"
    )


def test_special_day_errors_name_the_bad_values() -> None:
    with pytest.raises(TypeError, match=r"^expected a datetime\.time, got '08:00'$"):
        SpecialDay("08:00", time(12), [WEDNESDAY])  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="has a tzinfo; set the rule's time_zone"):
        SpecialDay(time(8), time(12, tzinfo=UTC), [WEDNESDAY])
    with pytest.raises(
        TypeError,
        match=r"^dates must be a list of datetime\.date objects, "
        r"not the string '2026-01-07'$",
    ):
        SpecialDay(time(8), time(12), "2026-01-07")  # type: ignore[arg-type]
    with pytest.raises(
        TypeError, match=r"^dates must be datetime\.date objects, got '2026-01-07'$"
    ):
        SpecialDay(time(8), time(12), ["2026-01-07"])  # type: ignore[list-item]
    with pytest.raises(
        TypeError,
        match=r"^dates must be datetime\.date objects, "
        r"got datetime\.datetime\(2026, 1, 7, 0, 0\)$",
    ):
        SpecialDay(time(8), time(12), [datetime(2026, 1, 7)])
    with pytest.raises(TypeError, match="has no IANA name"):
        SpecialDay(time(8), time(12), [WEDNESDAY], time_zone=timezone.min)


def test_special_days_are_comparable_values() -> None:
    once = SpecialDay(time(8), time(12), [WEDNESDAY])
    twice = SpecialDay(time(8), time(12), (d for d in [WEDNESDAY, WEDNESDAY]))
    assert twice == once
    assert hash(twice) == hash(once)
    assert twice.dates == frozenset({WEDNESDAY})
    assert once != SpecialDay(time(8), time(13), [WEDNESDAY])
    assert once != SpecialDay(time(8), time(12), [WEDNESDAY], time_zone="UTC")
    assert len({once, twice}) == 1
    assert pickle.loads(pickle.dumps(once)) == once
    with pytest.raises(dataclasses.FrozenInstanceError):
        once.start = time(9)  # type: ignore[misc]
    new_york = SpecialDay(
        time(8), time(12), [WEDNESDAY], time_zone=ZoneInfo("America/New_York")
    )
    assert repr(new_york) == (
        "SpecialDay(start=datetime.time(8, 0), end=datetime.time(12, 0), "
        "dates=frozenset({datetime.date(2026, 1, 7)}), time_zone='America/New_York')"
    )


def test_special_days_replace_the_shifts_on_their_dates() -> None:
    # S1, S2, S3; the dates are read once.
    dates = iter([WEDNESDAY])
    schedule = Schedule(
        [WorkDay(time(9), time(17)), SpecialDay(time(8), time(12), dates)]
    )
    assert schedule.between(utc(7, 0), utc(8, 0)) == timedelta(hours=4)
    assert schedule.add(utc(6, 16), hours=2) == utc(7, 9)
    assert schedule.sub(utc(8, 10), hours=2) == utc(7, 11)


def test_special_days_without_dates_change_nothing() -> None:
    schedule = Schedule([WorkDay(time(9), time(17)), SpecialDay(time(8), time(12), [])])
    assert schedule.between(utc(7, 0), utc(8, 0)) == timedelta(hours=8)


def test_special_days_on_weekends_add_working_time() -> None:
    # S4, S5
    saturday = date(2026, 1, 10)
    schedule = Schedule(
        [WorkDay(time(9), time(17)), SpecialDay(time(10), time(14), [saturday])]
    )
    assert schedule.between(utc(9, 16), utc(12, 10)) == timedelta(hours=6)
    assert schedule.add(utc(9, 17), hours=2) == utc(10, 12)


def test_special_days_can_be_24_hours_or_overnight() -> None:
    saturday = date(2026, 1, 10)
    day = Schedule(
        [WorkDay(time(9), time(17)), SpecialDay(time(0), time(0), [saturday])]
    )
    assert day.between(utc(10, 0), utc(11, 0)) == timedelta(hours=24)
    night = Schedule(
        [WorkDay(time(9), time(17)), SpecialDay(time(22), time(2), [saturday])]
    )
    assert night.next_period(utc(10, 0)) == (utc(10, 22), utc(11, 2))
    assert night.between(utc(10, 0), utc(12, 0)) == timedelta(hours=4)


def test_special_nights_keep_the_shift_from_the_night_before() -> None:
    # S6, S7, S8
    tuesday = date(2026, 1, 6)
    schedule = Schedule(
        [WorkDay(time(22), time(6)), SpecialDay(time(22), time(2), [tuesday])]
    )
    assert schedule.between(utc(6, 0), utc(6, 6)) == timedelta(hours=6)
    assert schedule.between(utc(6, 22), utc(7, 6)) == timedelta(hours=4)
    assert schedule.add(utc(6, 5), hours=2) == utc(6, 23)


def test_breaks_and_holidays_apply_on_special_days() -> None:
    # S9, S10, S11, S12
    lunch = Schedule(
        [
            WorkDay(time(9), time(17)),
            Break(time(12), time(13)),
            SpecialDay(time(8), time(14), [WEDNESDAY]),
        ]
    )
    assert lunch.between(utc(7, 0), utc(8, 0)) == timedelta(hours=5)
    assert lunch.next_period(utc(7, 12, 30)) == (utc(7, 13), utc(7, 14))
    holiday = Schedule(
        [
            WorkDay(time(9), time(17)),
            Holidays([WEDNESDAY]),
            SpecialDay(time(8), time(12), [WEDNESDAY]),
        ]
    )
    assert holiday.between(utc(7, 0), utc(8, 0)) == timedelta(0)
    assert holiday.add(utc(6, 16), hours=2) == utc(8, 10)


def test_special_days_on_one_date_add_up() -> None:
    # S13, S14, S15
    schedule = Schedule(
        [
            SpecialDay(time(14), time(18), [WEDNESDAY]),
            WorkDay(time(9), time(17)),
            SpecialDay(time(8), time(12), [WEDNESDAY]),
        ]
    )
    assert schedule.between(utc(7, 0), utc(8, 0)) == timedelta(hours=8)
    assert schedule.next_period(utc(7, 12)) == (utc(7, 14), utc(7, 18))
    assert schedule.previous_period(utc(7, 14)) == (utc(7, 8), utc(7, 12))


def test_special_days_on_dst_changes_are_shorter_or_longer() -> None:
    # S16, S17
    new_york = ZoneInfo("America/New_York")
    schedule = Schedule(
        [
            WorkDay(time(9), time(17)),
            SpecialDay(time(1), time(5), [date(2026, 3, 8), date(2026, 11, 1)]),
        ],
        time_zone=new_york,
    )
    spring = (
        datetime(2026, 3, 8, tzinfo=new_york),
        datetime(2026, 3, 9, tzinfo=new_york),
    )
    autumn = (
        datetime(2026, 11, 1, tzinfo=new_york),
        datetime(2026, 11, 2, tzinfo=new_york),
    )
    assert schedule.between(*spring) == timedelta(hours=3)
    assert schedule.between(*autumn) == timedelta(hours=5)


def test_special_dates_are_calendar_dates_in_each_workday_zone() -> None:
    # S18: Kolkata's Wednesday shift starts on Tuesday in New York.
    schedule = Schedule(
        [
            WorkDay(time(9), time(17)),
            SpecialDay(time(10), time(12), [WEDNESDAY], time_zone="America/New_York"),
        ],
        time_zone="Asia/Kolkata",
    )
    assert schedule.between(utc(7, 0), utc(8, 0)) == timedelta(hours=2)


def test_each_special_date_lengthens_the_search_bound() -> None:
    # S20, S21: every special Monday falls inside the break.
    mondays = [date(2026, 1, 12) + timedelta(weeks=n) for n in range(62)]
    schedule = Schedule(
        [
            WorkDay(time(9), time(17), [0]),
            Break(time(12), time(13), [0]),
            SpecialDay(time(12), time(13), mondays),
        ]
    )
    after_the_gap = datetime(2027, 3, 22, 9, tzinfo=UTC)
    assert schedule.add(utc(6, 0), hours=1) == after_the_gap + timedelta(hours=1)
    assert schedule.sub(after_the_gap, hours=1) == utc(5, 16)


def test_rule_is_the_type_of_schedule_rules() -> None:
    assert "Rule" in workclock.__all__
    assert "SpecialDay" in workclock.__all__
    rules = vars(Schedule)["rules"]
    assert isinstance(rules, property)
    hints = get_type_hints(rules.fget)
    assert hints["return"] == tuple[Rule, ...]
    assert get_args(Rule) == (WorkDay, Break, Holidays, SpecialDay)


def test_schedules_pickle_and_deep_copy() -> None:
    schedule = Schedule(
        [
            WorkDay(time(9), time(17), time_zone="Europe/London"),
            Break(time(12), time(13)),
            Holidays([date(2026, 1, 7)]),
            SpecialDay(time(8), time(12), [date(2026, 1, 8)], time_zone="UTC"),
        ],
        time_zone="Asia/Kolkata",
    )
    start, end = utc(5, 0), utc(12, 0)
    for copied in (pickle.loads(pickle.dumps(schedule)), copy.deepcopy(schedule)):
        assert copied.rules == schedule.rules
        assert repr(copied) == repr(schedule)
        assert copied.add(start, hours=20) == schedule.add(start, hours=20)
        assert copied.between(start, end) == schedule.between(start, end)


def test_periods(office: Schedule) -> None:
    saturday = datetime(2026, 1, 10, 10, tzinfo=UTC)
    assert office.next_period(saturday) == (utc(12, 9), utc(12, 12))
    assert office.previous_period(saturday) == (utc(9, 13), utc(9, 17))
    assert office.next_period(utc(5, 10)) == (utc(5, 10), utc(5, 12))
    assert office.previous_period(utc(5, 9)) == (utc(2, 13), utc(2, 17))
    london = datetime(2026, 1, 10, 10, tzinfo=ZoneInfo("Europe/London"))
    assert all(t.tzinfo is london.tzinfo for t in office.next_period(london))
