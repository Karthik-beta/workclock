# 0007. businesstimedelta compatibility strategy

- Status: Accepted
- Date: 2026-10-22

## Context

workclock is meant to replace businesstimedelta 1.0.1 with a one-line change:
`import workclock.compat as businesstimedelta`. Some of 1.0.1's behaviour is
wrong (overnight shifts, crashes past the last holiday, infinite loops), and
some is merely different from the typed API (always-positive `difference`,
zero-duration snapping). Users may depend on either kind.

## Decision

- `workclock.compat` is pure Python on top of the typed engine (ADR 0003). It
  mirrors 1.0.1's classes, arguments, defaults, operators and properties,
  including the `next` and `previous` methods on rules that upstream's own
  tests call.
- A 1.0.1 behaviour is **kept** if a caller could reasonably rely on it and
  upstream's tests or documentation describe it. It is **fixed** if it raises,
  hangs, or contradicts upstream's documentation, such as overnight shifts,
  which upstream documents as supported.
- Correctness is enforced by differential tests against businesstimedelta
  1.0.1 where 1.0.1 is correct, and against the brute-force oracle where
  workclock intentionally differs.
- Every intentional difference is listed in
  [MIGRATING.md](../../MIGRATING.md#intentional-differences), and
  [DESIGN.md](../../DESIGN.md#compatibility-layer) specifies compat's
  behaviour with examples.

## Consequences

- Existing code keeps working, and broken cases start returning correct
  results.
- Compat carries a few behaviours the typed API rejects, such as the
  always-positive `difference`. New code should use the typed API.
- Any new behaviour difference needs a `MIGRATING.md` entry and a test on both
  sides of the differential suite.
