import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/logo';
import { repoUrl } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: <Logo /> },
    githubUrl: repoUrl,
  };
}
