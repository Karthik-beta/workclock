# Contributing to workclock

Thanks for helping. By participating you agree to the
[code of conduct](CODE_OF_CONDUCT.md).

## Ground rules

- **No fix without a failing test.** A bug fix starts with a test that fails on
  the current code. Upstream businesstimedelta issues are first reproduced
  against businesstimedelta 1.0.1.
- **Never weaken a test to make it pass.** If a test disagrees with the spec in
  `DESIGN.md`, raise it in the PR instead.
- **Discuss first** before adding a dependency or renaming public API.
- Record significant design decisions as ADRs in [`docs/adr/`](docs/adr/).

## Workflow

1. Branch from `main`. Nothing is committed to `main` directly.
2. Keep commits small, one concern each, following
   [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
   CI checks every commit subject in a pull request and accepts the types
   `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`,
   `style` and `revert`. Bring a branch up to date by rebasing; a merge commit
   fails the check.
3. Add user-facing changes to the `Unreleased` section of
   [`CHANGELOG.md`](CHANGELOG.md) ([Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)).
4. Open a pull request. CI must pass. PRs are merged with *Rebase and merge* so
   that individual commits stay in history.

Versions follow [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html), and the
Rust crate also follows Cargo's
[SemVer compatibility rules](https://doc.rust-lang.org/cargo/reference/semver.html).

## Repository layout

- `DESIGN.md` is the specification. Every rule comes with examples, and a
  change in behaviour starts there.
- `tests/fixtures/design_examples.json` holds DESIGN.md's engine examples. The
  Rust, Python and JavaScript suites all run it, so a behaviour change updates
  DESIGN.md and the fixture together.
- `crates/workclock` is the engine and the crate published to crates.io. Its
  tests compare the engine with a brute-force oracle in
  `crates/workclock/tests/support`.
- `crates/workclock-py` is the PyO3 extension, `workclock._workclock`.
  `python/workclock` is the Python package built on it, including
  `workclock.compat`, and `tests/python` holds its tests, the ported
  businesstimedelta suite and the upstream issue reproductions.
- `crates/workclock-wasm` is the wasm-bindgen binding. `js` is the npm package
  that wraps its three builds, with its tests in `js/test`.
- `docs/adr` records design decisions. `benchmarks` holds the benchmarks and
  their results.
- `.github/workflows/ci.yml` runs on every pull request; `ci-ok` is the
  required check. `.github/workflows/release.yml` builds and publishes
  releases; the [Release Process](https://github.com/Karthik-beta/workclock/wiki/Release-Process)
  wiki page describes it.

## Development

The commands below are the ones CI runs, except that CI runs `cargo fmt` with
`--check`. CI runs the Rust and Python tests on Linux, macOS and Windows, with
Python 3.9 and 3.15, and the JavaScript tests on Node.js 22 and 24.

### Rust

Requires stable Rust via [rustup](https://rustup.rs), plus
`cargo install --locked cargo-deny`.

```sh
cargo fmt --all
cargo clippy --workspace --locked --all-targets --all-features -- -D warnings -W clippy::pedantic
cargo test --workspace --locked --all-features
RUSTDOCFLAGS="-D warnings" cargo doc --workspace --locked --no-deps --all-features
cargo deny check
```

CI also checks the minimum supported Rust version and line coverage of the
core crate, which must stay at 90% or above:

```sh
cargo +1.85 check -p workclock --locked --all-features
cargo llvm-cov -p workclock --locked --all-features --fail-under-lines 90
```

These need `rustup toolchain install 1.85`, and
`cargo install --locked cargo-llvm-cov` with
`rustup component add llvm-tools-preview`.

### Python

Requires [uv](https://docs.astral.sh/uv/) and a Rust toolchain. `uv sync` builds
the extension with maturin and rebuilds it when Rust sources change.

```sh
uv sync --locked
uv run ruff check
uv run ruff format --check
uv run mypy
uv run python -m mypy.stubtest workclock._workclock
uv run pytest
```

`stubtest` checks that `_workclock.pyi` matches the compiled extension.

Tests marked `slow` are deselected by default, and property tests run 40
examples each. CI runs neither the slow tests nor the deep profile; run them
when changing the engine or the oracle:

```sh
uv run pytest -m slow
uv run pytest --hypothesis-profile=deep
```

After the tests, the `python-test` CI job builds a wheel and installs it into
fresh projects outside the checkout. To reproduce it locally:

```sh
uv build --wheel --out-dir dist
cd "$(mktemp -d)"
uv init --bare --python 3.15 fresh-project
cd fresh-project
uv add /path/to/checkout/dist/workclock-*.whl
uv run python -c "import workclock; print(workclock.__version__)"
```

### JavaScript

Requires Node.js 22 or later, [wasm-pack](https://github.com/drager/wasm-pack)
and the `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`).

```sh
cd js
npm ci
npm run build
npm run typecheck
npm test
```

CI then installs the packed package into a fresh project and checks every
entry point from there, which catches a file missing from `files` in
`package.json`. From `js/`, in a POSIX shell:

```sh
npm pack
../.github/scripts/npm-install-check.sh workclock-*.tgz
```

### Instruction counts

The `instructions` CI job counts the instructions the benchmark cases execute,
under Valgrind, on both the base and the head of a pull request. It fails if
`single` or `year` executes over 3% more instructions in Rust or in Python.
The counts are on the job's summary page. To count locally on Linux or WSL, see
[Instruction counts](benchmarks/README.md#instruction-counts) in
`benchmarks/README.md`.

### Workflows

CI checks `.github/` with [zizmor](https://docs.zizmor.sh) for security
problems and with [actionlint](https://github.com/rhysd/actionlint), which also
runs shellcheck on every `run` script. Install the versions CI pins with
`cargo install --locked zizmor@1.31.1` and
`go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12`, then:

```sh
zizmor .github/
actionlint
```

## Standards

**Rust**
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/).
- `rustfmt` with the default configuration.
- `cargo clippy --workspace --all-targets --all-features -- -D warnings -W clippy::pedantic`.
  Every `#[allow]` carries a comment explaining why.
- Every public item has rustdoc with a runnable example.
- `cargo deny` for licenses, banned and duplicate crates, sources and RustSec
  advisories.

**Python**
- PEP 8 and PEP 257, enforced by `ruff check` and `ruff format`.
- PEP 484 types, PEP 561 stubs, `mypy --strict` on stubs and tests.
- PEP 621 metadata, built with maturin following the PyO3 user guide.

**TypeScript**
- `strict` type checking, ESM output with generated `.d.ts` files.
