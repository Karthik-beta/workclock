'use client';

import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { Search } from 'lucide-react';

export function SearchButton({ className }: { className?: string }) {
  const { setOpenSearch } = useSearchContext();
  return (
    <button type="button" onClick={() => setOpenSearch(true)} className={className}>
      <Search className="size-4" aria-hidden />
      Search the docs
    </button>
  );
}
