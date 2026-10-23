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
lists and on NumPy arrays, and businesstimedelta 1.0.1. One round of the
batch case takes businesstimedelta about half an hour; add
`-k "not (test_batch and businesstimedelta)"` to skip it.

The JavaScript suite runs the batch case three ways: `between` in a loop, and
`betweenMany` on arrays of `Date`s and on `Float64Array`s.
