'use client';
import { LucideProvider } from 'lucide-react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import SearchDialog from '@/components/search';

export function Provider({ children }: { children: ReactNode }) {
  return (
    <LucideProvider strokeWidth={1.5}>
      <RootProvider search={{ SearchDialog }} theme={{ hotKey: false }}>
        {children}
      </RootProvider>
    </LucideProvider>
  );
}
