# Benchmark results

Cases and commands are in [README.md](README.md).

| Machine | |
|---|---|
| Date | 2026-10-24 |
| CPU | Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz, 8 logical cores |
| Memory | 24 GiB |
| OS | Windows-11-10.0.26300-SP0 |
| Rust | rustc 1.99.1 (58cf8f9c3 2026-10-13) |
| Python | 3.13.16 |
| Node.js | v26.12.0 |

## single

| Implementation | Median | p95 | Samples |
|---|---|---|---|
| Rust | 1.67 µs | 1.99 µs | 100 |
| JavaScript | 2.2 µs | 2.3 µs | 900773 |
| Python, workclock | 8.5 µs | 17.7 µs | 17986 |
| Python, workclock.compat | 16.1 µs | 36 µs | 6065 |
| Python, workclock.compat, python-holidays | 16.8 µs | 28.5 µs | 970 |
| Python, businesstimedelta | 385 µs | 592 µs | 1907 |
| Python, businesstimedelta, python-holidays | 475 µs | 1.25 ms | 1355 |

## year

| Implementation | Median | p95 | Samples |
|---|---|---|---|
| JavaScript | 137 µs | 147 µs | 14318 |
| Rust | 152 µs | 194 µs | 100 |
| Python, workclock.compat | 160 µs | 246 µs | 3265 |
| Python, workclock | 163 µs | 231 µs | 4491 |
| Python, businesstimedelta | 134 ms | 155 ms | 8 |

## batch

| Implementation | Median | p95 | Samples |
|---|---|---|---|
| Python, workclock between_many, NumPy | 2.92 s | 3.01 s | 5 |
| JavaScript, betweenMany, Float64Array | 3.04 s | 3.07 s | 5 |
| JavaScript, between in a loop | 3.19 s | 3.36 s | 5 |
| JavaScript, betweenMany, Dates | 3.24 s | 3.43 s | 5 |
| Rust | 3.65 s | 4.12 s | 10 |
| Python, workclock between_many | 5.31 s | 5.57 s | 5 |
| Python, workclock | 10.3 s | 10.9 s | 3 |
| Python, workclock.compat | 16.3 s | 16.5 s | 3 |
| Python, businesstimedelta | 22.5 min | 22.5 min | 1 |
