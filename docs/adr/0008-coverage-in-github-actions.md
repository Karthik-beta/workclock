# 0008. Coverage in GitHub Actions

- Status: Accepted
- Date: 2026-10-23

## Context

The core engine needs a measured line-coverage figure that CI enforces, so
untested code cannot land unnoticed. The project uses free tooling only and
no external services. At the time of writing the `workclock` crate covers
about 99% of its lines, so a 90% floor catches real regressions without
making ordinary changes fail.

## Decision

- Coverage is measured with cargo-llvm-cov on the `workclock` crate only,
  with all features enabled.
- The `coverage` job fails when line coverage is below 90%.
- The per-file summary is written to the job summary, and `lcov.info` is
  uploaded as an artifact named `lcov`.
- Coverage stays inside GitHub Actions. No coverage service and no token are
  used.

## Consequences

- There is no coverage badge and no pull request comment. Contributors read
  the job summary or download the `lcov` artifact.
- The gate runs after the summary and the upload, so both are available
  when it fails.
- The gate counts lines only. Regions, functions and branches are not
  enforced.
- The bindings crates (`workclock-py`, `workclock-wasm`) are not measured.
  They are thin wrappers, and their own Python and JavaScript test suites
  cover them.
