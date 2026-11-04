"""Run one benchmark case for count.py to measure under Valgrind.

    python benchmarks/python/instructions.py CASE IMPLEMENTATION N

The script builds the inputs, makes one warm-up call and then N more, so
subtracting the count for N=0 leaves only the N calls.
"""

import argparse
import itertools
from collections.abc import Callable
from datetime import datetime, timezone

from cases import Between, office, pairs, rules
from workclock import compat

INTERVALS = {
    "single": (
        datetime(2026, 3, 10, 10, 15, tzinfo=timezone.utc),
        datetime(2026, 3, 10, 15, 45, tzinfo=timezone.utc),
    ),
    "year": (
        datetime(2026, 1, 1, tzinfo=timezone.utc),
        datetime(2027, 1, 1, tzinfo=timezone.utc),
    ),
}
IMPLEMENTATIONS: dict[str, Callable[[], Between]] = {
    "workclock": lambda: office().between,
    "workclock.compat": lambda: rules(compat),
}
BATCH_PAIRS = 10_000


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("case", choices=[*INTERVALS, "batch"])
    parser.add_argument("implementation")
    parser.add_argument("n", type=int)
    args = parser.parse_args()
    calls = itertools.repeat(None, args.n + 1)

    if args.case == "batch" and args.implementation == "workclock between_many":
        between_many = office().between_many
        starts, ends = pairs(BATCH_PAIRS)
        for _ in calls:
            between_many(starts, ends)
    elif args.case in INTERVALS and args.implementation in IMPLEMENTATIONS:
        between = IMPLEMENTATIONS[args.implementation]()
        a, b = INTERVALS[args.case]
        for _ in calls:
            between(a, b)
    else:
        parser.error(f"no {args.implementation!r} for {args.case!r}")


if __name__ == "__main__":
    main()
