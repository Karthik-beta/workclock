# Benchmarks

The Rust, Python and JavaScript suites measure the same three cases, all with
one schedule: Europe/London, Monday to Friday 09:00–17:00, a 12:00–13:00
break, and the bank holidays of England in 2026 and 2027. The 2027 ones are
there because businesstimedelta 1.0.1 raises `TypeError` for instants after
its last holiday (upstream issue 8).

| Case | Call |
|---|---|
| `single` | `between` Tuesday 2026-03-10 10:15 and 15:45 UTC |
| `year` | `between` 2026-01-01 and 2027-01-01 UTC |
| `batch` | `between` for 1,000,000 pairs: pair `i` starts `i * 7919 mod 525600` minutes into 2026 and lasts `i * 104729 mod 10080` minutes |

Building the schedule and the pairs is not timed.

## Running

```sh
cargo bench -p workclock --bench workclock
uv run pytest benchmarks/python
cd js && npm run build:node && npm run bench
```

The Python suite also measures workclock's `compat` API, `between_many` on
lists and on NumPy arrays, and businesstimedelta 1.0.1. It runs the single case
on `compat` and businesstimedelta a second time with a python-holidays object
for England in place of the list; `compat` fills it in for 1970 to 2100. One
round of the batch case takes businesstimedelta about half an hour; add
`-k "not (test_batch and businesstimedelta)"` to skip it.

The JavaScript suite runs the batch case three ways: `between` in a loop, and
`betweenMany` on arrays of `Date`s and on `Float64Array`s.

## Instruction counts

A second Rust suite counts the instructions each case executes, with
[gungraun](https://crates.io/crates/gungraun) running it under Valgrind's
Callgrind. Unlike a time, the count repeats exactly from run to run of the same
build, so it can catch a small slowdown in a pull request. `batch` uses 10,000
pairs here instead of 1,000,000: code under Valgrind runs far slower, and the
cost per pair is what matters.

Valgrind does not run on Windows; WSL works. gungraun needs Rust 1.88 or
later. Install `gungraun-runner` at the version of `gungraun` in `Cargo.lock`;
the runner refuses any other version.

```sh
cargo install --locked --version <gungraun version in Cargo.lock> gungraun-runner
cargo bench -p workclock --bench instructions
```

Each run compares itself with the previous one. To compare two commits, run
the first with `-- --save-baseline=base` and the second with
`-- --baseline=base`. If `single` or `year` uses more than 3% more
instructions, the run fails with exit status 3; `batch` only reports the
change.

## Results

[RESULTS.md](RESULTS.md) has the latest numbers and the machine they ran on.
To regenerate it, run the three suites with their JSON output and combine
them:

```sh
cargo bench -p workclock --bench workclock
uv run pytest benchmarks/python --benchmark-json=python.json
cd js && npm run build:node && node bench/bench.js ../js.json && cd ..
uv run python benchmarks/report.py python.json js.json > benchmarks/RESULTS.md
```
