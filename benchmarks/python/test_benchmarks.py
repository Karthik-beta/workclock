"""The three cases from `benchmarks/README.md`.

Each runs against workclock's typed API, its businesstimedelta-compatible API
and businesstimedelta 1.0.1 itself.
"""

from collections.abc import Callable
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

import businesstimedelta
import numpy as np
import pytest
import pytz
import workclock
from pytest_benchmark.fixture import BenchmarkFixture
from workclock import compat

LONDON = pytz.timezone("Europe/London")
HOLIDAYS = [
    date(2026, 1, 1),
    date(2026, 4, 3),
    date(2026, 4, 6),
    date(2026, 5, 4),
    date(2026, 5, 25),
    date(2026, 8, 31),
    date(2026, 12, 25),
    date(2026, 12, 28),
    date(2027, 1, 1),
    date(2027, 3, 26),
    date(2027, 3, 29),
    date(2027, 5, 3),
    date(2027, 5, 31),
    date(2027, 8, 30),
    date(2027, 12, 27),
    date(2027, 12, 28),
]
WEEKDAYS = [0, 1, 2, 3, 4]
BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)

Between = Callable[[datetime, datetime], Any]


def office() -> workclock.Schedule:
    return workclock.Schedule(
        [
            workclock.WorkDay(time(9), time(17)),
            workclock.Break(time(12), time(13)),
            workclock.Holidays(HOLIDAYS),
        ],
        time_zone="Europe/London",
    )


def rules(module: Any) -> Between:  # noqa: ANN401
    days = {"working_days": WEEKDAYS, "tz": LONDON}
    difference: Between = module.Rules(
        [
            module.WorkDayRule(start_time=time(9), end_time=time(17), **days),
            module.LunchTimeRule(start_time=time(12), end_time=time(13), **days),
            module.HolidayRule(HOLIDAYS, tz=LONDON),
        ]
    ).difference
    return difference


IMPLEMENTATIONS: dict[str, Callable[[], Between]] = {
    "workclock": lambda: office().between,
    "workclock.compat": lambda: rules(compat),
    "businesstimedelta": lambda: rules(businesstimedelta),
}


def pairs(n: int) -> tuple[list[datetime], list[datetime]]:
    starts = [BASE + timedelta(minutes=i * 7919 % 525_600) for i in range(n)]
    ends = [s + timedelta(minutes=i * 104_729 % 10_080) for i, s in enumerate(starts)]
    return starts, ends


@pytest.fixture(params=list(IMPLEMENTATIONS))
def between(request: pytest.FixtureRequest) -> Between:
    benchmark: BenchmarkFixture = request.getfixturevalue("benchmark")
    benchmark.extra_info["implementation"] = request.param
    return IMPLEMENTATIONS[request.param]()


@pytest.mark.benchmark(group="single")
def test_single(benchmark: BenchmarkFixture, between: Between) -> None:
    a = datetime(2026, 3, 10, 10, 15, tzinfo=timezone.utc)
    b = datetime(2026, 3, 10, 15, 45, tzinfo=timezone.utc)
    benchmark(between, a, b)


@pytest.mark.benchmark(group="year")
def test_year(benchmark: BenchmarkFixture, between: Between) -> None:
    a = datetime(2026, 1, 1, tzinfo=timezone.utc)
    b = datetime(2027, 1, 1, tzinfo=timezone.utc)
    benchmark(between, a, b)


@pytest.mark.benchmark(group="batch")
def test_batch(benchmark: BenchmarkFixture, between: Between) -> None:
    starts, ends = pairs(1_000_000)
    # businesstimedelta takes about half an hour for one round.
    slow = benchmark.extra_info["implementation"] == "businesstimedelta"
    benchmark.pedantic(
        lambda: [between(a, b) for a, b in zip(starts, ends)], rounds=1 if slow else 3
    )


@pytest.mark.benchmark(group="batch")
def test_batch_many(benchmark: BenchmarkFixture) -> None:
    schedule = office()
    starts, ends = pairs(1_000_000)
    benchmark.extra_info["implementation"] = "workclock between_many"
    benchmark.pedantic(schedule.between_many, (starts, ends), rounds=5)


@pytest.mark.benchmark(group="batch")
def test_batch_numpy(benchmark: BenchmarkFixture) -> None:
    schedule = office()
    i = np.arange(1_000_000, dtype=np.int64)
    starts = np.datetime64("2026-01-01T00:00") + (i * 7919 % 525_600).astype("m8[m]")
    ends = starts + (i * 104_729 % 10_080).astype("m8[m]")
    benchmark.extra_info["implementation"] = "workclock between_many, NumPy"
    benchmark.pedantic(schedule.between_many, (starts, ends), rounds=5)
