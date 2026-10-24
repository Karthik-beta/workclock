import type { ReactNode } from 'react';
import { repoUrl } from '@/lib/shared';
import { Benchmarks } from './benchmarks';
import { A, Code, repoDir, repoFile } from './parts';

const statements: { text: ReactNode; source: ReactNode }[] = [
  {
    text: 'Every rule and edge case is specified with an example and an ID.',
    source: <A href={repoFile('DESIGN.md')}>DESIGN.md</A>,
  },
  {
    text: 'The Rust, Python and JavaScript test suites all run the same file of examples, so the bindings cannot disagree on them.',
    source: (
      <A href={repoFile('tests/fixtures/README.md')}>
        <Code>tests/fixtures/design_examples.json</Code>
      </A>
    ),
  },
  {
    text: 'Each binding is compared with a brute-force oracle on random schedules: proptest (Rust), Hypothesis (Python), fast-check (JavaScript).',
    source: (
      <>
        <A href={repoFile('crates/workclock/tests/oracle_properties.rs')}>
          <Code>oracle_properties.rs</Code>
        </A>
        ,{' '}
        <A href={repoFile('tests/python/test_properties.py')}>
          <Code>test_properties.py</Code>
        </A>
        ,{' '}
        <A href={repoFile('js/test/properties.test.ts')}>
          <Code>properties.test.ts</Code>
        </A>
      </>
    ),
  },
  {
    text: (
      <>
        <Code>workclock.compat</Code> is tested against businesstimedelta 1.0.1 where 1.0.1 is
        correct, and against the oracle everywhere.
      </>
    ),
    source: (
      <A href={repoFile('tests/python/test_differential.py')}>
        <Code>tests/python/test_differential.py</Code>
      </A>
    ),
  },
  {
    text: (
      <>
        businesstimedelta’s own test suite runs against <Code>workclock.compat</Code> in CI.
      </>
    ),
    source: (
      <A href={repoDir('tests/python/upstream')}>
        <Code>tests/python/upstream</Code>
      </A>
    ),
  },
  {
    text: 'Each upstream bug it fixes has a test: issues 8, 9, 10 and 12, and overnight shifts.',
    source: (
      <A href={repoDir('tests/python/upstream_issues')}>
        <Code>tests/python/upstream_issues</Code>
      </A>
    ),
  },
  {
    text: 'CI fails if line coverage of the Rust crate drops below 90%.',
    source: (
      <>
        <A href={repoFile('.github/workflows/ci.yml')}>
          <Code>ci.yml</Code>
        </A>
        , job <Code>coverage</Code>
      </>
    ),
  },
  {
    text: 'Tested on Linux, macOS and Windows; Python 3.9 and 3.15; Node.js 22 and 24; Rust 1.85 checked separately.',
    source: (
      <>
        <Code>ci.yml</Code>, jobs <Code>test</Code>, <Code>python-test</Code>,{' '}
        <Code>wasm</Code>, <Code>msrv</Code>
      </>
    ),
  },
  {
    text: 'Benchmarks compare every binding with businesstimedelta 1.0.1, with medians, p95s, date and machine.',
    source: (
      <A href={repoFile('benchmarks/RESULTS.md')}>
        <Code>RESULTS.md</Code>
      </A>
    ),
  },
  {
    text: 'The npm package is published with provenance, so npm shows which workflow run built it.',
    source: (
      <>
        <A href={repoFile('.github/workflows/release.yml')}>
          <Code>release.yml</Code>
        </A>
        , job <Code>npm</Code>
      </>
    ),
  },
  {
    text: 'PyPI packages are published from GitHub Actions with trusted publishing, without a stored token.',
    source: (
      <>
        <Code>release.yml</Code>, job <Code>pypi</Code>;{' '}
        <A href={`${repoUrl}/wiki/Release-Process`}>Release Process</A>
      </>
    ),
  },
  {
    text: 'Every GitHub Action is pinned to a commit SHA.',
    source: (
      <A href={repoFile('docs/adr/0002-pin-github-actions-by-commit-sha.md')}>ADR 0002</A>
    ),
  },
  {
    text: 'MIT licence. Rust 1.85+, CPython 3.9+, Node.js 22+.',
    source: (
      <>
        <A href={repoFile('LICENSE')}>LICENSE</A>,{' '}
        <A href={`${repoUrl}#requirements`}>README requirements</A>
      </>
    ),
  },
];

export function CheckIt() {
  return (
    <section aria-labelledby="check-it">
      <h2 id="check-it" className="text-h2 text-text">
        How you can check it
      </h2>
      <ul className="mt-6 grid gap-x-8 md:grid-cols-2">
        {statements.map(({ text, source }, i) => (
          <li key={i} className="border-t border-rule py-4">
            <p className="text-body text-text">{text}</p>
            <p className="mt-1 text-ui text-text-2">{source}</p>
          </li>
        ))}
      </ul>
      <div className="mt-12">
        <Benchmarks />
      </div>
    </section>
  );
}
