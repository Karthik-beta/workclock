"""Conversion of Python time zone objects to IANA names."""

from __future__ import annotations

from datetime import timezone, tzinfo


def zone_name(zone: str | tzinfo) -> str:
    """Return the IANA name of a time zone.

    Accepts a name, a ``zoneinfo.ZoneInfo`` (its ``key``), a pytz zone (its
    ``zone``) and ``datetime.timezone.utc``. Other ``tzinfo`` objects carry no
    IANA name, so they raise ``TypeError``.
    """
    if isinstance(zone, str):
        return zone
    if zone is timezone.utc:
        return "UTC"
    for attribute in ("key", "zone"):
        name = getattr(zone, attribute, None)
        if isinstance(name, str):
            return name
    raise TypeError(
        f"{zone!r} has no IANA name; pass a name such as 'Europe/London', "
        "a zoneinfo.ZoneInfo or a pytz zone"
    )
