"""Work out when a support ticket is due and how much of its SLA is used.

Run it with ``uv run python examples/python/sla.py``.
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from workclock import Break, Holidays, Schedule, WorkDay

LONDON = ZoneInfo("Europe/London")

support = Schedule(
    [
        WorkDay(time(9), time(17)),
        Break(time(12), time(13)),
        Holidays([date(2026, 12, 25), date(2026, 12, 28)]),
    ],
    time_zone=LONDON,
)

opened = datetime(2026, 12, 24, 16, 30, tzinfo=LONDON)
due = support.add(opened, hours=8)
print(f"opened {opened:%a %d %b %H:%M}, due {due:%a %d %b %H:%M}")

now = datetime(2026, 12, 29, 11, tzinfo=LONDON)
print(f"used by {now:%a %H:%M}: {support.between(opened, now)}")

_, end = support.next_period(now)
print(f"working until {end:%H:%M}")

# Many tickets at once: one call instead of a Python loop.
tickets = [opened, opened + timedelta(hours=1), now]
for ticket, deadline in zip(tickets, support.add_many(tickets, timedelta(hours=8))):
    print(f"{ticket:%a %d %b %H:%M} -> {deadline:%a %d %b %H:%M}")
