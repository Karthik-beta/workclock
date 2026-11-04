"""Hypothesis strategies for random schedules and queries.

They mirror `crates/workclock/tests/support/strategies.rs`: queries fall in
2026, and every value is a whole number of minutes, as the oracle requires.
"""

from datetime import date, datetime, timedelta, timezone

from hypothesis import strategies as st

from support.fixture import HolidaySpec, RuleSpec, ScheduleSpec

ZONES = ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London"]
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
YEAR_START = datetime(2026, 1, 1, tzinfo=timezone.utc)
MINUTES_IN_YEAR = 365 * 24 * 60

zones = st.sampled_from(ZONES)
times_of_day = st.builds(
    lambda h, m: f"{h:02}:{m:02}", st.integers(0, 23), st.sampled_from([0, 15, 30, 45])
)
# Start and end are drawn independently, which also yields overnight and
# 24-hour shifts.
rules = st.builds(
    RuleSpec,
    start=times_of_day,
    end=times_of_day,
    days=st.lists(st.sampled_from(DAYS), min_size=1, max_size=7, unique=True),
    zone=st.one_of(st.none(), zones),
)
holidays = st.builds(
    HolidaySpec,
    dates=st.lists(
        st.integers(0, 364).map(
            lambda d: (date(2026, 1, 1) + timedelta(d)).isoformat()
        ),
        min_size=1,
        max_size=4,
    ),
    zone=st.one_of(st.none(), zones),
)
schedules = st.builds(
    ScheduleSpec,
    zone=zones,
    workdays=st.lists(rules, min_size=1, max_size=2),
    breaks=st.lists(rules, max_size=2),
    holidays=st.lists(holidays, max_size=1),
)
moments = st.integers(0, MINUTES_IN_YEAR - 1).map(
    lambda m: YEAR_START + timedelta(minutes=m)
)


def durations(max_hours: int) -> st.SearchStrategy[timedelta]:
    """Signed whole minutes of at most ``max_hours``."""
    return st.integers(-max_hours * 60, max_hours * 60).map(
        lambda m: timedelta(minutes=m)
    )
