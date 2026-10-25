import Link from 'next/link';
import { repoUrl, siteUrl } from '@/lib/shared';

const linkClass = 'hover:text-text';

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Project',
    links: [
      { label: 'GitHub repository', href: repoUrl },
      { label: 'Changelog', href: '/docs/changelog/' },
      { label: 'Security', href: `${repoUrl}/blob/main/SECURITY.md` },
      { label: 'Contributing', href: `${repoUrl}/blob/main/CONTRIBUTING.md` },
    ],
  },
  {
    title: 'Packages',
    links: [
      { label: 'crates.io', href: 'https://crates.io/crates/workclock' },
      { label: 'docs.rs', href: 'https://docs.rs/workclock' },
      { label: 'PyPI', href: 'https://pypi.org/project/workclock/' },
      { label: 'npm', href: 'https://www.npmjs.com/package/workclock' },
    ],
  },
  {
    title: 'Docs',
    links: [
      { label: 'Install', href: '/docs/install/' },
      { label: 'Concepts', href: '/docs/concepts/schedules/' },
      { label: 'Migrating', href: '/docs/guides/migrating-from-businesstimedelta/' },
      { label: 'Benchmarks', href: '/docs/benchmarks/' },
      { label: 'llms.txt', href: `${siteUrl}llms.txt` },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-bg text-ui text-text-2">
      <div className="landing-container py-12">
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map(({ title, links }) => (
            <div key={title}>
              <h2 className="text-code font-semibold text-text">{title}</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    {href.startsWith('/') ? (
                      <Link href={href} className={linkClass}>
                        {label}
                      </Link>
                    ) : (
                      <a href={href} className={linkClass}>
                        {label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <p className="mt-12">
          workclock is MIT licensed. It ports the tests and API of{' '}
          <a
            href="https://github.com/seppemans/businesstimedelta"
            className="underline decoration-rule-strong underline-offset-4 hover:text-text"
          >
            businesstimedelta
          </a>{' '}
          by Sebastiaan Boer (MIT).
        </p>
      </div>
    </footer>
  );
}
