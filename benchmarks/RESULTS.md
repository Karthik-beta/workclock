# Benchmark results

Cases and commands are in [README.md](https://github.com/Karthik-beta/workclock/blob/main/benchmarks/README.md).

| Machine | |
|---|---|
| Date | 2026-10-26 |
| Run | [40285792116](https://github.com/Karthik-beta/workclock/actions/runs/40285792116) |
| Runner | GitHub-hosted ubuntu24, image 20261023.334.3 |
| CPU | AMD EPYC 7763 64-Core Processor, 4 logical cores |
| Memory | 16 GiB |
| OS | Linux-6.17.0-1022-azure-x86_64-with-glibc2.39 |
| Rust | rustc 1.99.1 (58cf8f9c3 2026-10-13) |
| Python | 3.15.1 |
| Node.js | v26.12.1 |

## single

| Implementation | Median | p95 | Samples | vs businesstimedelta | vs stdlib |
|---|---|---|---|---|---|
| Rust | 1.19 µs | 1.2 µs | 100 | 140× | |
| JavaScript | 1.77 µs | 1.81 µs | 1109598 | 95× | 5.1× |
| Python, workclock | 3.96 µs | 4.08 µs | 50564 | 43× | 1× |
| Python, stdlib | 4.01 µs | 4.12 µs | 41903 | 42× | 1× |
| Python, workclock.compat, python-holidays | 6.93 µs | 7.33 µs | 1829 | 24× | 0.58× |
| Python, workclock.compat | 7.24 µs | 14 µs | 9427 | 23× | 0.55× |
| JavaScript, stdlib | 9.06 µs | 9.6 µs | 173166 | 19× | 1× |
| Python, businesstimedelta | 169 µs | 182 µs | 3879 | 1× | 0.024× |
| Python, businesstimedelta, python-holidays | 196 µs | 210 µs | 2790 | 0.86× | 0.02× |

## year

| Implementation | Median | p95 | Samples | vs businesstimedelta | vs stdlib |
|---|---|---|---|---|---|
| Rust | 84.5 µs | 86.9 µs | 100 | 630× | |
| Python, workclock | 85.4 µs | 96.1 µs | 8093 | 620× | 8.4× |
| Python, workclock.compat | 88.7 µs | 100 µs | 5481 | 600× | 8.1× |
| JavaScript | 106 µs | 114 µs | 18747 | 500× | 16× |
| Python, stdlib | 719 µs | 747 µs | 1256 | 74× | 1× |
| JavaScript, stdlib | 1.71 ms | 1.74 ms | 891 | 31× | 1× |
| Python, businesstimedelta | 53 ms | 54.7 ms | 19 | 1× | 0.014× |

## batch

| Implementation | Median | p95 | Samples | vs businesstimedelta | vs stdlib |
|---|---|---|---|---|---|
| Rust | 1.96 s | 1.97 s | 10 | 300× | |
| Python, workclock between_many, NumPy | 2.13 s | 2.15 s | 5 | 280× | 4.7× |
| JavaScript, betweenMany, Float64Array | 2.54 s | 2.55 s | 5 | 230× | 15× |
| JavaScript, between in a loop | 2.68 s | 2.68 s | 5 | 220× | 14× |
| JavaScript, betweenMany, Dates | 2.68 s | 2.71 s | 5 | 220× | 14× |
| Python, workclock between_many | 3.42 s | 3.45 s | 5 | 170× | 2.9× |
| Python, workclock | 4.6 s | 4.62 s | 3 | 130× | 2.2× |
| Python, workclock.compat | 7.99 s | 8.01 s | 3 | 74× | 1.2× |
| Python, stdlib | 9.95 s | 9.95 s | 3 | 60× | 1× |
| JavaScript, stdlib | 38.3 s | 39 s | 5 | 16× | 1× |
| Python, businesstimedelta | 9.9 min | 9.9 min | 1 | 1× | 0.017× |
