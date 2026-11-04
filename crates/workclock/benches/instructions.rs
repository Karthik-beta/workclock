//! Instruction counts for the three cases in `benchmarks/README.md`, measured
//! with Callgrind on 10,000 pairs for `batch`. That file says how to run them.

mod common;

use std::hint::black_box;

use gungraun::prelude::*;
use gungraun::{Callgrind, EventKind};
use jiff::{SignedDuration, Timestamp};
use workclock::Schedule;

use common::{at, office, pairs};

// The inputs are leaked so that dropping them is not counted.

fn interval(start: &str, end: &str) -> (&'static Schedule, Timestamp, Timestamp) {
    (Box::leak(Box::new(office())), at(start), at(end))
}

fn batch_input(n: i64) -> (&'static Schedule, &'static [(Timestamp, Timestamp)]) {
    (Box::leak(Box::new(office())), pairs(n).leak())
}

#[library_benchmark]
#[bench::single(args = ("2026-03-10T10:15:00Z", "2026-03-10T15:45:00Z"), setup = interval)]
#[bench::year(args = ("2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z"), setup = interval)]
fn between((schedule, a, b): (&Schedule, Timestamp, Timestamp)) -> SignedDuration {
    black_box(schedule.between(black_box(a), black_box(b)))
}

#[library_benchmark]
#[bench::batch(args = (10_000), setup = batch_input)]
fn batch((schedule, pairs): (&Schedule, &[(Timestamp, Timestamp)])) -> SignedDuration {
    // Callgrind counts only inside functions matching
    // `*::__gungraun_wrapper_mod::*`, and entering a closure defined here
    // would toggle counting off, so this is a loop rather than `map` and `sum`.
    let mut total = SignedDuration::ZERO;
    for &(a, b) in black_box(pairs) {
        total += schedule.between(a, b);
    }
    black_box(total)
}

library_benchmark_group!(
    name = per_call,
    config = LibraryBenchmarkConfig::default()
        .tool(Callgrind::default().soft_limits([(EventKind::Ir, 3.0)])),
    benchmarks = [between]
);

library_benchmark_group!(name = many, benchmarks = [batch]);

main!(library_benchmark_groups = per_call, many);
