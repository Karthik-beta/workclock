import { readSingleBenchmark } from '@/lib/benchmarks';
import { A, Code, repoFile } from './parts';

const longDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function Benchmarks() {
  const { date, cpu, medians } = readSingleBenchmark();
  const rows = [
    ['Rust', medians.rust],
    ['JavaScript', medians.javascript],
    ['Python', medians.python],
    ['Python, businesstimedelta 1.0.1', medians.businesstimedelta],
  ];

  return (
    <div>
      <h3 className="text-h3 text-text">Benchmarks</h3>
      <table className="mt-4 w-full max-w-md text-ui tabular-nums">
        <caption className="mb-3 text-start text-text-2">
          Median time of one <Code>between</Code> call over a 5.5-hour span.
        </caption>
        <thead>
          <tr className="border-b border-rule-strong">
            <th scope="col" className="py-2 text-start font-medium text-text">
              Implementation
            </th>
            <th scope="col" className="py-2 text-end font-medium text-text">
              Median
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, median]) => (
            <tr key={label} className="border-b border-rule">
              <th scope="row" className="py-2 text-start font-normal text-text-2">
                {label}
              </th>
              <td className="py-2 text-end text-text">{median.replace(' ', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-caption text-text-2 tabular-nums">
        Measured on <time dateTime={date}>{longDate.format(new Date(date))}</time> on {cpu}.{' '}
        <A href={repoFile('benchmarks/RESULTS.md')}>benchmarks/RESULTS.md</A> has every case
        with p95s.
      </p>
    </div>
  );
}
