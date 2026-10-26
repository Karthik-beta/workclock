"""Collect the three suites' results into one Markdown report.

    cargo bench -p workclock --bench workclock
    uv run pytest benchmarks/python --benchmark-json=python.json
    cd js && npm run build:node && npm run bench -- ../js.json && cd ..
    uv run python benchmarks/report.py python.json js.json > benchmarks/RESULTS.md

Medians and p95 come from each suite's raw samples. For criterion a sample is
the mean of one batch of iterations, so its p95 understates single-call tails.
"""

import ctypes
import json
import os
import platform
import statistics
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).parents[1]
CASES = ["single", "year", "batch"]
# Absolute, because the report is also shown on a workflow run's summary page.
README = "https://github.com/Karthik-beta/workclock/blob/main/benchmarks/README.md"


class Row(NamedTuple):
    case: str
    implementation: str
    median: float
    p95: float
    samples: int


def percentile(values: list[float], q: float) -> float:
    """Interpolate between the closest ranks, as NumPy does by default."""
    values = sorted(values)
    rank = (len(values) - 1) * q
    low = int(rank)
    high = min(low + 1, len(values) - 1)
    return values[low] + (values[high] - values[low]) * (rank - low)


def row(case: str, implementation: str, seconds: list[float]) -> Row:
    return Row(
        case,
        implementation,
        statistics.median(seconds),
        percentile(seconds, 0.95),
        len(seconds),
    )


def rust() -> list[Row]:
    rows = []
    for case, path in [("single", "single"), ("year", "year"), ("batch", "batch/1M")]:
        sample = json.loads(
            (ROOT / "target" / "criterion" / path / "new" / "sample.json").read_text()
        )
        seconds = [t / n / 1e9 for t, n in zip(sample["times"], sample["iters"])]
        rows.append(row(case, "Rust", seconds))
    return rows


def python(path: Path) -> list[Row]:
    rows = []
    for bench in json.loads(path.read_text())["benchmarks"]:
        implementation = "Python, " + bench["extra_info"]["implementation"]
        rows.append(row(bench["group"], implementation, bench["stats"]["data"]))
    return rows


def javascript(path: Path) -> list[Row]:
    rows = []
    for result in json.loads(path.read_text()):
        case, _, how = result["name"].partition(": ")
        implementation = "JavaScript" + (f", {how}" if how else "")
        rows.append(
            Row(
                case,
                implementation,
                result["median_ms"] / 1e3,
                result["p95_ms"] / 1e3,
                result["samples"],
            )
        )
    return rows


def duration(seconds: float) -> str:
    if seconds >= 100:
        return f"{seconds / 60:.3g} min"
    for unit, scale in [("s", 1.0), ("ms", 1e-3), ("µs", 1e-6)]:
        if seconds >= scale:
            return f"{seconds / scale:.3g} {unit}"
    return f"{seconds / 1e-9:.3g} ns"


def command(*args: str) -> str:
    try:
        return subprocess.run(
            args, capture_output=True, text=True, check=True
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def cpu() -> str:
    if sys.platform == "win32":
        import winreg

        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"HARDWARE\DESCRIPTION\System\CentralProcessor\0",
        )
        return str(winreg.QueryValueEx(key, "ProcessorNameString")[0]).strip()
    if sys.platform == "darwin":
        return command("sysctl", "-n", "machdep.cpu.brand_string")
    for line in Path("/proc/cpuinfo").read_text().splitlines():
        if line.startswith("model name"):
            return line.partition(":")[2].strip()
    return platform.processor() or "unknown"


def memory() -> str:
    if sys.platform == "win32":

        class Status(ctypes.Structure):
            _fields_ = [
                ("length", ctypes.c_ulong),
                ("load", ctypes.c_ulong),
                ("total", ctypes.c_ulonglong),
                ("rest", ctypes.c_ulonglong * 6),
            ]

        status = Status(length=ctypes.sizeof(Status))
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status))
        total = status.total
    elif sys.platform == "darwin":
        total = int(command("sysctl", "-n", "hw.memsize"))
    else:
        total = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
    return f"{total / 2**30:.0f} GiB"


def machine() -> list[tuple[str, str]]:
    rows = [("Date", date.today().isoformat())]
    # Set on GitHub Actions; a local run has neither row.
    if run_id := os.environ.get("GITHUB_RUN_ID"):
        server = os.environ["GITHUB_SERVER_URL"]
        repository = os.environ["GITHUB_REPOSITORY"]
        url = f"{server}/{repository}/actions/runs/{run_id}"
        rows.append(("Run", f"[{run_id}]({url})"))
    if image := os.environ.get("ImageOS"):
        version = os.environ.get("ImageVersion", "unknown")
        rows.append(("Runner", f"GitHub-hosted {image}, image {version}"))
    return [
        *rows,
        ("CPU", f"{cpu()}, {os.cpu_count()} logical cores"),
        ("Memory", memory()),
        ("OS", platform.platform()),
        ("Rust", command("rustc", "--version")),
        ("Python", platform.python_version()),
        ("Node.js", command("node", "--version")),
    ]


def report(rows: list[Row]) -> str:
    lines = ["# Benchmark results", ""]
    lines += [f"Cases and commands are in [README.md]({README}).", ""]
    lines += ["| Machine | |", "|---|---|"]
    lines += [f"| {k} | {v} |" for k, v in machine()]
    for case in CASES:
        lines += ["", f"## {case}", ""]
        lines += ["| Implementation | Median | p95 | Samples |", "|---|---|---|---|"]
        for r in sorted((r for r in rows if r.case == case), key=lambda r: r.median):
            lines.append(
                f"| {r.implementation} | {duration(r.median)} "
                f"| {duration(r.p95)} | {r.samples} |"
            )
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    python_json, js_json = map(Path, sys.argv[1:3])
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    print(report(rust() + python(python_json) + javascript(js_json)), end="")
