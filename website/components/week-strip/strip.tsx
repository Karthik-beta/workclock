import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  type Span,
  type Strip as StripData,
  type StripRow,
  dayName,
  describe,
  dueLabel,
  hhmm,
  minutes,
  offLabel,
} from '@/lib/week-strip';
import { DueMarker } from './due-marker';

const rowPx = 24;
const gapPx = 8;

const hatch = {
  backgroundImage:
    'repeating-linear-gradient(45deg, var(--wc-rule-strong) 0 1.5px, transparent 1.5px 6px)',
};

export function rowDate(row: StripRow): string {
  return row.kind === 'weekend' ? row.dates[0] : row.date;
}

/**
 * The week strip drawing. Controls go in `renderToggle`, which sits in the label column,
 * outside the `role="img"` element.
 */
export function Strip({
  strip,
  renderToggle,
}: {
  strip: StripData;
  renderToggle?: (row: StripRow) => ReactNode;
}) {
  const { axis, rows } = strip;
  const x = (minute: number) => ((minute - axis.from) / (axis.to - axis.from)) * 100;
  const ticks: number[] = [];
  for (let m = axis.from; m <= axis.to; m += 120) ticks.push(m);
  const span = (s: Span) => ({ left: `${x(s.from)}%`, width: `${x(s.to) - x(s.from)}%` });
  const dueX = strip.due ? x(strip.due.minute) : 0;

  return (
    <div className="flex gap-2 sm:gap-3">
      <div className="shrink-0">
        <div className="h-7" />
        <ul className="flex flex-col" style={{ gap: gapPx }}>
          {rows.map((row) => (
            <li key={rowDate(row)} className="flex items-center gap-2" style={{ height: rowPx }}>
              <span className="w-12 whitespace-nowrap text-code text-text-2 tabular-nums sm:w-[4.5rem]">
                <RowLabel row={row} />
              </span>
              {renderToggle && <span className="flex size-6">{renderToggle(row)}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div role="img" aria-label={describe(strip)} className="relative min-w-0 flex-1">
        <div className="relative h-7" aria-hidden="true">
          {ticks.map((m, i) => (
            <span
              key={m}
              className={`absolute top-0 -translate-x-1/2 font-mono text-caption text-text-2 ${i % 2 ? 'max-sm:hidden' : ''}`}
              style={{ left: `${x(m)}%` }}
            >
              {hhmm(m)}
            </span>
          ))}
        </div>
        <div className="relative overflow-x-clip">
          {ticks.map((m, i) => (
            <span
              key={m}
              aria-hidden="true"
              className={`absolute inset-y-0 w-px bg-rule ${i % 2 ? 'max-sm:hidden' : ''}`}
              style={{ left: `${x(m)}%` }}
            />
          ))}
          <ul className="relative flex flex-col" style={{ gap: gapPx }} aria-hidden="true">
            {rows.map((row, i) => (
              <li key={rowDate(row)} className="relative" style={{ height: rowPx }}>
                <RowTrack row={row} span={span} weekendX={x(minutes(strip.inputs.workStart))} />
                {i === strip.start.row && (
                  <span
                    className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-used outline-2 outline-bg"
                    style={{ left: `${x(strip.start.minute)}%` }}
                  />
                )}
                {strip.due && i === strip.due.row && (
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm bg-bg px-1 text-caption font-semibold text-accent-text tabular-nums ${dueX > 65 ? '-translate-x-full' : ''}`}
                    style={{ left: dueX > 65 ? `calc(${dueX}% - 8px)` : `calc(${dueX}% + 8px)` }}
                  >
                    {dueLabel(strip)}
                  </span>
                )}
                {!strip.due && i === rows.length - 1 && (
                  <ChevronRight className="absolute right-0 top-0.5 size-5 text-text-2" />
                )}
              </li>
            ))}
          </ul>
          {strip.due && <DueMarker xPercent={dueX} yPx={strip.due.row * (rowPx + gapPx)} />}
        </div>
      </div>
    </div>
  );
}

function RowLabel({ row }: { row: StripRow }) {
  if (row.kind === 'weekend') {
    const names = row.dates.map((d) => dayName(d, true));
    return <>{names.length > 1 ? `${names[0]}–${names.at(-1)}` : names[0]}</>;
  }
  return (
    <>
      {dayName(row.date, true)}
      <span className="max-sm:hidden"> {Number(row.date.slice(8))}</span>
    </>
  );
}

function RowTrack({
  row,
  span,
  weekendX,
}: {
  row: StripRow;
  span: (s: Span) => { left: string; width: string };
  weekendX: number;
}) {
  if (row.kind === 'weekend') {
    return (
      <span
        className="absolute inset-y-0 flex items-center text-caption text-text-2"
        style={{ left: `${weekendX}%` }}
      >
        {offLabel(row.dates)}
      </span>
    );
  }
  if (row.kind === 'holiday') {
    return (
      <span
        className="absolute inset-y-0 flex items-center justify-center rounded-sm"
        style={{ ...span(row.hours), ...hatch }}
      >
        <span className="rounded-sm bg-surface px-1 text-caption text-text-2">Holiday</span>
      </span>
    );
  }
  return (
    <>
      {row.periods.map((p) => (
        <span key={p.from} className="absolute inset-y-0 rounded-sm bg-work" style={span(p)} />
      ))}
      {row.used.map((p) => (
        <span key={p.from} className="absolute inset-y-1.5 rounded-sm bg-used" style={span(p)} />
      ))}
    </>
  );
}
