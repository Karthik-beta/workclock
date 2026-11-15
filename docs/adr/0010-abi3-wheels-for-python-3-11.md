# 0010. abi3 wheels for Python 3.11 and later

- Status: Accepted
- Date: 2026-11-15

## Context

[ADR 0005](0005-abi3-wheels-for-python.md) chose `abi3` wheels with CPython
3.9 as the minimum. Python 3.9 reached end of life on 2025-10-31 and 3.10 on
2026-10-01, so neither gets security fixes any more
([#167](https://github.com/Karthik-beta/workclock/issues/167)). Supporting
them kept a CI job on an unsupported interpreter and kept the Python code on
`Optional`, `Union` and `typing_extensions`.

pip and uv read `Requires-Python`, so users on 3.9 or 3.10 keep resolving to
workclock 0.1.x.

## Decision

The minimum is CPython 3.11, the oldest version that still gets security fixes
(until 2027-10-31). Build the extension with PyO3's `abi3-py311` feature and
publish one `cp311-abi3` wheel per platform, plus an sdist. Everything else in
ADR 0005 stands.

## Consequences

- Raising the minimum Python is a minor-version change and requires a new ADR
  superseding this one.
- The lowest CI job and the release install checks run on 3.11.
- Python code uses `X | Y` unions, `datetime.UTC` and `zip(..., strict=True)`.
