"""Compares the typed API with the brute-force oracle on random schedules.

The oracle is slow, so spans and durations stay short. The example count comes
from the Hypothesis profile set up in ``conftest.py``.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta

import pytest
from hypothesis import given
from support.fixture import ScheduleSpec
from support.oracle import MINUTE, Oracle, OracleError
from support.strategies import durations, moments, schedules
from support.typed import build, error_kind
from workclock import NoWorkingTimeError, Schedule, WorkclockError


def both(spec: ScheduleSpec) -> tuple[Schedule, Oracle] | None:
    """Builds both, or returns None if neither has working time."""
    try:
        oracle = Oracle.build(spec)
    except OracleError as e:
        if e.kind != "no_working_time":
            raise
        with pytest.raises(NoWorkingTimeError):
            build(spec)
        return None
    return build(spec), oracle


# How far the period tests walk the oracle from each end of a period or gap.
REACH = timedelta(hours=48)


def working_minutes(oracle: Oracle, start: datetime, end: datetime) -> list[bool]:
    """Whether each minute in ``[start, end)`` is working time."""
    result = []
    m = start
    while m < end:
        result.append(oracle.is_working(m))
        m += MINUTE
    return result


def outcome(call: Callable[[], datetime]) -> datetime | str:
    try:
        return call()
    except WorkclockError as e:
        return error_kind(e)
    except OracleError as e:
        return e.kind


@given(spec=schedules, a=moments, length=durations(72))
def test_between_matches_oracle(
    spec: ScheduleSpec, a: datetime, length: timedelta
) -> None:
    pair = both(spec)
    if pair is None:
        return
    schedule, oracle = pair
    b = a + length
    assert schedule.between(a, b) == oracle.between(a, b)


@given(spec=schedules, t=moments, d=durations(24))
def test_add_matches_oracle(spec: ScheduleSpec, t: datetime, d: timedelta) -> None:
    pair = both(spec)
    if pair is None:
        return
    schedule, oracle = pair
    assert outcome(lambda: schedule.add(t, d)) == outcome(lambda: oracle.add(t, d))


@given(spec=schedules, t=moments, d=durations(24))
def test_sub_matches_oracle(spec: ScheduleSpec, t: datetime, d: timedelta) -> None:
    pair = both(spec)
    if pair is None:
        return
    schedule, oracle = pair
    assert outcome(lambda: schedule.sub(t, d)) == outcome(lambda: oracle.sub(t, d))


@given(spec=schedules, t=moments)
def test_next_period_matches_oracle(spec: ScheduleSpec, t: datetime) -> None:
    pair = both(spec)
    if pair is None:
        return
    schedule, oracle = pair
    start, end = schedule.next_period(t)
    assert t <= start < end
    assert not any(working_minutes(oracle, t, min(start, t + REACH)))
    assert all(working_minutes(oracle, start, min(end, start + REACH)))
    if end - start < REACH:
        assert not oracle.is_working(end)


@given(spec=schedules, t=moments)
def test_previous_period_matches_oracle(spec: ScheduleSpec, t: datetime) -> None:
    pair = both(spec)
    if pair is None:
        return
    schedule, oracle = pair
    start, end = schedule.previous_period(t)
    assert start < end <= t
    assert not any(working_minutes(oracle, max(end, t - REACH), t))
    assert all(working_minutes(oracle, max(start, end - REACH), end))
    if end - start < REACH:
        assert not oracle.is_working(start - MINUTE)
