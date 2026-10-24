import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface SingleBenchmark {
  /** ISO 8601 date, as written in the Machine table. */
  date: string;
  cpu: string;
  medians: {
    rust: string;
    javascript: string;
    python: string;
    businesstimedelta: string;
  };
}

const rowNames = {
  rust: 'Rust',
  javascript: 'JavaScript',
  python: 'Python, workclock',
  businesstimedelta: 'Python, businesstimedelta',
} as const;

function fail(message: string): never {
  throw new Error(`benchmarks/RESULTS.md: ${message}`);
}

/** Body rows of the first table after line `start`, or [] if a heading comes first. */
function tableAfter(lines: string[], start: number): string[][] {
  let i = start + 1;
  while (i < lines.length && !lines[i].startsWith('|')) {
    if (lines[i].startsWith('#')) return [];
    i++;
  }
  const rows: string[][] = [];
  for (; i < lines.length && lines[i].startsWith('|'); i++) {
    rows.push(
      lines[i]
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  }
  return rows.slice(2);
}

function firstTwoColumns(rows: string[][]): Map<string, string> {
  return new Map(rows.map((row): [string, string] => [row[0], row[1]]));
}

/** The Machine table and the `single` medians of benchmarks/RESULTS.md, read at build time. */
export function readSingleBenchmark(): SingleBenchmark {
  const file = path.join(process.cwd(), '..', 'benchmarks', 'RESULTS.md');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);

  const machineHeader = lines.findIndex((line) => line.startsWith('| Machine '));
  if (machineHeader === -1) fail('no Machine table');
  const machine = firstTwoColumns(tableAfter(lines, machineHeader - 1));

  const date = machine.get('Date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('no Date in YYYY-MM-DD form in the Machine table');
  const cpu = machine.get('CPU');
  if (!cpu) fail('no CPU in the Machine table');

  const singleHeading = lines.findIndex((line) => line.trim() === '## single');
  if (singleHeading === -1) fail('no "## single" section');
  const single = firstTwoColumns(tableAfter(lines, singleHeading));

  const median = (name: string): string => {
    const value = single.get(name);
    if (value === undefined) fail(`no "${name}" row in the single table`);
    if (!/^\d+(\.\d+)? (ns|µs|ms|s|min)$/.test(value)) {
      fail(`unexpected median "${value}" for "${name}" in the single table`);
    }
    return value;
  };

  return {
    date,
    cpu,
    medians: {
      rust: median(rowNames.rust),
      javascript: median(rowNames.javascript),
      python: median(rowNames.python),
      businesstimedelta: median(rowNames.businesstimedelta),
    },
  };
}
