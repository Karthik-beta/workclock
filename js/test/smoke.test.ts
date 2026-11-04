import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

import pkg from "../package.json" with { type: "json" };
import { version as nodeVersion } from "../node.js";
import { initSync, version as webVersion } from "../web.js";

test("the node build reports the package version", () => {
  expect(nodeVersion()).toBe(pkg.version);
});

test("the web build runs once initialised", () => {
  const module = readFileSync(new URL("../pkg/web/workclock_bg.wasm", import.meta.url));
  initSync({ module });
  expect(webVersion()).toBe(pkg.version);
});

test("Node resolves the package through its exports map", () => {
  const script = "import { version } from 'workclock'; console.log(version());";
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  expect(output.trim()).toBe(pkg.version);
});
