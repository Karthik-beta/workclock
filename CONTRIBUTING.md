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

## Development

### Rust

Requires stable Rust via [rustup](https://rustup.rs), plus `cargo install --locked cargo-deny cargo-audit`.

```sh
cargo fmt --all
cargo clippy --workspace --all-targets --all-features -- -D warnings -W clippy::pedantic
cargo test --workspace --all-features
cargo deny check
cargo audit
```

### Python

Requires [uv](https://docs.astral.sh/uv/) and a Rust toolchain. `uv sync` builds
the extension with maturin and rebuilds it when Rust sources change.

```sh
uv sync
uv run ruff check
uv run ruff format --check
uv run mypy
uv run pytest
```

Tests marked `slow` are deselected by default; `uv run pytest -m slow` runs
them. Property tests run 40 examples each; `uv run pytest
--hypothesis-profile=deep` runs 500.

After the tests, the `python-test` CI job builds a wheel and installs it into
fresh projects outside the checkout. To reproduce it locally:

```sh
uv build --wheel --out-dir dist
cd "$(mktemp -d)"
uv init --bare --python 3.13 fresh-project
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

## Standards

**Rust**
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/).
- `rustfmt` with the default configuration.
- `cargo clippy --all-targets --all-features -- -D warnings -W clippy::pedantic`.
  Every `#[allow]` carries a comment explaining why.
- Every public item has rustdoc with a runnable example.
- `cargo deny` and `cargo audit` for licenses and advisories.

**Python**
- PEP 8 and PEP 257, enforced by `ruff check` and `ruff format`.
- PEP 484 types, PEP 561 stubs, `mypy --strict` on stubs and tests.
- PEP 621 metadata, built with maturin following the PyO3 user guide.

**TypeScript**
- `strict` type checking, ESM output with generated `.d.ts` files.
