import { expect, test } from "vitest";

import pkg from "../package.json" with { type: "json" };
import { version } from "../pkg/node/workclock.js";

test("WASM module version matches package.json", () => {
  expect(version()).toBe(pkg.version);
});
