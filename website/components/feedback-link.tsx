import { discussionsUrl, docsIssueUrl } from '@/lib/shared';

const linkClass =
  'underline decoration-rule-strong underline-offset-4 hover:text-text hover:decoration-accent';

/** GitHub fills the issue form's `page` field from the query parameter of the same name. */
export function FeedbackLink({ pageUrl }: { pageUrl: string }) {
  return (
    <p className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-ui text-text-2">
      <a href={`${docsIssueUrl}&page=${encodeURIComponent(pageUrl)}`} className={linkClass}>
        Report a problem with this page
      </a>
      <a href={discussionsUrl} className={linkClass}>
        Ask a question in Discussions
      </a>
    </p>
  );
}
