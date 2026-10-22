import importlib
from types import ModuleType

import pytest

# Tests that take `btd` run against every implementation listed here.
# workclock.compat joins businesstimedelta once it exists (M5).
IMPLEMENTATIONS = ["businesstimedelta"]


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "upstream_bug(reason, raises): known to fail on businesstimedelta 1.0.1",
    )


@pytest.fixture(params=IMPLEMENTATIONS)
def btd(request: pytest.FixtureRequest) -> ModuleType:
    return importlib.import_module(request.param)


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """Expect `upstream_bug` tests to fail on businesstimedelta, strictly.

    A strict xfail errors if the test starts passing, so these tests also prove
    the bug still exists in 1.0.1.
    """
    for item in items:
        marker = item.get_closest_marker("upstream_bug")
        callspec = getattr(item, "callspec", None)
        if marker and callspec and callspec.params.get("btd") == "businesstimedelta":
            item.add_marker(pytest.mark.xfail(strict=True, **marker.kwargs))
