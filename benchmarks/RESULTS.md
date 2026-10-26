# Benchmark results

Cases and commands are in [README.md](https://github.com/Karthik-beta/workclock/blob/main/benchmarks/README.md).

| Machine | |
|---|---|
| Date | 2026-10-26 |
| Run | [40265875573](https://github.com/Karthik-beta/workclock/actions/runs/40265875573) |
| Runner | GitHub-hosted ubuntu24, image 20261023.334.3 |
| CPU | AMD EPYC 7763 64-Core Processor, 4 logical cores |
| Memory | 16 GiB |
| OS | Linux-6.17.0-1022-azure-x86_64-with-glibc2.39 |
| Rust | rustc 1.99.1 (58cf8f9c3 2026-10-13) |
| Python | 3.15.1 |
| Node.js | v24.21.0 |

## single

| Implementation | Median | p95 | Samples | vs businesstimedelta |
|---|---|---|---|---|
| Rust | 1.2 µs | 1.22 µs | 100 | 140× |
| JavaScript | 1.78 µs | 1.82 µs | 1104052 | 94× |
| Python, workclock | 3.89 µs | 4.16 µs | 47304 | 43× |
| Python, workclock.compat | 6.78 µs | 7.17 µs | 8981 | 25× |
| Python, workclock.compat, python-holidays | 6.78 µs | 7.3 µs | 1921 | 25× |
| Python, businesstimedelta | 167 µs | 181 µs | 3492 | 1× |
| Python, businesstimedelta, python-holidays | 193 µs | 206 µs | 2815 | 0.87× |

## year

| Implementation | Median | p95 | Samples | vs businesstimedelta |
|---|---|---|---|---|
| Rust | 84.9 µs | 85.5 µs | 100 | 600× |
| Python, workclock | 85 µs | 95.4 µs | 8616 | 600× |
| Python, workclock.compat | 88.1 µs | 99.4 µs | 5834 | 580× |
| JavaScript | 107 µs | 116 µs | 18733 | 480× |
| Python, businesstimedelta | 50.8 ms | 52.2 ms | 20 | 1× |

## batch

| Implementation | Median | p95 | Samples | vs businesstimedelta |
|---|---|---|---|---|
| Rust | 1.95 s | 1.97 s | 10 | 300× |
| Python, workclock between_many, NumPy | 2.11 s | 2.13 s | 5 | 280× |
| JavaScript, betweenMany, Float64Array | 2.55 s | 2.6 s | 5 | 230× |
| JavaScript, between in a loop | 2.62 s | 2.64 s | 5 | 230× |
| JavaScript, betweenMany, Dates | 2.68 s | 2.7 s | 5 | 220× |
| Python, workclock between_many | 3.4 s | 3.43 s | 5 | 170× |
| Python, workclock | 4.51 s | 4.53 s | 3 | 130× |
| Python, workclock.compat | 7.91 s | 8.07 s | 3 | 75× |
| Python, businesstimedelta | 9.86 min | 9.86 min | 1 | 1× |
