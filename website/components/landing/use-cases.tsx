import Link from 'next/link';
import type { ReactNode } from 'react';
import { Code } from './parts';

const useCases: { title: string; question: string; functions: ReactNode; href: string }[] = [
  {
    title: 'Support-ticket SLAs',
    question: 'When is a ticket due, and how much of its SLA has elapsed?',
    functions: (
      <>
        <Code>add</Code>, <Code>between</Code>
      </>
    ),
    href: '/docs/',
  },
  {
    title: 'Payroll and overtime',
    question: 'How many hours of a shift fell inside contracted time?',
    functions: <Code>between</Code>,
    href: '/docs/',
  },
  {
    title: 'Staff rosters, including overnight shifts',
    question: 'When does the next shift start and end?',
    functions: (
      <>
        <Code>next_period</Code> / <Code>nextPeriod</Code>
      </>
    ),
    href: '/docs/',
  },
  {
    title: 'Delivery ETAs that only count operating hours',
    question: 'When does a parcel arrive?',
    functions: <Code>add</Code>,
    href: '/docs/',
  },
];

export function UseCases() {
  return (
    <section aria-labelledby="use-cases">
      <h2 id="use-cases" className="text-h2 text-text">
        What it is for
      </h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {useCases.map(({ title, question, functions, href }) => (
          <li key={title} className="flex">
            <Link
              href={href}
              className="flex flex-1 flex-col gap-2 rounded-lg border border-rule bg-surface p-4 hover:border-rule-strong"
            >
              <h3 className="text-body font-semibold text-text">{title}</h3>
              <p className="text-ui text-text-2">{question}</p>
              <p className="mt-auto text-ui text-text-2">{functions}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
