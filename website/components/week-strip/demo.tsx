'use client';
import { CircleX, Minus, Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  type DemoInputs,
  type Strip as StripData,
  type StripRow,
  addDays,
  caption,
  computeStrip,
  dueSentence,
  isWorkingDay,
  longDate,
  maxSlaHours,
  minSlaHours,
} from '@/lib/week-strip';
import { CommitInput, TimeInput, field, stepper } from './fields';
import { Strip } from './strip';
import { useWorkclock } from './use-workclock';

const firstDay = '2026-12-21';
const openedDays = Array.from({ length: 19 }, (_, i) => addDays(firstDay, i));

/** The landing page's live week strip. `initial` is the README scenario, computed at build time. */
export function WeekStripDemo({ initial }: { initial: StripData }) {
  const { workclock, error: loadError } = useWorkclock();
  const [inputs, setInputs] = useState<DemoInputs>(initial.inputs);
  const [shown, setShown] = useState<StripData>(initial);
  const [timeError, setTimeError] = useState(false);
  const errorId = useId();

  const result = useMemo(
    () => (workclock ? computeStrip(workclock.Schedule, inputs) : null),
    [workclock, inputs],
  );
  useEffect(() => {
    if (result?.ok) setShown(result.strip);
  }, [result]);

  const ready = workclock !== null;
  const hoursError = result && !result.ok ? result.message : null;
  const error = timeError ? 'Write times as HH:MM on a 24-hour clock, such as 09:30.' : hoursError;
  const set = (patch: Partial<DemoInputs>) => {
    setTimeError(false);
    setInputs((prev) => ({ ...prev, ...patch }));
  };
  const setSla = (hours: number) =>
    set({ slaHours: Math.min(maxSlaHours, Math.max(minSlaHours, Math.round(hours))) });

  const toggle = (row: StripRow) => {
    if (row.kind === 'weekend' || !isWorkingDay(inputs, row.date)) return null;
    const pressed = row.kind === 'holiday';
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={`${longDate(row.date, { year: false })}: holiday`}
        disabled={!ready}
        onClick={() =>
          set({
            holidays: pressed
              ? inputs.holidays.filter((d) => d !== row.date)
              : [...inputs.holidays, row.date].sort(),
          })
        }
        className="size-6 rounded-sm border border-text-3 bg-bg disabled:opacity-60"
        style={
          pressed
            ? {
                backgroundImage:
                  'repeating-linear-gradient(45deg, var(--wc-text-2) 0 1.5px, transparent 1.5px 5px)',
              }
            : undefined
        }
      />
    );
  };

  return (
    <div className="rounded-xl border border-rule bg-surface p-4 sm:p-6">
      <fieldset disabled={!ready} className="flex flex-wrap items-end gap-x-8 gap-y-5">
        <legend className="sr-only">Inputs</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="demo-sla" className="text-ui font-medium text-text-2">
            SLA (hours)
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label="One hour less"
              className={stepper}
              onClick={() => setSla(inputs.slaHours - 1)}
              disabled={!ready || inputs.slaHours <= minSlaHours}
            >
              <Minus className="size-4" />
            </button>
            <CommitInput
              id="demo-sla"
              type="number"
              min={minSlaHours}
              max={maxSlaHours}
              className={`${field} w-16 text-center`}
              value={String(inputs.slaHours)}
              onCommit={(v) => {
                const n = Number(v);
                if (v !== '' && Number.isFinite(n)) setSla(n);
              }}
            />
            <button
              type="button"
              aria-label="One hour more"
              className={stepper}
              onClick={() => setSla(inputs.slaHours + 1)}
              disabled={!ready || inputs.slaHours >= maxSlaHours}
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="demo-opened-day" className="text-ui font-medium text-text-2">
            Opened
          </label>
          <div className="flex gap-1.5">
            <select
              id="demo-opened-day"
              className={field}
              value={inputs.openedDate}
              onChange={(e) => set({ openedDate: e.target.value })}
            >
              {openedDays.map((d) => (
                <option key={d} value={d}>
                  {longDate(d, { short: true, year: false })}
                </option>
              ))}
            </select>
            <TimeInput
              aria-label="Opened at"
              errorId={errorId}
              onInvalid={() => setTimeError(true)}
              value={inputs.openedTime}
              onCommit={(v) => set({ openedTime: v })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id="demo-hours" className="text-ui font-medium text-text-2">
            Working hours
          </span>
          <div className="flex items-center gap-1.5">
            <TimeInput
              aria-label="Start"
              errorId={errorId}
              onInvalid={() => setTimeError(true)}
              aria-invalid={hoursError ? true : undefined}
              value={inputs.workStart}
              onCommit={(v) => set({ workStart: v })}
            />
            <span className="text-ui text-text-2">to</span>
            <TimeInput
              aria-label="End"
              errorId={errorId}
              onInvalid={() => setTimeError(true)}
              aria-invalid={hoursError ? true : undefined}
              value={inputs.workEnd}
              onCommit={(v) => set({ workEnd: v })}
            />
          </div>
        </div>

        <p className="flex flex-col gap-1.5 text-ui">
          <span className="font-medium text-text-2">Time zone</span>
          <span className="flex h-9 items-center text-text">{inputs.timeZone}</span>
        </p>
      </fieldset>

      <div className={`mt-8 ${error ? 'opacity-40' : ''}`}>
        <Strip strip={shown} renderToggle={toggle} />
        <p className="mt-4 text-code text-text-2">{caption(shown.inputs)}</p>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <p aria-live="polite" id={errorId} className="text-h3 tabular-nums">
          {error ? (
            <span className="flex items-center gap-2 text-ui font-medium text-danger">
              <CircleX className="size-4 shrink-0" />
              {error}
            </span>
          ) : (
            dueSentence(shown)
          )}
        </p>
        {!error && (
          <code className="font-mono text-code text-text-2 [overflow-wrap:anywhere]">{shown.call}</code>
        )}
        {!ready && (
          <p className="text-ui text-text-2">
            {loadError
              ? 'The live demo could not load. The example above is correct for the default inputs.'
              : 'Loading workclock…'}
          </p>
        )}
      </div>
    </div>
  );
}
