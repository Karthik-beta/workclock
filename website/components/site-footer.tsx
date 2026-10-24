import Link from 'next/link';
import { repoUrl } from '@/lib/shared';

const linkClass = 'hover:text-text';

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Project',
    links: [
      { label: 'GitHub repository', href: repoUrl },
      { label: 'Changelog', href: `${repoUrl}/blob/main/CHANGELOG.md` },
      { label: 'Security', href: `${repoUrl}/blob/main/SECURITY.md` },
      { label: 'Contributing', href: `${repoUrl}/blob/main/CONTRIBUTING.md` },
    ],
  },
  {
    title: 'Docs',
    links: [
      { label: 'Install', href: '/docs/' },
      { label: 'Concepts', href: '/docs/' },
      { label: 'Migrating', href: `${repoUrl}/blob/main/MIGRATING.md` },
      { label: 'Benchmarks', href: `${repoUrl}/blob/main/benchmarks/RESULTS.md` },
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
