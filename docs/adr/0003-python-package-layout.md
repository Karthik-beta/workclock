# 0003. Python package layout

- Status: Accepted
- Date: 2026-10-22

## Context

The Python package needs pure-Python code (`workclock.compat`, helpers that
accept `ZoneInfo` or pytz zones), type stubs and a compiled extension. maturin
supports either a pure-Rust project, where the extension is the whole package,
or a mixed project with a Python source directory.

## Decision

- Mixed layout: Python sources live in `python/workclock/`, and the compiled
  extension is the private module `workclock._workclock`, built from
  `crates/workclock-py`.
- The public API is defined in Python and re-exports from `_workclock`. Stubs
  for the extension live in `_workclock.pyi`, and `py.typed` marks the package
  as typed (PEP 561).
- `pyproject.toml` sits at the repository root so that `uv sync`, `uv run`
  and `pip install .` work without extra arguments.
- `[tool.uv] cache-keys` lists the Rust sources, so uv rebuilds the extension
  when they change instead of reusing a stale build.

## Consequences

- Pure-Python features, such as the businesstimedelta compatibility layer,
  need no Rust changes.
- A smoke test compares `workclock.__version__` (compiled in from Cargo) with
  the installed package metadata, which catches a build where the two disagree.
