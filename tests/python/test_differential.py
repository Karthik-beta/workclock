"""Differential tests: workclock.compat against businesstimedelta 1.0.1.

DESIGN.md: compat must equal 1.0.1 wherever 1.0.1 is correct, and the oracle
wherever it is not. So compat is checked against the oracle on every example,
and against 1.0.1 on schedules inside the domain where 1.0.1 is known to be
correct: one daytime shift, an optional break strictly inside it, and holidays,
all in one zone without daylight saving time. Outside that domain 1.0.1 has
known defects: a break that ends with the shift is not subtracted, and a
holiday list with no date within five years of a query raises.
"""

from __future__ import annotations

import datetime
from collections.abc import Callable
from typing import Any

import businesstimedelta
import pytz
from hypothesis import assume, given
from hypothesis import strategies as st
from support.fixture import HolidaySpec, RuleSpec, ScheduleSpec
from support.oracle import Oracle, OracleError
from support.strategies import DAYS, moments, schedules
from workclock import NoWorkingTimeError, compat

ZONES = ["UTC", "Asia/Kolkata"]
# Far from every query, so they never change a result, but within 1.0.1's
# five-year holiday look-ahead in both directions.
LOOK_AHEAD_HOLIDAYS = ["2023-06-15", "2029-06-15"]
UTC = datetime.timezone.utc


@st.composite
def correct_domain(draw: st.DrawFn) -> ScheduleSpec:
    """A schedule businesstimedelta 1.0.1 handles correctly."""
    start = draw(st.integers(0, 22 * 4))
    end = draw(st.integers(start + 1, 24 * 4 - 1))
    days = draw(st.lists(st.sampled_from(DAYS), min_size=1, max_size=7, unique=True))
    breaks = []
    if end - start >= 3 and draw(st.booleans()):
        break_start = draw(st.integers(start + 1, end - 2))
        break_end = draw(st.integers(break_start + 1, end - 1))
        breaks = [RuleSpec(_quarter(break_start), _quarter(break_end), days)]
    holidays = [
        (datetime.date(2026, 1, 1) + datetime.timedelta(d)).isoformat()
        for d in draw(st.lists(st.integers(0, 364), max_size=4))
    ]
    return ScheduleSpec(
        zone=draw(st.sampled_from(ZONES)),
        workdays=[RuleSpec(_quarter(start), _quarter(end), days)],
        breaks=breaks,
        holidays=[HolidaySpec(dates=[*holidays, *LOOK_AHEAD_HOLIDAYS])],
    )


def _quarter(n: int) -> str:
    return f"{n // 4:02}:{n % 4 * 15:02}"


def rules(module: Any, spec: ScheduleSpec) -> Any:
    """Builds `Rules` in either module from a spec, zones made explicit."""

    def tz(zone: str | None) -> Any:
        return pytz.timezone(zone or spec.zone)

    def hours(r: RuleSpec) -> dict[str, Any]:
        return {
            "start_time": datetime.time.fromisoformat(r.start),
            "end_time": datetime.time.fromisoformat(r.end),
            "working_days": [DAYS.index(d) for d in r.days],
            "tz": tz(r.zone),
        }

    parts = [module.WorkDayRule(**hours(r)) for r in spec.workdays]
    parts += [module.LunchTimeRule(**hours(r)) for r in spec.breaks]
    parts += [
        module.HolidayRule(sorted(h.all_dates()), tz=tz(h.zone)) for h in spec.holidays
    ]
    return module.Rules(parts)


def outcome(call: Callable[[], object]) -> object:
    try:
        return call()
    except OracleError as e:
        return e.kind
    except NoWorkingTimeError:
        return "no_working_time"


hours_amounts = st.integers(1, 24 * 60).map(lambda m: datetime.timedelta(minutes=m))


@given(spec=correct_domain(), a=moments, length=st.integers(0, 72 * 60))
def test_difference_matches_upstream_and_oracle(
    spec: ScheduleSpec, a: datetime.datetime, length: int
) -> None:
    b = a + datetime.timedelta(minutes=length)
    ours = rules(compat, spec).difference(a, b)
    theirs = rules(businesstimedelta, spec).difference(a, b)
    assert ours.timedelta == theirs.timedelta == Oracle.build(spec).between(a, b)


@given(spec=correct_domain(), t=moments, d=hours_amounts)
def test_adding_matches_upstream_and_oracle(
    spec: ScheduleSpec, t: datetime.datetime, d: datetime.timedelta
) -> None:
    ours = t + compat.BusinessTimeDelta(rules(compat, spec), timedelta=d)
    theirs = t + businesstimedelta.BusinessTimeDelta(
        rules(businesstimedelta, spec), timedelta=d
    )
    assert ours == theirs == Oracle.build(spec).add(t, d)


@given(spec=correct_domain(), t=moments, d=hours_amounts)
def test_subtracting_matches_upstream_and_oracle(
    spec: ScheduleSpec, t: datetime.datetime, d: datetime.timedelta
) -> None:
    ours = t - compat.BusinessTimeDelta(rules(compat, spec), timedelta=d)
    theirs = t - businesstimedelta.BusinessTimeDelta(
        rules(businesstimedelta, spec), timedelta=d
    )
    assert ours == theirs == Oracle.build(spec).sub(t, d)


@given(spec=schedules, t=moments, d=hours_amounts)
def test_compat_matches_oracle_beyond_upstream_domain(
    spec: ScheduleSpec, t: datetime.datetime, d: datetime.timedelta
) -> None:
    """Overnight shifts, overlapping rules and every zone, where 1.0.1 fails.

    ``start == end`` is left out: compat keeps upstream's empty rule (C4)
    where the oracle, like the typed API, has a 24-hour shift.
    """
    assume(all(r.start != r.end for r in [*spec.workdays, *spec.breaks]))
    try:
        oracle = Oracle.build(spec)
    except OracleError:
        return
    ours = rules(compat, spec)
    assert ours.difference(t, t + d).timedelta == oracle.between(t, t + d)
    assert outcome(lambda: t + compat.BusinessTimeDelta(ours, timedelta=d)) == outcome(
        lambda: oracle.add(t, d)
    )
    assert outcome(lambda: t - compat.BusinessTimeDelta(ours, timedelta=d)) == outcome(
        lambda: oracle.sub(t, d)
    )
