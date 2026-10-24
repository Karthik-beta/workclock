"""Loader for `tests/fixtures/design_examples.json`."""

import json
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional, Union

PATH = Path(__file__).parents[2] / "fixtures" / "design_examples.json"


@dataclass(frozen=True)
class RuleSpec:
    start: str
    end: str
    days: list[str]
    zone: Optional[str] = None


@dataclass(frozen=True)
class HolidaySpec:
    dates: list[str] = field(default_factory=list)
    ranges: list[list[str]] = field(default_factory=list)
    zone: Optional[str] = None

    def all_dates(self) -> set[date]:
        """Every date listed or inside a range."""
        dates = {date.fromisoformat(d) for d in self.dates}
        for start, end in self.ranges:
            d = date.fromisoformat(start)
            while d <= date.fromisoformat(end):
                dates.add(d)
                d += timedelta(days=1)
        return dates


@dataclass(frozen=True)
class ScheduleSpec:
    zone: str
    workdays: list[RuleSpec] = field(default_factory=list)
    breaks: list[RuleSpec] = field(default_factory=list)
    holidays: list[HolidaySpec] = field(default_factory=list)

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "ScheduleSpec":
        return cls(
            zone=data["zone"],
            workdays=[RuleSpec(**r) for r in data.get("workdays", [])],
            breaks=[RuleSpec(**r) for r in data.get("breaks", [])],
            holidays=[HolidaySpec(**h) for h in data.get("holidays", [])],
        )


@dataclass(frozen=True)
class Between:
    a: datetime
    b: datetime


@dataclass(frozen=True)
class Add:
    t: datetime
    d: timedelta


@dataclass(frozen=True)
class Sub:
    t: datetime
    d: timedelta


@dataclass(frozen=True)
class NextPeriod:
    t: datetime


@dataclass(frozen=True)
class PreviousPeriod:
    t: datetime


@dataclass(frozen=True)
class Build:
    pass


Op = Union[Between, Add, Sub, NextPeriod, PreviousPeriod, Build]
# A `between` result, an `add`/`sub` result, a period, or the kind of error.
Expect = Union[timedelta, datetime, tuple[datetime, datetime], str]


@dataclass(frozen=True)
class Case:
    id: str
    schedule: str
    op: Op
    expect: Expect


@dataclass(frozen=True)
class Fixture:
    schedules: dict[str, ScheduleSpec]
    cases: list[Case]


def instant(text: str) -> datetime:
    # Python 3.9's fromisoformat does not accept a "Z" suffix.
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def _op(case: dict[str, Any]) -> Op:
    if case["op"] == "between":
        return Between(instant(case["a"]), instant(case["b"]))
    if case["op"] == "add":
        return Add(instant(case["t"]), timedelta(seconds=case["seconds"]))
    if case["op"] == "sub":
        return Sub(instant(case["t"]), timedelta(seconds=case["seconds"]))
    if case["op"] == "next_period":
        return NextPeriod(instant(case["t"]))
    if case["op"] == "previous_period":
        return PreviousPeriod(instant(case["t"]))
    assert case["op"] == "build", case["op"]
    return Build()


def _expect(expect: dict[str, Any]) -> Expect:
    if "seconds" in expect:
        return timedelta(seconds=expect["seconds"])
    if "instant" in expect:
        return instant(expect["instant"])
    if "period" in expect:
        start, end = expect["period"]
        return instant(start), instant(end)
    return str(expect["error"])


def load() -> Fixture:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    return Fixture(
        schedules={
            name: ScheduleSpec.from_json(s) for name, s in data["schedules"].items()
        },
        cases=[
            Case(c["id"], c["schedule"], _op(c), _expect(c["expect"]))
            for c in data["cases"]
        ],
    )
