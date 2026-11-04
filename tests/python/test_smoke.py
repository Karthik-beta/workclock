from importlib.metadata import version

import workclock


def test_extension_version_matches_package_metadata() -> None:
    assert workclock.__version__ == version("workclock")
