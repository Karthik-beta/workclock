# 0006. WebAssembly via wasm-bindgen over napi-rs

- Status: Accepted
- Date: 2026-10-22

## Context

The npm package must work in Node and in browsers.

- **napi-rs** builds native Node addons. Calls run at native speed, but the
  package needs a prebuilt binary per platform (usually published as optional
  dependencies), and the result does not run in browsers.
- **wasm-bindgen with wasm-pack** builds one WebAssembly module that runs in
  Node, browsers, Deno, Bun and edge runtimes. Calls cross a JS/WASM boundary,
  and WASM runs slower than native code.

## Decision

Build the npm package from WebAssembly with wasm-bindgen and wasm-pack.

## Consequences

- One artifact serves every JavaScript runtime, with no per-platform binaries
  to build, publish or debug.
- The module bundles its own time zone database (ADR 0004), which adds to its
  size.
- Per-call overhead is higher than a native addon. Batch functions amortise
  it, and the benchmarks in M7 measure it.
