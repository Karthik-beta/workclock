'use client';
import { type ComponentProps, type KeyboardEvent, useEffect, useState } from 'react';

export const field =
  'h-9 rounded-md border border-text-3 bg-bg px-2 text-ui text-text tabular-nums disabled:opacity-60 aria-invalid:border-danger';
export const stepper =
  'flex size-9 items-center justify-center rounded-md border border-text-3 bg-bg text-text-2 hover:text-text disabled:opacity-60';

/** A field that applies its value on blur or Enter, so typing is not announced keystroke by keystroke. */
export function CommitInput({
  value,
  onCommit,
  isValid,
  onInvalid,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (value: string) => void;
  isValid?: (value: string) => boolean;
  onInvalid?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft === value) return setInvalid(false);
    if (isValid && !isValid(draft)) {
      setInvalid(true);
      onInvalid?.();
      return;
    }
    setInvalid(false);
    onCommit(draft);
  };
  return (
    <input
      {...props}
      aria-invalid={invalid || props['aria-invalid'] ? true : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

const hhmmPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function TimeInput({
  errorId,
  ...props
}: Omit<ComponentProps<typeof CommitInput>, 'isValid'> & { errorId: string }) {
  return (
    <CommitInput
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:MM"
      maxLength={5}
      aria-describedby={errorId}
      isValid={(v) => hhmmPattern.test(v)}
      className={`${field} w-[4.5rem] text-center`}
    />
  );
}
