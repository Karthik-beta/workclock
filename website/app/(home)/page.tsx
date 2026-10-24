import { Callout } from 'fumadocs-ui/components/callout';
import { Schedule } from 'workclock/web';
import { CheckIt } from '@/components/landing/check-it';
import { InstallCommands } from '@/components/landing/install-commands';
import { MigrateNote } from '@/components/landing/migrate-note';
import { A, repoFile } from '@/components/landing/parts';
import { SameAnswer } from '@/components/landing/same-answer';
import { UseCases } from '@/components/landing/use-cases';
import { SiteFooter } from '@/components/site-footer';
import { SkipLink } from '@/components/skip-link';
import { WeekStripDemo } from '@/components/week-strip/demo';
import { repoUrl } from '@/lib/shared';
import { computeStrip, readmeInputs } from '@/lib/week-strip';
import { initWorkclock } from '@/lib/workclock-build';

async function readmeStrip() {
  await initWorkclock();
  const result = computeStrip(Schedule, readmeInputs);
  if (!result.ok) throw new Error(`The README scenario failed: ${result.message}`);
  return result.strip;
}

const requirements = [
  { label: 'Rust 1.85+', href: `${repoUrl}#requirements` },
  { label: 'Python 3.9+', href: `${repoUrl}#requirements` },
  { label: 'Node.js 22+', href: `${repoUrl}#requirements` },
];

export default async function HomePage() {
  const strip = await readmeStrip();
  return (
    <>
      <SkipLink href="#main-content" />
      <div id="main-content" className="landing-container w-full pt-16 pb-16 md:pb-20 lg:pt-24 lg:pb-24">
        <section aria-labelledby="hero-title" className="flex flex-col gap-6">
          <h1 id="hero-title" className="text-display-sm text-balance text-text lg:text-display">
            Add 8 working hours.
            <br />
            Land on Wednesday at 09:30.
          </h1>
          <p className="max-w-[600px] text-lead text-text-2">
            Fast, correct business-time arithmetic for Rust, Python and JavaScript.
          </p>
          <div className="flex max-w-[600px] flex-col gap-3">
            <Callout type="warning" title="Warning" className="my-0">
              In development. No release has been published yet.
            </Callout>
            <InstallCommands />
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-ui text-text-2">
              <p>
                {requirements.map((r, i) => (
                  <span key={r.label}>
                    <A href={r.href}>
                      {r.label}
                    </A>
                    {i < requirements.length - 1 ? ', ' : '. '}
                  </span>
                ))}
                <A href={repoFile('LICENSE')}>MIT licence</A>
                .
              </p>
              <A href="#migrate">
                Coming from businesstimedelta?
              </A>
            </div>
          </div>
          <div className="mt-10 lg:mt-14">
            <WeekStripDemo initial={strip} />
          </div>
        </section>
        <div className="flex flex-col gap-16 pt-16 md:gap-20 md:pt-20 lg:gap-24 lg:pt-24">
          <SameAnswer />
          <CheckIt />
          <UseCases />
          <MigrateNote />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
