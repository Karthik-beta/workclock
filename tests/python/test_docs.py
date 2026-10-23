"""Runs the examples in the package's docstrings."""

import doctest
from types import ModuleType

import pytest
from workclock import _schedule, compat


@pytest.mark.parametrize("module", [_schedule, compat], ids=lambda m: m.__name__)
def test_docstring_examples(module: ModuleType) -> None:
    failed, attempted = doctest.testmod(module)
    assert attempted > 0
    assert failed == 0
