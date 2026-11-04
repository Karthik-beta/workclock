"""Builds typed-API schedules from fixture specs."""

from datetime import time

from workclock import (
    Break,
    Holidays,
    NoWorkingTimeError,
    OutOfRangeError,
    Schedule,
    UnknownZoneError,
    WorkclockError,
    WorkDay,
)

from support.fixture import RuleSpec, ScheduleSpec

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _hours(rule: RuleSpec) -> tuple[time, time, list[int]]:
    days = [WEEKDAYS.index(d) for d in rule.days]
    return time.fromisoformat(rule.start), time.fromisoformat(rule.end), days


def build(spec: ScheduleSpec) -> Schedule:
    rules: list[WorkDay | Break | Holidays] = []
    for r in spec.workdays:
        rules.append(WorkDay(*_hours(r), time_zone=r.zone))
    for r in spec.breaks:
        rules.append(Break(*_hours(r), time_zone=r.zone))
    for h in spec.holidays:
        rules.append(Holidays(h.all_dates(), time_zone=h.zone))
    return Schedule(rules, time_zone=spec.zone)


def error_kind(error: WorkclockError) -> str:
    """The fixture's name for an error."""
    kinds: dict[type[WorkclockError], str] = {
        NoWorkingTimeError: "no_working_time",
        OutOfRangeError: "out_of_range",
        UnknownZoneError: "unknown_zone",
    }
    return kinds[type(error)]
