// Checks the files written for coding agents after `npm run build` (wiki: Agent Experience).
// Node built-ins only. Exits with 1 and lists every problem it finds.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const out = 'out';
const site = 'https://karthik-beta.github.io/workclock/';
const problems = [];
const fail = (message) => problems.push(message);

// 1. llms.txt: an H1, then a blockquote, and only links in the lists under each H2.
const llms = readFileSync(path.join(out, 'llms.txt'), 'utf8');
const lines = llms.split('\n');
if (lines[0] !== '# workclock') fail('llms.txt: does not start with "# workclock"');
if (!lines.slice(1).find((l) => l.trim())?.startsWith('> ')) {
  fail('llms.txt: the first block after the H1 is not a blockquote');
}
let inSection = false;
for (const line of lines) {
  if (line.startsWith('## ')) inSection = true;
  else if (inSection && line.startsWith('- ') && !/^- \[[^\]]+\]\([^)]+\)/.test(line)) {
    fail(`llms.txt: list item is not a link: ${line}`);
  }
}

// 2. Every site link in llms.txt resolves to a file in out/.
for (const [, url] of llms.matchAll(/\]\((https:\/\/[^)]+)\)/g)) {
  if (!url.startsWith(site)) continue;
  const file = path.join(out, url.slice(site.length).split('#')[0]);
  if (!existsSync(file)) fail(`llms.txt: ${url} has no file at ${file}`);
}

// 3. Every docs page has its .md file, and llms-full.txt has every page title.
const full = readFileSync(path.join(out, 'llms-full.txt'), 'utf8');
const markdown = [];
for (const entry of readdirSync(path.join(out, 'docs'), { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || entry.name !== 'index.html') continue;
  const dir = path.relative(path.join(out, 'docs'), entry.parentPath);
  const md = dir ? path.join(out, 'docs', `${dir}.md`) : path.join(out, 'docs.md');
  if (!existsSync(md)) {
    fail(`${md}: missing for ${path.join(entry.parentPath, entry.name)}`);
    continue;
  }
  markdown.push(md);
  const title = readFileSync(md, 'utf8').split('\n')[0];
  if (!title.startsWith('# ')) fail(`${md}: does not start with an H1`);
  else if (!full.includes(`\n${title}\n`) && !full.startsWith(`${title}\n`)) {
    fail(`llms-full.txt: has no "${title}"`);
  }
}

// 4. No .md file has a relative link. 5. Every fenced code block has a language.
for (const file of markdown) {
  const text = readFileSync(file, 'utf8');
  let fenced = false;
  for (const [i, line] of text.split('\n').entries()) {
    const fence = /^(\s*)(`{3,})(.*)$/.exec(line);
    if (fence) {
      if (!fenced && !fence[3].trim()) fail(`${file}:${i + 1}: code block without a language`);
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const [, url] of line.matchAll(/\]\(([^)\s]+)/g)) {
      if (/^(\/|\.\/|\.\.\/)/.test(url) || !/^([a-z]+:|#)/.test(url)) {
        fail(`${file}:${i + 1}: relative link ${url}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`check-agent-files: ${problems.length} problems`);
  process.exit(1);
}
console.log(`check-agent-files: llms.txt, llms-full.txt and ${markdown.length} pages are fine`);
