import { readFile } from 'node:fs/promises';
import path from 'node:path';
import init from 'workclock/web';

let ready: Promise<unknown> | undefined;

/**
 * Initialises workclock for code that runs at build time. The Node.js entry cannot find its
 * .wasm once bundled, so the web entry is given the bytes directly.
 */
export function initWorkclock() {
  ready ??= readFile(
    path.join(process.cwd(), 'node_modules/workclock/pkg/web/workclock_bg.wasm'),
  ).then((bytes) => init({ module_or_path: bytes }));
  return ready;
}
