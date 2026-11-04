# 0000. Record architecture decisions

- Status: Accepted
- Date: 2026-10-22

## Context

workclock ships one Rust core through three registries. Choices such as the
date/time library, the Python ABI and the WASM toolchain constrain each other,
and the reasons behind them are easy to lose.

## Decision

Significant decisions are recorded as Architecture Decision Records in
`docs/adr/`, following Michael Nygard's format
(<https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>).

- Files are named `NNNN-short-title.md` with a zero-padded sequence number.
- New records start from [`template.md`](template.md).
- An accepted record is never edited for substance. A later record supersedes
  it, and the old record's status links to the new one.

## Consequences

Each decision has a stable link that issues, PRs and `DESIGN.md` can cite.
Writing a record adds a small cost to each significant change.
