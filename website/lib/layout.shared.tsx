import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/logo';
import { NavLink } from '@/components/nav-link';
import { repoUrl } from './shared';

const migrating = '/docs/guides/migrating-from-businesstimedelta/';
const benchmarks = '/docs/benchmarks/';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: <Logo /> },
    links: [
      {
        type: 'custom',
        children: (
          <NavLink href="/docs/" nested except={[migrating, benchmarks]}>
            Docs
          </NavLink>
        ),
      },
      { type: 'custom', children: <NavLink href={migrating}>Migrating</NavLink> },
      { type: 'custom', children: <NavLink href={benchmarks}>Benchmarks</NavLink> },
    ],
    githubUrl: repoUrl,
  };
}
