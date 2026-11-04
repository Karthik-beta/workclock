"""seppemans/businesstimedelta#9: infinite loop when subtracting hours.

The workday rule is in Los Angeles but the holiday rule defaults to UTC, and
`Rules.previous()` never finds a period that is not cut by the holiday. The
call runs in a subprocess so that a hang becomes a timeout, not a stuck run.
"""

import subprocess
import sys
from datetime import datetime, timezone
from types import ModuleType

import pytest

CODE = """
import importlib, sys
from datetime import datetime, time
from holidays import country_holidays
from pytz import timezone

btd = importlib.import_module(sys.argv[1])
la_tz = timezone("America/Los_Angeles")
workday_rule = btd.WorkDayRule(
    start_time=time(8), end_time=time(17), working_days=[0, 1, 2, 3, 4], tz=la_tz
)
us_holidays_rule = btd.HolidayRule(country_holidays("US"))
business_hours = btd.Rules([workday_rule, us_holidays_rule])
# As in the report, pytz used as tzinfo= gives the LMT offset (-07:53).
test_datetime = datetime(2021, 11, 10, 17, 0, 0, 0, la_tz)
output = test_datetime - btd.BusinessTimeDelta(rule=business_hours, hours=4)
print(output.isoformat())
"""


@pytest.mark.upstream_bug(raises=subprocess.TimeoutExpired, reason="loops forever")
def test_subtracting_hours_terminates(btd: ModuleType) -> None:
    result = subprocess.run(
        [sys.executable, "-c", CODE, btd.__name__],
        capture_output=True,
        text=True,
        timeout=15,
        check=True,
    )
    # The input is 16:53 PST. The UTC holiday (Veterans Day) starts at 16:00 PST
    # on Nov 10, so the 4 hours are 12:00 to 16:00 PST.
    output = datetime.fromisoformat(result.stdout.strip())
    assert output == datetime(2021, 11, 10, 20, tzinfo=timezone.utc)
