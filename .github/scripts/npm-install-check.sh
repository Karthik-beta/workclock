#!/usr/bin/env bash
# Usage: npm-install-check.sh TARBALL
#
# Installs the packed npm package into a fresh project and checks that every
# entry point loads and type-checks from the installed files, so a file left
# out of `files` fails here instead of after publishing. Run from js/, where
# TypeScript is installed.
set -euo pipefail
tarball="$(realpath "$1")"
tsc="$(realpath node_modules/.bin/tsc)"
version="$(tar -xOzf "$tarball" package/package.json | node -p 'JSON.parse(require("fs").readFileSync(0)).version')"
cd "$(mktemp -d)"

npm init --yes > /dev/null
npm pkg set type=module
npm install --no-audit --no-fund "$tarball"

cat > check.mjs <<'EOF'
import { readFileSync } from "node:fs";
import { version, Schedule, WorkclockError } from "workclock";
import { initSync, version as webVersion } from "workclock/web";

const wasm = new URL("pkg/web/workclock_bg.wasm", import.meta.resolve("workclock/package.json"));
initSync({ module: readFileSync(wasm) });
if (webVersion() !== version()) throw new Error(`web ${webVersion()} != node ${version()}`);

const schedule = new Schedule({ rules: [{ type: "workday", start: "09:00", end: "17:00" }] });
schedule.between("2026-01-05T09:00:00Z", "2026-01-05T10:00:00Z");
if (typeof WorkclockError !== "function") throw new Error("WorkclockError is not exported");
console.log(version());
EOF
test "$(node check.mjs)" = "$version"

# Files the checks below would miss: the bundler build cannot run under
# Node, TypeScript falls back to bundler.d.ts when node.d.ts is missing, and
# nothing loads the README that npm shows.
node --input-type=module --eval '
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
const root = new URL("node_modules/workclock/", pathToFileURL(process.cwd() + "/"));
for (const file of ["README.md", "node.d.ts", "bundler.js", "pkg/bundler/package.json", "pkg/bundler/workclock.js", "pkg/bundler/workclock_bg.js", "pkg/bundler/workclock_bg.wasm"]) {
  if (!existsSync(new URL(file, root))) throw new Error(`missing ${file}`);
}'

# Type-checks the package's own declarations too (no skipLibCheck), so a
# missing .d.ts behind an `export *` fails. The bundler pass resolves
# bundler.d.ts instead of node.d.ts.
cat > check.ts <<'EOF'
import { NoWorkingTimeError, Schedule, version, WorkclockError } from "workclock";

const schedule: Schedule = new Schedule({ rules: [{ type: "workday", start: "09:00", end: "17:00" }] });
const ms: number = schedule.between("2026-01-05T09:00:00Z", "2026-01-05T10:00:00Z");
const kind = (error: WorkclockError): string =>
  error instanceof NoWorkingTimeError ? error.kind : version();
export { kind, ms };
EOF
cat > check-web.ts <<'EOF'
import init, { version } from "workclock/web";

await init();
export const webVersion: string = version();
EOF
lib=es2022,esnext.disposable,dom
"$tsc" --strict --noEmit --lib "$lib" --target es2022 --module nodenext --moduleResolution nodenext check.ts check-web.ts
"$tsc" --strict --noEmit --lib "$lib" --target es2022 --module esnext --moduleResolution bundler check.ts
