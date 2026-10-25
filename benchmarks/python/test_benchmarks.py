"""The three cases from `benchmarks/README.md`.

Each runs against workclock's typed API, its businesstimedelta-compatible API
and businesstimedelta 1.0.1 itself.
"""

from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

import businesstimedelta
import holidays
import numpy as np
import pytest
from cases import Between, office, pairs, rules
from pytest_benchmark.fixture import BenchmarkFixture
from workclock import compat

IMPLEMENTATIONS: dict[str, Callable[[], Between]] = {
    "workclock": lambda: office().between,
    "workclock.compat": lambda: rules(compat),
    "businesstimedelta": lambda: rules(businesstimedelta),
}


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


@pytest.mark.benchmark(group="single")
@pytest.mark.parametrize("module", [compat, businesstimedelta], ids=["compat", "btd"])
def test_single_python_holidays(benchmark: BenchmarkFixture, module: Any) -> None:  # noqa: ANN401
    # compat fills the object in for 1970 to 2100: 1,156 dates.
    between = rules(module, holidays.country_holidays("GB", subdiv="ENG"))
    benchmark.extra_info["implementation"] = f"{module.__name__}, python-holidays"
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
