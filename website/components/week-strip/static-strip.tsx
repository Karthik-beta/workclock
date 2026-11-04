import { Schedule } from 'workclock/web';
import { initWorkclock } from '@/lib/workclock-build';
import { type DemoInputs, caption, computeStrip, dueSentence, readmeInputs } from '@/lib/week-strip';
import { Strip } from './strip';

/** A week strip computed at build time, for docs pages. Defaults to the README scenario. */
export async function WeekStrip(props: Partial<DemoInputs>) {
  await initWorkclock();
  const result = computeStrip(Schedule, { ...readmeInputs, ...props });
  if (!result.ok) throw new Error(`<WeekStrip>: ${result.message}`);
  const { strip } = result;
  if (!strip.due) throw new Error('<WeekStrip>: the due day must fall within the days shown');
  return (
    <figure className="not-prose my-6">
      <Strip strip={strip} />
      <figcaption className="mt-3 text-code text-text-2">
        {caption(strip.inputs)} {dueSentence(strip)}.
      </figcaption>
    </figure>
  );
}
