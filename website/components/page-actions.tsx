'use client';
import { Check, ChevronDown, Copy, ExternalLink, FileText } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from 'fumadocs-ui/components/ui/popover';
import { useState } from 'react';
import { siteUrl } from '@/lib/shared';

const button =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-rule-strong bg-bg px-2.5 text-code font-medium text-text hover:bg-surface disabled:opacity-60';
const item =
  'flex items-center gap-2 rounded-sm px-2 py-1.5 text-ui text-text hover:bg-surface';

/**
 * Copy page and the Open menu under each docs page's description. `markdownPath` is the page's
 * Markdown version under the site root, such as "docs/install.md".
 */
export function PageActions({ markdownPath }: { markdownPath: string }) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const local = `/${markdownPath}`;
  const absolute = `${siteUrl}${markdownPath}`;
  const prompt = `Read ${absolute}, a page of the workclock documentation, so I can ask you questions about it. For anything it does not cover, use ${siteUrl}llms.txt.`;

  const copy = async () => {
    setState('copying');
    try {
      const response = await fetch(local);
      if (!response.ok) throw new Error(String(response.status));
      await navigator.clipboard.writeText(await response.text());
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="not-prose flex flex-wrap items-center gap-2">
      <button type="button" className={button} onClick={copy} disabled={state === 'copying'}>
        {state === 'copied' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy page'}
      </button>
      <Popover>
        <PopoverTrigger className={button}>
          Open
          <ChevronDown className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-56 flex-col p-1">
          <a href={local} className={item}>
            <FileText className="size-4 text-text-2" />
            View as Markdown
          </a>
          <a
            href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`}
            target="_blank"
            rel="noopener"
            className={item}
          >
            <ExternalLink className="size-4 text-text-2" />
            Open in Claude
          </a>
          <a
            href={`https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}&hints=search`}
            target="_blank"
            rel="noopener"
            className={item}
          >
            <ExternalLink className="size-4 text-text-2" />
            Open in ChatGPT
          </a>
        </PopoverContent>
      </Popover>
      <span aria-live="polite" className="sr-only">
        {state === 'copied' ? 'Page copied as Markdown' : state === 'failed' ? 'Copy failed' : ''}
      </span>
    </div>
  );
}
