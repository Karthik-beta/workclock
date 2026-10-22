# 0005. abi3 wheels for Python

- Status: Accepted
- Date: 2026-10-22

## Context

workclock supports CPython 3.9 and later. Version-specific wheels would mean
one wheel per Python version per platform: six versions (3.9 to 3.14) across
seven platform targets, and a new release every time a CPython version comes
out.

CPython's limited API and stable ABI (`abi3`) let one wheel per platform load
on every version from its minimum onwards. PyO3 supports it with the
`abi3-py39` feature, and maturin tags the wheels accordingly.

## Decision

Build the extension with PyO3's `abi3-py39` feature and publish one `cp39-abi3`
wheel per platform, plus an sdist.

## Consequences

- Seven wheels per release instead of forty-two, and new CPython
  versions work without a release.
- The limited API is slightly slower than the full API for some calls. Batch
  functions keep the number of FFI crossings, and therefore this cost, small.
- Free-threaded CPython builds cannot load `abi3` wheels. PEP 803's `abi3t`
  covers them from Python 3.15; adding it is a later, additive change.
