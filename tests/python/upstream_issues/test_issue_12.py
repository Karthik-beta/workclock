"""seppemans/businesstimedelta#12: cannot calculate negative timedeltas.

`Rule.difference()` sorts its arguments, so the result is never negative.
workclock's typed API returns a signed result (DESIGN.md B4); compat keeps
upstream's absolute value for drop-in compatibility, so this test will run
against the typed API rather than compat.
"""

import datetime
from types import ModuleType

import pytest

UTC = datetime.timezone.utc


@pytest.mark.upstream_bug(raises=AssertionError, reason="difference() is always >= 0")
def test_difference_is_negative_when_end_precedes_start(btd: ModuleType) -> None:
    workday = btd.WorkDayRule(
        start_time=datetime.time(9),
        end_time=datetime.time(17),
        working_days=[0, 1, 2, 3, 4],
    )
    diff = workday.difference(
        datetime.datetime(2026, 1, 5, 12, tzinfo=UTC),
        datetime.datetime(2026, 1, 5, 10, tzinfo=UTC),
    )
    assert diff.timedelta == datetime.timedelta(hours=-2)
