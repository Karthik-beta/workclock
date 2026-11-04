# 0002. Pin GitHub Actions by commit SHA

- Status: Accepted
- Date: 2026-10-22

## Context

A tag such as `actions/checkout@v7` can be moved to different code by whoever
controls the action's repository. The release workflow will hold publishing
credentials for crates.io, PyPI and npm, so a compromised action could publish
malicious packages under our names.

## Decision

- Every third-party action is referenced by full commit SHA, with the release
  tag in a trailing comment (`uses: owner/action@<sha> # vX.Y.Z`).
- Workflows default to `permissions: contents: read`. Jobs that need more
  request it individually.
- Dependabot proposes SHA updates, so pins do not go stale.

## Consequences

Updates arrive as reviewable PRs instead of silently. Reading which version is
in use relies on the trailing comment, which Dependabot keeps in sync.
