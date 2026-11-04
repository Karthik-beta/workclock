import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import { SkipLink } from '@/components/skip-link';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink href="#main-content" />
      <HomeLayout {...baseOptions('home')}>{children}</HomeLayout>
    </>
  );
}
