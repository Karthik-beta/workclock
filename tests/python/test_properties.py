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
from support.oracle import Oracle, OracleError
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
