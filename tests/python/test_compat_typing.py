"""Code written for businesstimedelta type-checks against compat.

`uv run mypy` checks this file, so the annotated assignments below fail the
type check if an operator's return type is too wide.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

from workclock.compat import BusinessTimeDelta, WorkDayRule

UTC = timezone.utc


def test_operators_return_precise_types() -> None:
    rule = WorkDayRule(time(9), time(17), working_days=(0, 1, 2, 3, 4))
    start = datetime(2026, 1, 5, 9, tzinfo=UTC)
    two = BusinessTimeDelta(rule, hours=2)
    due: datetime = start + two
    earlier: datetime = start - two
    also_due: datetime = two + start
    total: BusinessTimeDelta = two + two
    none: BusinessTimeDelta = two - two
    assert due == datetime(2026, 1, 5, 11, tzinfo=UTC)
    assert earlier == datetime(2026, 1, 2, 15, tzinfo=UTC)
    assert also_due == due
    assert total.timedelta == timedelta(hours=4)
    assert none.timedelta == timedelta(0)


def test_working_days_accepts_any_collection() -> None:
    weekend = WorkDayRule(time(9), time(17), working_days={5, 6})
    saturday = datetime(2026, 1, 10, 9, tzinfo=UTC)
    assert weekend.difference(saturday, saturday + timedelta(days=1)).hours == 8
