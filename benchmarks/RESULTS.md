# Benchmark results

Cases and commands are in [README.md](README.md).

| Machine | |
|---|---|
| Date | 2026-10-23 |
| CPU | Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz, 8 logical cores |
| Memory | 24 GiB |
| OS | Windows-11-10.0.26300-SP0 |
| Rust | rustc 1.99.1 (58cf8f9c3 2026-10-13) |
| Python | 3.13.16 |
| Node.js | v26.12.0 |

## single

| Implementation | Median | p95 | Samples |
|---|---|---|---|
| Rust | 2.14 µs | 2.97 µs | 100 |
| JavaScript | 2.5 µs | 3.2 µs | 742918 |
| Python, workclock | 8.2 µs | 9.3 µs | 16340 |
| Python, workclock.compat | 55.6 µs | 68.9 µs | 7419 |
| Python, businesstimedelta | 388 µs | 468 µs | 2120 |

## year

| Implementation | Median | p95 | Samples |
|---|---|---|---|
| Python, workclock | 137 µs | 157 µs | 5480 |
| JavaScript | 160 µs | 204 µs | 12134 |
| Rust | 172 µs | 280 µs | 100 |
| Python, workclock.compat | 177 µs | 221 µs | 4330 |
| Python, businesstimedelta | 217 ms | 505 ms | 8 |

## batch

| Implementation | Median | p95 | Samples |
|---|---|---|---|
| Rust | 3.22 s | 4.82 s | 10 |
| Python, workclock between_many, NumPy | 3.34 s | 3.57 s | 5 |
| JavaScript, betweenMany, Float64Array | 3.52 s | 3.54 s | 5 |
| JavaScript, between in a loop | 3.71 s | 4.35 s | 5 |
| JavaScript, betweenMany, Dates | 3.72 s | 3.83 s | 5 |
| Python, workclock between_many | 5.93 s | 5.99 s | 5 |
| Python, workclock | 9.69 s | 9.83 s | 3 |
| Python, workclock.compat | 72.2 s | 83.3 s | 3 |
| Python, businesstimedelta | 24.5 min | 24.5 min | 1 |
