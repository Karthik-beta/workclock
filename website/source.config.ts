import { defineConfig } from 'fumadocs-mdx/config';
import { remarkRepoFile } from './lib/remark-repo-file';

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: { light: 'github-light-high-contrast', dark: 'github-dark-default' },
    },
    remarkPlugins: (v) => [remarkRepoFile, ...v],
  },
});
