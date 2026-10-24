'use client';
import { Check, Clipboard } from 'lucide-react';
import { useState } from 'react';

const commands = ['cargo add workclock jiff', 'pip install workclock', 'npm i workclock'];

export function InstallCommands() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (command: string) => {
    await navigator.clipboard.writeText(command);
    setCopied(command);
    setTimeout(() => setCopied((c) => (c === command ? null : c)), 1500);
  };
  return (
    <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
      {commands.map((command) => (
        <li key={command} className="flex items-center gap-2 py-1.5 ps-4 pe-1.5">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-code text-text">
            {command}
          </code>
          <button
            type="button"
            onClick={() => copy(command)}
            aria-label={`Copy "${command}"`}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-2 hover:bg-rule hover:text-text"
          >
            {copied === command ? <Check className="size-4" /> : <Clipboard className="size-4" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
