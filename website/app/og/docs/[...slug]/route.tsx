import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';
import { pageSection } from '@/lib/og';
import { siteUrl } from '@/lib/shared';
import { source } from '@/lib/source';

export const dynamic = 'force-static';
export const revalidate = false;

const assets = path.join(process.cwd(), 'assets');
const colors = { bg: '#FFFFFF', text: '#0F1729', text2: '#4A5363' };

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params;
  // The last segment is the file name, "image.png".
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();
  const [regular, semiBold, mark] = await Promise.all([
    readFile(path.join(assets, 'fonts', 'InstrumentSans-Regular.ttf')),
    readFile(path.join(assets, 'fonts', 'InstrumentSans-SemiBold.ttf')),
    readFile(path.join(assets, 'mark.svg'), 'base64'),
  ]);
  const address = `${siteUrl.replace('https://', '')}${page.url.slice(1)}/`;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: colors.bg,
        color: colors.text,
        fontFamily: 'Instrument Sans',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <img src={`data:image/svg+xml;base64,${mark}`} width={48} height={48} alt="" />
        <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em' }}>workclock</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: 28, color: colors.text2 }}>{pageSection(page)}</span>
        <span
          style={{
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            lineClamp: 2,
          }}
        >
          {page.data.title}
        </span>
      </div>
      <span style={{ alignSelf: 'flex-end', fontSize: 24, color: colors.text2 }}>{address}</span>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Instrument Sans', data: regular, weight: 400, style: 'normal' },
        { name: 'Instrument Sans', data: semiBold, weight: 600, style: 'normal' },
      ],
    },
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: [...page.slugs, 'image.png'] }));
}
