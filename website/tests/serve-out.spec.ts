import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { expect, test } from '@playwright/test';

// Sends the path as written, without the normalisation a browser or fetch applies.
function status(baseURL: string | undefined, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    request(new URL(baseURL ?? ''), { path }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    })
      .on('error', reject)
      .end();
  });
}

test('a malformed percent escape is a bad request', async ({ baseURL }) => {
  expect(await status(baseURL, '/%')).toBe(400);
  expect(await status(baseURL, '/')).toBe(200);
});

test('a path into a sibling of out/ is not served', async ({ baseURL }) => {
  const sibling = 'out-sibling';
  mkdirSync(sibling, { recursive: true });
  writeFileSync(`${sibling}/secret.txt`, 'secret');
  try {
    expect(await status(baseURL, `/..%2f${sibling}/secret.txt`)).toBe(404);
  } finally {
    rmSync(sibling, { recursive: true, force: true });
  }
});
