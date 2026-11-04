import { notFound } from 'next/navigation';
import { pageMarkdown } from '@/lib/llms';
import { source } from '@/lib/source';

export const dynamic = 'force-static';
export const revalidate = false;

export async function GET(_req: Request, { params }: RouteContext<'/llms.mdx/docs/[[...slug]]'>) {
  const { slug } = await params;
  // The last segment is the file name, "content.md".
  const page = source.getPage(slug?.slice(0, -1));
  if (!page) notFound();
  return new Response(await pageMarkdown(page), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: [...page.slugs, 'content.md'] }));
}
