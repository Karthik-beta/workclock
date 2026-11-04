"""The standard-library baseline in benchmarks/python must agree with workclock."""

from datetime import datetime, timezone

import pytest
import stdlib
from cases import office, pairs


def utc(month: int, day: int, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(2026, month, day, hour, minute, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("a", "b"),
    [
        (utc(3, 10, 10, 15), utc(3, 10, 15, 45)),
        (utc(1, 1), datetime(2027, 1, 1, tzinfo=timezone.utc)),
        (utc(3, 27, 16), utc(3, 30, 10)),
        (utc(10, 23, 16), utc(10, 26, 10)),
        (utc(4, 2, 23, 30), utc(4, 7, 8)),
        (utc(3, 10, 15, 45), utc(3, 9, 10, 15)),
    ],
    ids=["single", "year", "spring-forward", "fall-back", "easter", "reversed"],
)
def test_matches_workclock(a: datetime, b: datetime) -> None:
    assert stdlib.between(a, b) == office().between(a, b)


def test_matches_workclock_on_batch_pairs() -> None:
    starts, ends = pairs(10_000)
    expected = office().between_many(starts, ends)
    assert [stdlib.between(a, b) for a, b in zip(starts, ends)] == expected
