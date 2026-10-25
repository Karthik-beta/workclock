"""Compare two instruction counts written by benchmarks/python/count.py.

    python benchmarks/compare_instructions.py BASE.json HEAD.json

Prints a Markdown table and exits with status 1 if `single` or `year` uses
more than 3% more instructions in HEAD. `batch` is only reported.
"""

import argparse
import json
from pathlib import Path

LIMIT = 3.0
GATED = {"single", "year"}


def load(path: Path) -> dict[tuple[str, str], int]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {(r["case"], r["implementation"]): r["instructions"] for r in rows}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("base", type=Path)
    parser.add_argument("head", type=Path)
    args = parser.parse_args()
    base, head = load(args.base), load(args.head)

    print("| Case | Implementation | Base | Head | Change |")
    print("|---|---|--:|--:|--:|")
    regressed = []
    for key in [*base, *(k for k in head if k not in base)]:
        case, implementation = key
        old, new = base.get(key), head.get(key)
        if old is None:
            change = "only in head"
        elif new is None:
            change = "only in base"
        else:
            percent = (new - old) / old * 100
            change = f"{percent:+.2f}%"
            if case in GATED and percent > LIMIT:
                regressed.append(f"{case}, {implementation}")
                change += ", over the limit"
        cells = [f"{c:,}" if c is not None else "" for c in (old, new)]
        print(f"| `{case}` | {implementation} | {cells[0]} | {cells[1]} | {change} |")

    if regressed:
        print(f"\nMore than {LIMIT:g}% more instructions: {'; '.join(regressed)}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
