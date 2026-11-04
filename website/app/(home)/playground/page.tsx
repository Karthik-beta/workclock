import type { Metadata } from 'next';
import { Schedule } from 'workclock/web';
import { Playground } from '@/components/playground/playground';
import { SiteFooter } from '@/components/site-footer';
import { SkipLink } from '@/components/skip-link';
import { computeStrip, readmeInputs } from '@/lib/week-strip';
import { initWorkclock } from '@/lib/workclock-build';

export const metadata: Metadata = {
  title: 'Playground',
  description: 'Change a working-time schedule and see where added working hours land, with the code for it.',
};

export default async function PlaygroundPage() {
  await initWorkclock();
  const result = computeStrip(Schedule, readmeInputs);
  if (!result.ok) throw new Error(`The README scenario failed: ${result.message}`);
  return (
    <>
      <SkipLink href="#main-content" />
      <div id="main-content" className="landing-container w-full py-12 lg:py-16">
        <h1 className="text-h1 text-text">Playground</h1>
        <p className="mt-3 max-w-[640px] text-lead text-text-2">
          Change the schedule and the start, and see where the working hours land. Everything is
          computed by workclock in your browser.
        </p>
        <div className="mt-10">
          <Playground initial={result.strip} />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
