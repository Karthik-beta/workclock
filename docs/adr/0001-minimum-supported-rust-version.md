# 0001. Minimum supported Rust version

- Status: Accepted
- Date: 2026-10-22

## Context

The core crate's only planned dependency, jiff, supports Rust 1.70. The
workspace also contains the Python and WASM binding crates, and all three share
one `Cargo.lock`. PyO3 0.30 requires Rust 1.85, wasm-bindgen 0.2.129 requires
1.81, and several dependencies publish manifests using edition 2024, which
Cargo cannot parse before 1.85. An MSRV that CI cannot check against the real
lockfile is a claim, not a guarantee.

## Decision

`rust-version = "1.85"` for every crate in the workspace. A CI job runs
`cargo check -p workclock` on Rust 1.85 against the committed lockfile.

`.cargo/config.toml` sets `resolver.incompatible-rust-versions = "fallback"`,
so `cargo update` prefers dependency versions compatible with the MSRV.

## Consequences

- Rust 1.85 was released in February 2025, so users on toolchains up to about
  20 months old are supported.
- Raising the MSRV is a minor-version change, following Cargo's SemVer
  guidance, and requires a new ADR superseding this one.
- Dev-dependencies (proptest, criterion) may need newer toolchains. The MSRV
  promise covers building the library, not running its test suite.
