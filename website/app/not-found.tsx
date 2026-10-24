import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { Metadata } from 'next';
import Link from 'next/link';
import { A } from '@/components/landing/parts';
import { SearchButton } from '@/components/search-button';
import { SiteFooter } from '@/components/site-footer';
import { SkipLink } from '@/components/skip-link';
import { baseOptions } from '@/lib/layout.shared';
import { docsIssueUrl, siteUrl } from '@/lib/shared';

export const metadata: Metadata = { title: 'Page not found' };

const linkClass =
  'inline-flex items-center gap-2 text-text underline decoration-rule-strong underline-offset-4 hover:decoration-accent';

// Next.js writes this page to out/404.html, which GitHub Pages serves for any missing URL.
export default function NotFound() {
  return (
    <HomeLayout {...baseOptions('home')}>
      <SkipLink href="#main-content" />
      <div id="main-content" className="landing-container w-full flex-1 py-16 lg:py-24">
        <h1 className="text-h1 text-text">Page not found</h1>
        <p className="mt-4 max-w-[600px] text-lead text-text-2">
          There is no page at this address. It may have moved, or the link may be mistyped.
        </p>
        <ul className="mt-8 flex flex-col items-start gap-3 text-body">
          <li>
            <Link href="/docs/" className={linkClass}>
              Docs home
            </Link>
          </li>
          <li>
            <Link href="/docs/install/" className={linkClass}>
              Install
            </Link>
          </li>
          <li>
            <SearchButton className={linkClass} />
          </li>
          <li>
            <a href={`${siteUrl}llms.txt`} className={linkClass}>
              llms.txt
            </a>
          </li>
        </ul>
        <p className="mt-12 text-ui text-text-2">
          If a link on this site brought you here, <A href={docsIssueUrl}>report it</A>.
        </p>
      </div>
      <SiteFooter />
    </HomeLayout>
  );
}
