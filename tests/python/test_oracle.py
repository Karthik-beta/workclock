from datetime import UTC, datetime, timedelta

import pytest
from support.fixture import (
    Add,
    Between,
    Build,
    Case,
    NextPeriod,
    Op,
    PreviousPeriod,
    RuleSpec,
    ScheduleSpec,
    SpecialDaySpec,
    Sub,
    load,
)
from support.oracle import Oracle, OracleError

FIXTURE = load()
# E4 walks ten years minute by minute, and P19-P21 a year of working time.
SLOW = {"E4", "P19", "P20", "P21"}

Outcome = timedelta | datetime | tuple[datetime, datetime] | str | None


def run(spec: ScheduleSpec, op: Op) -> Outcome:
    try:
        oracle = Oracle.build(spec)
        if isinstance(op, Between):
            return oracle.between(op.a, op.b)
        if isinstance(op, Add):
            return oracle.add(op.t, op.d)
        if isinstance(op, Sub):
            return oracle.sub(op.t, op.d)
        if isinstance(op, NextPeriod):
            return oracle.next_period(op.t)
        if isinstance(op, PreviousPeriod):
            return oracle.previous_period(op.t)
        assert isinstance(op, Build)
        return None
    except OracleError as e:
        return e.kind


@pytest.mark.parametrize(
    "case",
    [
        pytest.param(c, id=c.id, marks=pytest.mark.slow if c.id in SLOW else ())
        for c in FIXTURE.cases
    ],
)
def test_oracle_matches_design_example(case: Case) -> None:
    assert run(FIXTURE.schedules[case.schedule], case.op) == case.expect


@pytest.mark.parametrize(
    "spec",
    [
        ScheduleSpec(
            zone="Pacific/Apia",
            workdays=[RuleSpec("09:00", "17:00", ["mon"])],
            specialdays=[SpecialDaySpec("22:00", "06:00", ["2011-12-29"])],
        ),
        ScheduleSpec(
            zone="Pacific/Apia",
            workdays=[RuleSpec("22:00", "06:00", ["thu"])],
        ),
    ],
    ids=["special_day", "workday"],
)
def test_a_skipped_day_carries_a_shift_two_dates_on(spec: ScheduleSpec) -> None:
    # Apia skipped 2011-12-30, so the shift from 22:00 on the 29th ends at
    # 06:00 on the 31st, local time.
    oracle = Oracle.build(spec)
    a = datetime(2011, 12, 30, 15, tzinfo=UTC)
    assert oracle.between(a, a + timedelta(hours=1)) == timedelta(hours=1)
