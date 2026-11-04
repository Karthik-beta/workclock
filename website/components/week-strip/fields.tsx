'use client';
import { type ComponentProps, type KeyboardEvent, useCallback, useEffect, useId, useState } from 'react';

export const field =
  'h-9 rounded-md border border-text-3 bg-bg px-2 text-ui text-text tabular-nums disabled:opacity-60 aria-invalid:border-danger';
export const stepper =
  'flex size-9 items-center justify-center rounded-md border border-text-3 bg-bg text-text-2 hover:text-text disabled:opacity-60';

/** Whether any field holds an invalid draft, and a stable callback for each field's `onInvalidChange`. */
export function useInvalidFields() {
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  const report = useCallback((key: string, isInvalid: boolean) => {
    setInvalid((prev) => {
      if (prev.has(key) === isInvalid) return prev;
      const next = new Set(prev);
      if (isInvalid) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  return [invalid.size > 0, report] as const;
}

/** A field that applies its value on blur or Enter, so typing is not announced keystroke by keystroke. */
export function CommitInput({
  value,
  onCommit,
  isValid,
  onInvalidChange,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (value: string) => void;
  isValid?: (value: string) => boolean;
  onInvalidChange?: (key: string, invalid: boolean) => void;
}) {
  const key = useId();
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setDraft(value), [value]);
  // The cleanup also runs on unmount, so a removed field does not keep the error shown.
  useEffect(() => {
    if (!invalid || !onInvalidChange) return;
    onInvalidChange(key, true);
    return () => onInvalidChange(key, false);
  }, [invalid, key, onInvalidChange]);
  const commit = () => {
    if (draft === value) return setInvalid(false);
    if (isValid && !isValid(draft)) {
      setInvalid(true);
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
