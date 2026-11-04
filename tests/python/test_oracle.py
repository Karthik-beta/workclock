from datetime import datetime, timedelta
from typing import Union

import pytest
from support.fixture import (
    Add,
    Between,
    Build,
    Case,
    NextPeriod,
    Op,
    PreviousPeriod,
    ScheduleSpec,
    Sub,
    load,
)
from support.oracle import Oracle, OracleError

FIXTURE = load()
# E4 walks ten years minute by minute, and P19-P21 a year of working time.
SLOW = {"E4", "P19", "P20", "P21"}

Outcome = Union[timedelta, datetime, tuple[datetime, datetime], str, None]


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
