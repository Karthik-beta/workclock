import importlib
from types import ModuleType

import pytest

# Each ported test runs against every implementation listed here.
# workclock.compat joins businesstimedelta once it exists (M5).
IMPLEMENTATIONS = ["businesstimedelta"]


@pytest.fixture(params=IMPLEMENTATIONS)
def btd(request: pytest.FixtureRequest) -> ModuleType:
    return importlib.import_module(request.param)
