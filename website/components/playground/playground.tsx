'use client';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { CircleX, Minus, Plus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { codeThemes } from '@/components/landing/parts';
import { CommitInput, TimeInput, field, stepper } from '@/components/week-strip/fields';
import { Strip } from '@/components/week-strip/strip';
import { useWorkclock } from '@/components/week-strip/use-workclock';
import { playgroundCode } from '@/lib/playground-code';
import {
  type DemoInputs,
  type Strip as StripData,
  type StripRow,
  caption,
  computeStrip,
  dueSentence,
  isWorkingDay,
  longDate,
  maxSlaHours,
  minSlaHours,
  weekdays,
} from '@/lib/week-strip';

const timeZones = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const label = 'text-ui font-medium text-text-2';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/** Every input of a schedule and an `add` call, with the strip and the code they produce. */
export function Playground({ initial }: { initial: StripData }) {
  const { workclock, error: loadError } = useWorkclock();
  const [inputs, setInputs] = useState<DemoInputs>(initial.inputs);
  const [shown, setShown] = useState<StripData>(initial);
  const [timeError, setTimeError] = useState(false);
  const [newHoliday, setNewHoliday] = useState('');
  const errorId = useId();

  const result = useMemo(
    () => (workclock ? computeStrip(workclock.Schedule, inputs) : null),
    [workclock, inputs],
  );
  useEffect(() => {
    if (result?.ok) setShown(result.strip);
  }, [result]);
  const code = useMemo(() => playgroundCode(shown), [shown]);

  const ready = workclock !== null;
  const inputError = result && !result.ok ? result.message : null;
  const error = timeError ? 'Write times as HH:MM on a 24-hour clock, such as 09:30.' : inputError;
  const set = (patch: Partial<DemoInputs>) => {
    setTimeError(false);
    setInputs((prev) => ({ ...prev, ...patch }));
  };
  const setSla = (hours: number) =>
    set({ slaHours: Math.min(maxSlaHours, Math.max(minSlaHours, Math.round(hours))) });
  const setHoliday = (date: string, on: boolean) =>
    set({
      holidays: on
        ? [...new Set([...inputs.holidays, date])].sort()
        : inputs.holidays.filter((d) => d !== date),
    });
  const timeProps = { errorId, onInvalid: () => setTimeError(true) };

  const toggle = (row: StripRow) => {
    if (row.kind === 'weekend' || !isWorkingDay(inputs, row.date)) return null;
    const pressed = row.kind === 'holiday';
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={`${longDate(row.date, { year: false })}: holiday`}
        disabled={!ready}
        onClick={() => setHoliday(row.date, !pressed)}
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
    <div className="flex flex-col gap-12">
      <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <fieldset
          disabled={!ready}
          className="flex flex-col gap-6 rounded-xl border border-rule bg-surface p-4 sm:p-6"
        >
          <legend className="sr-only">Inputs</legend>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pg-sla" className={label}>
              Time to add (working hours)
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
                id="pg-sla"
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
            <label htmlFor="pg-opened" className={label}>
              Start
            </label>
            <div className="flex gap-1.5">
              <input
                id="pg-opened"
                type="date"
                required
                className={`${field} min-w-0 flex-1`}
                value={inputs.openedDate}
                onChange={(e) => {
                  if (datePattern.test(e.target.value)) set({ openedDate: e.target.value });
                }}
              />
              <TimeInput
                aria-label="Start time"
                value={inputs.openedTime}
                onCommit={(v) => set({ openedTime: v })}
                {...timeProps}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={label}>Working hours</span>
            <div className="flex items-center gap-1.5">
              <TimeInput
                aria-label="Working hours start"
                value={inputs.workStart}
                onCommit={(v) => set({ workStart: v })}
                {...timeProps}
              />
              <span className="text-ui text-text-2">to</span>
              <TimeInput
                aria-label="Working hours end"
                value={inputs.workEnd}
                onCommit={(v) => set({ workEnd: v })}
                {...timeProps}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span id="pg-days" className={label}>
              Working days
            </span>
            <div role="group" aria-labelledby="pg-days" className="flex flex-wrap gap-1.5">
              {weekdays.map((day, i) => {
                const on = inputs.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set({
                        days: on
                          ? inputs.days.filter((d) => d !== day)
                          : weekdays.filter((d) => d === day || inputs.days.includes(d)),
                      })
                    }
                    className={`h-9 w-11 rounded-md border text-ui ${
                      on ? 'border-text bg-text text-bg' : 'border-text-3 bg-bg text-text-2'
                    }`}
                  >
                    {dayNames[i]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <input
                id="pg-break"
                type="checkbox"
                className="size-4 accent-[var(--wc-text)]"
                checked={inputs.breakTime !== null}
                onChange={(e) =>
                  set({ breakTime: e.target.checked ? { start: '12:00', end: '13:00' } : null })
                }
              />
              <label htmlFor="pg-break" className={label}>
                Break
              </label>
            </div>
            {inputs.breakTime && (
              <div className="flex items-center gap-1.5">
                <TimeInput
                  aria-label="Break start"
                  value={inputs.breakTime.start}
                  onCommit={(v) => inputs.breakTime && set({ breakTime: { ...inputs.breakTime, start: v } })}
                  {...timeProps}
                />
                <span className="text-ui text-text-2">to</span>
                <TimeInput
                  aria-label="Break end"
                  value={inputs.breakTime.end}
                  onCommit={(v) => inputs.breakTime && set({ breakTime: { ...inputs.breakTime, end: v } })}
                  {...timeProps}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pg-holiday" className={label}>
              Holidays
            </label>
            {inputs.holidays.length > 0 && (
              <ul className="flex flex-col gap-1">
                {inputs.holidays.map((d) => (
                  <li key={d} className="flex items-center justify-between gap-2 text-ui text-text">
                    {longDate(d, { short: true })}
                    <button
                      type="button"
                      aria-label={`Remove ${longDate(d)}`}
                      className="flex size-6 items-center justify-center rounded-sm text-text-2 hover:text-text"
                      onClick={() => setHoliday(d, false)}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-1.5">
              <input
                id="pg-holiday"
                type="date"
                className={`${field} min-w-0 flex-1`}
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
              />
              <button
                type="button"
                className={`${field} font-medium hover:border-text`}
                disabled={!ready || !datePattern.test(newHoliday)}
                onClick={() => {
                  setHoliday(newHoliday, true);
                  setNewHoliday('');
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pg-zone" className={label}>
              Time zone
            </label>
            <select
              id="pg-zone"
              className={field}
              value={inputs.timeZone}
              onChange={(e) => set({ timeZone: e.target.value })}
            >
              {timeZones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <div className="flex min-w-0 flex-col gap-6">
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
          <div className={error ? 'opacity-40' : undefined}>
            <Strip strip={shown} renderToggle={toggle} />
            <p className="mt-4 text-code text-text-2">{caption(shown.inputs)}</p>
          </div>
          {!ready && (
            <p className="text-ui text-text-2">
              {loadError
                ? 'The playground could not load workclock. The strip shows the default inputs.'
                : 'Loading workclock…'}
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="pg-code" className="min-w-0">
        <h2 id="pg-code" className="text-h2 text-text">
          The same call in code
        </h2>
        <p className="mt-2 text-body text-text-2">
          A complete program for the inputs above. It changes as you change them.
        </p>
        <Tabs groupId="lang" persist items={['Rust', 'Python', 'JavaScript']} className="mt-4">
          <Tab value="Rust">
            <DynamicCodeBlock lang="rust" code={code.rust} options={{ themes: codeThemes }} />
          </Tab>
          <Tab value="Python">
            <DynamicCodeBlock lang="python" code={code.python} options={{ themes: codeThemes }} />
          </Tab>
          <Tab value="JavaScript">
            <DynamicCodeBlock lang="js" code={code.javascript} options={{ themes: codeThemes }} />
          </Tab>
        </Tabs>
      </section>
    </div>
  );
}
