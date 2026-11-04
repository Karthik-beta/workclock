//! When is a support ticket due, and how much of its SLA has been used?
//!
//! ```sh
//! cargo run -p workclock --example sla
//! ```

use jiff::civil::{date, time};
use jiff::{SignedDuration, Zoned};
use workclock::{Break, Holidays, Schedule, Weekdays, WorkDay};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let days = Weekdays::MON_TO_FRI;
    let support = Schedule::builder()
        .time_zone("Europe/London")
        .rule(WorkDay::new(time(9, 0, 0, 0), time(17, 0, 0, 0), days))
        .rule(Break::new(time(12, 0, 0, 0), time(13, 0, 0, 0), days))
        .rule(Holidays::new([date(2026, 12, 25), date(2026, 12, 28)]))
        .build()?;

    let opened: Zoned = "2026-12-24T16:30[Europe/London]".parse()?;
    let due = support.add(&opened, SignedDuration::from_hours(8))?;
    let due = due.to_zoned(opened.time_zone().clone());
    println!(
        "opened {}, due {}",
        opened.strftime("%a %d %b %H:%M"),
        due.strftime("%a %d %b %H:%M")
    );

    let now: Zoned = "2026-12-29T11:00[Europe/London]".parse()?;
    println!(
        "used by {}: {:#}",
        now.strftime("%a %H:%M"),
        support.between(&opened, &now)
    );

    let next = support.next_period(&now)?;
    let end = next.end.to_zoned(now.time_zone().clone());
    println!("working until {}", end.strftime("%H:%M"));
    Ok(())
}
