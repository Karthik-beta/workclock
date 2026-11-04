from __future__ import annotations

from datetime import timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo

import pytest
import pytz
from workclock._zones import zone_name


@pytest.mark.parametrize(
    ("zone", "name"),
    [
        ("Asia/Kolkata", "Asia/Kolkata"),
        (ZoneInfo("Europe/London"), "Europe/London"),
        (pytz.timezone("America/New_York"), "America/New_York"),
        (pytz.utc, "UTC"),
        (timezone.utc, "UTC"),
    ],
)
def test_supported_zones_give_their_iana_name(zone: str | tzinfo, name: str) -> None:
    assert zone_name(zone) == name


@pytest.mark.parametrize(
    "zone",
    [
        timezone(timedelta(hours=5, minutes=30)),
        pytz.FixedOffset(330),
    ],
)
def test_zones_without_an_iana_name_are_rejected(zone: tzinfo) -> None:
    with pytest.raises(TypeError, match="has no IANA name"):
        zone_name(zone)
