//! The three benchmark cases from `benchmarks/README.md`, shared by the Rust,
//! Python and JavaScript suites.

mod common;

use std::hint::black_box;

use criterion::{criterion_group, criterion_main, Criterion};
use jiff::SignedDuration;

use common::{at, office, pairs};

fn benches(c: &mut Criterion) {
    let schedule = office();

    let (a, b) = (at("2026-03-10T10:15:00Z"), at("2026-03-10T15:45:00Z"));
    c.bench_function("single", |bench| {
        bench.iter(|| schedule.between(black_box(a), black_box(b)));
    });

    let (a, b) = (at("2026-01-01T00:00:00Z"), at("2027-01-01T00:00:00Z"));
    c.bench_function("year", |bench| {
        bench.iter(|| schedule.between(black_box(a), black_box(b)));
    });

    let pairs = pairs(1_000_000);
    let mut group = c.benchmark_group("batch");
    group.sample_size(10);
    group.bench_function("1M", |bench| {
        bench.iter(|| {
            black_box(&pairs)
                .iter()
                .map(|&(a, b)| schedule.between(a, b))
                .sum::<SignedDuration>()
        });
    });
    group.finish();
}

criterion_group!(workclock, benches);
criterion_main!(workclock);
