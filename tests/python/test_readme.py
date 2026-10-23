"""Runs the Python code in the repository's README, so the quickstart works."""

import re
from pathlib import Path

import pytest

README = Path(__file__).parents[2] / "README.md"
BLOCKS = re.findall(
    r"^```python\n(.*?)^```$", README.read_text(encoding="utf-8"), re.M | re.S
)


def test_readme_has_python_code() -> None:
    assert BLOCKS


@pytest.mark.parametrize("code", BLOCKS)
def test_readme_python_code_runs(code: str) -> None:
    exec(compile(code, str(README), "exec"), {})
