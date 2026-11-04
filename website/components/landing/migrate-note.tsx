import { Callout } from 'fumadocs-ui/components/callout';
import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';
import { A, codeThemes, repoFile } from './parts';

const upstreamIssue = (n: number) => `https://github.com/seppemans/businesstimedelta/issues/${n}`;

function Issue({ n }: { n: number }) {
  return (
    <A href={upstreamIssue(n)} aria-label={`businesstimedelta issue #${n}`}>
      #{n}
    </A>
  );
}

export function MigrateNote() {
  return (
    <Callout id="migrate" type="info" title="Note: Coming from businesstimedelta?" className="my-0">
      <div className="flex flex-col gap-3">
        <p>Most code migrates with one line:</p>
        <ServerCodeBlock
          code="import workclock.compat as businesstimedelta"
          lang="python"
          themes={codeThemes}
        />
        <p>
          It fixes overnight shifts, the crash past the last holiday (<Issue n={8} />,{' '}
          <Issue n={10} />) and the infinite loop with holidays in another zone (<Issue n={9} />
          ). <A href={repoFile('MIGRATING.md')}>MIGRATING.md</A> lists every difference.
        </p>
      </div>
    </Callout>
  );
}
