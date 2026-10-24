import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { SkipLink } from '@/components/skip-link';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  const base = baseOptions('docs');
  return (
    <>
      <SkipLink href="#nd-page" />
      <DocsLayout tree={source.getPageTree()} {...base} nav={{ ...base.nav, mode: 'top' }}>
        {children}
      </DocsLayout>
    </>
  );
}
