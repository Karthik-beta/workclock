"""seppemans/businesstimedelta#10: difference fails with custom holidays.

With a holiday list that ends before the queried range, `next_holiday()`
exhausts its look-ahead and returns None, which `next()` cannot handle.
"""

import datetime
from types import ModuleType

import pytest

UTC = datetime.timezone.utc


@pytest.mark.upstream_bug(raises=TypeError, reason="next_holiday() returns None")
def test_difference_after_the_last_holiday(btd: ModuleType) -> None:
    workday = btd.WorkDayRule(
        start_time=datetime.time(9),
        end_time=datetime.time(17),
        working_days=[0, 1, 2, 3, 4],
    )
    holidays = btd.HolidayRule([datetime.date(2016, 1, 1)])
    rules = btd.Rules([workday, holidays])

    diff = rules.difference(
        datetime.datetime(2016, 1, 4, 9, tzinfo=UTC),
        datetime.datetime(2016, 1, 5, 17, tzinfo=UTC),
    )
    assert (diff.hours, diff.seconds) == (16, 0)
