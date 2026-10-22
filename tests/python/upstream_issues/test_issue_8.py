"""seppemans/businesstimedelta#8: TypeError when using a HolidayRule.

`HolidayRule.next_holiday()` returns None when no holiday falls within its
five-year look-ahead, and `next()` passes that None to `datetime.combine`.
"""

import datetime
from types import ModuleType

import pytest


@pytest.mark.upstream_bug(raises=TypeError, reason="next_holiday() returns None")
def test_adding_across_a_listed_holiday(btd: ModuleType) -> None:
    workday = btd.WorkDayRule(
        start_time=datetime.time(9),
        end_time=datetime.time(16),
        working_days=[0, 1, 2, 3, 4],
    )
    holiday = btd.HolidayRule([datetime.date(2021, 3, 15)])
    rules = btd.Rules([workday, holiday])

    start = datetime.datetime(2021, 3, 13)
    task = start + btd.BusinessTimeDelta(rules, hours=8)

    # Mon 15 is the holiday: 7h on Tue 16, then 1h on Wed 17.
    assert task == datetime.datetime(2021, 3, 17, 10, tzinfo=datetime.timezone.utc)
