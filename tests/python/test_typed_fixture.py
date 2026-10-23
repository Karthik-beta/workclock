from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from support.fixture import Add, Between, Build, Case, Op, ScheduleSpec, Sub, load
from support.typed import build, error_kind
from workclock import WorkclockError

FIXTURE = load()


def run(spec: ScheduleSpec, op: Op) -> timedelta | datetime | str | None:
    try:
        schedule = build(spec)
        if isinstance(op, Between):
            return schedule.between(op.a, op.b)
        if isinstance(op, Add):
            return schedule.add(op.t, op.d)
        if isinstance(op, Sub):
            return schedule.sub(op.t, op.d)
        assert isinstance(op, Build)
        return None
    except WorkclockError as e:
        return error_kind(e)


@pytest.mark.parametrize("case", FIXTURE.cases, ids=[c.id for c in FIXTURE.cases])
def test_typed_api_matches_design_example(case: Case) -> None:
    assert run(FIXTURE.schedules[case.schedule], case.op) == case.expect
