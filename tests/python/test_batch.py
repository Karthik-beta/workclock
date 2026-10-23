from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import numpy as np
import pytest
from workclock import OutOfRangeError, Schedule, WorkDay

UTC = timezone.utc


@pytest.fixture
def nights() -> Schedule:
    return Schedule([WorkDay(time(22), time(6))])


def utc(day: int, hour: int) -> datetime:
    return datetime(2026, 1, day, hour, tzinfo=UTC)


def test_lists_match_single_calls(nights: Schedule) -> None:
    starts = [utc(5, 20), utc(5, 23), utc(10, 12)]
    ends = [utc(6, 6), utc(5, 20), utc(12, 23)]
    hours = [timedelta(hours=h) for h in (4, -3, 0)]
    assert nights.between_many(starts, ends) == [
        nights.between(a, b) for a, b in zip(starts, ends)
    ]
    assert nights.add_many(starts, hours) == [
        nights.add(t, d) for t, d in zip(starts, hours)
    ]
    assert nights.sub_many(starts, hours) == [
        nights.sub(t, d) for t, d in zip(starts, hours)
    ]


def test_a_single_amount_applies_to_every_datetime(nights: Schedule) -> None:
    starts = [utc(5, 22), utc(6, 22)]
    assert nights.add_many(starts, timedelta(hours=4)) == [utc(6, 2), utc(7, 2)]


def test_results_keep_each_input_tzinfo(nights: Schedule) -> None:
    kolkata = datetime(2026, 1, 6, 3, 30, tzinfo=ZoneInfo("Asia/Kolkata"))
    results = nights.add_many([utc(5, 22), kolkata], timedelta(hours=1))
    assert [r.tzinfo for r in results] == [UTC, ZoneInfo("Asia/Kolkata")]
    assert results == [utc(5, 23), utc(5, 23)]


def test_numpy_arrays_are_read_and_returned_as_utc(nights: Schedule) -> None:
    starts = np.array(["2026-01-05T22:00", "2026-01-06T22:00"], dtype="datetime64[us]")
    ends = np.array(["2026-01-06T06:00", "2026-01-07T06:00"], dtype="datetime64[us]")
    assert nights.between_many(starts, ends).tolist() == [timedelta(hours=8)] * 2
    added = nights.add_many(starts, np.array([4, 5], dtype="timedelta64[h]"))
    assert added.dtype == np.dtype("datetime64[us]")
    assert added.tolist() == [datetime(2026, 1, 6, 2), datetime(2026, 1, 7, 3)]
    subtracted = nights.sub_many(ends, timedelta(hours=4))
    assert subtracted.tolist() == [datetime(2026, 1, 6, 2), datetime(2026, 1, 7, 2)]


def test_numpy_results_keep_the_input_shape(nights: Schedule) -> None:
    grid = np.full((2, 3), np.datetime64("2026-01-05T22:00", "us"))
    assert nights.add_many(grid, timedelta(hours=1)).shape == (2, 3)


def test_bad_batches_are_rejected(nights: Schedule) -> None:
    with pytest.raises(ValueError, match="differ in length"):
        nights.between_many([utc(5, 22)], [])
    with pytest.raises(ValueError, match="naive"):
        nights.between_many([datetime(2026, 1, 5)], [utc(5, 22)])
    with pytest.raises(ValueError, match="NaT"):
        nights.between_many(
            np.array(["NaT"], dtype="datetime64[us]"),
            np.array(["2026-01-05"], dtype="datetime64[us]"),
        )


def test_errors_name_the_failing_item(nights: Schedule) -> None:
    near_end = datetime(9999, 12, 30, 21, tzinfo=UTC)
    with pytest.raises(OutOfRangeError, match="item 1"):
        nights.add_many([utc(5, 22), near_end], timedelta(hours=8))


def test_amounts_past_the_engine_range_name_the_item(nights: Schedule) -> None:
    huge = timedelta(days=999_999_999)
    with pytest.raises(OutOfRangeError, match=r"item 0: amount .* is outside"):
        nights.add_many([utc(5, 22)], huge)
    with pytest.raises(OutOfRangeError, match=r"item 1: amount .* is outside"):
        nights.sub_many([utc(5, 22), utc(5, 22)], [timedelta(hours=1), huge])
