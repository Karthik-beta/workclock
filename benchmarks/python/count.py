"""Count the instructions each Python call executes, under Valgrind's cachegrind.

    uv run python benchmarks/python/count.py instructions.json

Each case runs twice, with N=0 and with N calls, and instructions per call are
the difference divided by N. That removes interpreter start-up, imports and
building the inputs, but keeps the cost of crossing from Python into Rust.
Linux only.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().with_name("instructions.py")
RUNS = [
    ("single", "workclock", 1000),
    ("single", "workclock.compat", 1000),
    ("year", "workclock", 100),
    ("year", "workclock.compat", 100),
    ("batch", "workclock between_many", 1),
]
# The count per call shifts a little with the size of the environment and
# arguments, which move the stack and the heap. Each run gets the same small
# environment, working directory and argument width, so only the calls differ.
# A fixed hash seed keeps dicts and sets laid out the same, and without
# bytecode caches every run compiles the same modules, where otherwise the
# first run of a fresh checkout would pay for writing them. Python's own
# allocator stays on: under PYTHONMALLOC=malloc the shift is ten times larger,
# close to 1%.
ENV = {"PYTHONHASHSEED": "0", "PYTHONDONTWRITEBYTECODE": "1"}
I_REFS = re.compile(r"I\s+refs:\s+([\d,]+)")


def instructions(valgrind: str, case: str, implementation: str, n: str) -> int:
    result = subprocess.run(
        [
            valgrind,
            "--tool=cachegrind",
            "--cache-sim=no",
            "--cachegrind-out-file=/dev/null",
            sys.executable,
            str(SCRIPT),
            case,
            implementation,
            n,
        ],
        env=ENV,
        cwd="/",
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise SystemExit(f"{case} {implementation} {n} failed:\n{result.stderr}")
    match = I_REFS.search(result.stderr)
    if match is None:
        raise SystemExit(f"no instruction count in Valgrind's output:\n{result.stderr}")
    return int(match.group(1).replace(",", ""))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path, help="JSON file to write")
    args = parser.parse_args()
    valgrind = shutil.which("valgrind")
    if valgrind is None:
        raise SystemExit("valgrind is not installed")

    rows = []
    for case, implementation, n in RUNS:
        calls = str(n)
        cost = instructions(valgrind, case, implementation, calls) - instructions(
            valgrind, case, implementation, "0" * len(calls)
        )
        per_call = round(cost / n)
        print(f"{case:<8} {implementation:<24} {per_call:>14,}", flush=True)
        rows.append(
            {"case": case, "implementation": implementation, "instructions": per_call}
        )
    args.output.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
