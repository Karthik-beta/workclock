import type { BaseLayoutProps, LinkItemType } from 'fumadocs-ui/layouts/shared';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { NavLink } from '@/components/nav-link';
import { repoUrl } from './shared';

const migrating = '/docs/guides/migrating-from-businesstimedelta/';
const benchmarks = '/docs/benchmarks/';

const navLinks = [
  <NavLink key="docs" href="/docs/" nested except={[migrating, benchmarks]}>
    Docs
  </NavLink>,
  <NavLink key="migrating" href={migrating}>
    Migrating
  </NavLink>,
  <NavLink key="benchmarks" href={benchmarks}>
    Benchmarks
  </NavLink>,
];

/**
 * The home layout's header puts its links straight into a `<ul>`, so there they need an `<li>`;
 * its menu and the docs layout do not use a list.
 */
function links(layout: 'home' | 'docs'): LinkItemType[] {
  if (layout === 'docs') return navLinks.map((link) => ({ type: 'custom', children: link }));
  return navLinks.flatMap((link): LinkItemType[] => [
    { type: 'custom', on: 'nav', children: <li>{link as ReactNode}</li> },
    { type: 'custom', on: 'menu', children: link },
  ]);
}

export function baseOptions(layout: 'home' | 'docs'): BaseLayoutProps {
  return {
    nav: { title: <Logo /> },
    links: links(layout),
    githubUrl: repoUrl,
  };
}
