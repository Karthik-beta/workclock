import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/notebook/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { FeedbackLink } from '@/components/feedback-link';
import { getMDXComponents } from '@/components/mdx';
import { PageActions } from '@/components/page-actions';
import { pageMarkdownUrl } from '@/lib/llms';
import { siteUrl } from '@/lib/shared';
import { source } from '@/lib/source';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const MDX = page.data.body;
  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <PageActions markdownPath={pageMarkdownUrl(page).slice(siteUrl.length)} />
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
      <FeedbackLink pageUrl={new URL(`.${page.url}/`, siteUrl).href} />
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { types: { 'text/markdown': pageMarkdownUrl(page) } },
  };
}
