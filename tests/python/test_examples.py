"""Runs the examples, so they keep working and printing what they claim."""

import subprocess
import sys
from pathlib import Path

EXAMPLES = Path(__file__).parents[2] / "examples" / "python"


def test_sla() -> None:
    output = subprocess.run(
        [sys.executable, str(EXAMPLES / "sla.py")],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()
    assert output == [
        "opened Thu 24 Dec 16:30, due Wed 30 Dec 09:30",
        "used by Tue 11:00: 2:30:00",
        "working until 12:00",
        "Thu 24 Dec 16:30 -> Wed 30 Dec 09:30",
        "Thu 24 Dec 17:30 -> Wed 30 Dec 10:00",
        "Tue 29 Dec 11:00 -> Wed 30 Dec 12:00",
    ]
