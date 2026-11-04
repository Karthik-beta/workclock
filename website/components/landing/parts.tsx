import type { ComponentProps } from 'react';
import { repoUrl } from '@/lib/shared';

export const codeThemes = {
  light: 'github-light-high-contrast',
  dark: 'github-dark-default',
} as const;

export function repoFile(path: string): string {
  return `${repoUrl}/blob/main/${path}`;
}

export function repoDir(path: string): string {
  return `${repoUrl}/tree/main/${path}`;
}

export function A({ className, ...props }: ComponentProps<'a'>) {
  return (
    <a
      {...props}
      className={`text-text underline decoration-rule-strong underline-offset-4 hover:decoration-accent ${className ?? ''}`}
    />
  );
}

export function Code(props: ComponentProps<'code'>) {
  return <code {...props} className="font-mono" />;
}
