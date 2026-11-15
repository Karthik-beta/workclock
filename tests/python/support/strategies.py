"""Hypothesis strategies for random schedules and queries.

They mirror `crates/workclock/tests/support/strategies.rs`: queries fall in
2026, and every value is a whole number of minutes, as the oracle requires.
"""

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

from hypothesis import strategies as st

from support.fixture import HolidaySpec, RuleSpec, ScheduleSpec, SpecialDaySpec

ZONES = ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London"]
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
YEAR_START = datetime(2026, 1, 1, tzinfo=UTC)
MINUTES_IN_YEAR = 365 * 24 * 60
# The local dates of the 2026 DST changes in New York and London.
DST_DATES = ["2026-03-08", "2026-03-29", "2026-10-25", "2026-11-01"]

zones = st.sampled_from(ZONES)
times_of_day = st.builds(
    lambda h, m: f"{h:02}:{m:02}", st.integers(0, 23), st.sampled_from([0, 15, 30, 45])
)
days_of_2026 = st.integers(0, 364).map(
    lambda d: (date(2026, 1, 1) + timedelta(d)).isoformat()
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
    dates=st.lists(days_of_2026, min_size=1, max_size=4),
    zone=st.one_of(st.none(), zones),
)
# Up to 20 dates, so that queries often meet one, and many of them on DST
# changes. Start and end are drawn as for workdays.
special_days = st.builds(
    SpecialDaySpec,
    start=times_of_day,
    end=times_of_day,
    dates=st.lists(
        st.one_of(days_of_2026, st.sampled_from(DST_DATES)),
        min_size=1,
        max_size=20,
    ),
    zone=st.one_of(st.none(), zones),
)
# `workclock.compat` has no special days.
schedules_without_special_days = st.builds(
    ScheduleSpec,
    zone=zones,
    workdays=st.lists(rules, min_size=1, max_size=2),
    breaks=st.lists(rules, max_size=2),
    holidays=st.lists(holidays, max_size=1),
)


def _with_special_days(
    spec: ScheduleSpec, specialdays: list[SpecialDaySpec], on_holiday: bool
) -> ScheduleSpec:
    """Add ``specialdays`` to ``spec``.

    Random dates rarely meet, so ``on_holiday`` puts the first special day on
    a holiday on purpose.
    """
    if on_holiday and spec.holidays and specialdays:
        first = specialdays[0]
        holiday = spec.holidays[0].dates[0]
        specialdays = [replace(first, dates=[*first.dates, holiday]), *specialdays[1:]]
    return replace(spec, specialdays=specialdays)


schedules = st.builds(
    _with_special_days,
    schedules_without_special_days,
    st.lists(special_days, max_size=2),
    st.booleans(),
)
moments = st.integers(0, MINUTES_IN_YEAR - 1).map(
    lambda m: YEAR_START + timedelta(minutes=m)
)


def durations(max_hours: int) -> st.SearchStrategy[timedelta]:
    """Signed whole minutes of at most ``max_hours``."""
    return st.integers(-max_hours * 60, max_hours * 60).map(
        lambda m: timedelta(minutes=m)
    )
