import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // workclock is linked from ../js, outside the project root.
  turbopack: { root: path.join(import.meta.dirname, '..') },
};

export default withMDX(config);
