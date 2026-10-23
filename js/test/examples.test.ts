import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test("the SLA example prints what it claims", () => {
  const script = fileURLToPath(new URL("../examples/sla.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [script], { encoding: "utf8" });
  expect(output.trim().split(/\r?\n/)).toEqual([
    "opened 2026-12-24T16:30:00Z, due 2026-12-30T09:30:00.000Z",
    "used by 2026-12-29T11:00:00Z: 2.5 h",
    "working until 2026-12-29T12:00:00.000Z",
    "2026-12-24T16:30:00Z -> 2026-12-30T09:30:00.000Z",
    "2026-12-24T17:30:00Z -> 2026-12-30T10:00:00.000Z",
    "2026-12-29T11:00:00Z -> 2026-12-30T12:00:00.000Z",
  ]);
});
