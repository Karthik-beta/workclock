"""Runs the Python code in the READMEs, so the quickstarts work.

The repository's README is shown on GitHub, and python/README.md on PyPI.
"""

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[2]
READMES = [ROOT / "README.md", ROOT / "python" / "README.md"]
BLOCKS = [
    (readme, code)
    for readme in READMES
    for code in re.findall(
        r"^```python\n(.*?)^```$", readme.read_text(encoding="utf-8"), re.M | re.S
    )
]


@pytest.mark.parametrize("readme", READMES, ids=lambda p: p.parent.name)
def test_readme_has_python_code(readme: Path) -> None:
    assert any(path == readme for path, _ in BLOCKS)


@pytest.mark.parametrize(("readme", "code"), BLOCKS)
def test_readme_python_code_runs(readme: Path, code: str) -> None:
    exec(compile(code, str(readme), "exec"), {})
