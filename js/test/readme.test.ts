import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Runs the ```js block of a README against the package. A statement ending in
// `// Date <ISO string>` or `// <number> ms` must give that result.
function run(readme: URL): void {
  const block = /^```js\n([\s\S]*?)^```$/m.exec(readFileSync(readme, "utf8").replace(/\r\n/g, "\n"));
  expect(block, `no js code block in ${readme}`).not.toBeNull();
  const lines = block![1].split("\n").map((line) => {
    const match = /^(.*);\s*\/\/\s*(Date \S+|-?\d+ ms)$/.exec(line);
    return match ? `check(${match[1]}, ${JSON.stringify(match[2])});` : line;
  });
  const script = `${lines.join("\n")}
function check(value, expected) {
  const actual = value instanceof Date ? \`Date \${value.toISOString()}\` : \`\${value} ms\`;
  if (actual !== expected) throw new Error(\`expected \${expected}, got \${actual}\`);
}`;
  execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
}

test("the repository README's JavaScript example runs", () => {
  run(new URL("../../README.md", import.meta.url));
});
