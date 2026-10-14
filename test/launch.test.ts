import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { terminalMain } from "headlesscode/src/terminal/cli.js";
import { hccMain, isMainModule, packageVersion } from "../src/cli.js";

function capture() {
	let text = "";
	const sink = {
		write: (chunk: string): boolean => {
			text += chunk;
			return true;
		},
	};
	return { stdout: sink, errorOutput: sink, text: () => text };
}

function repoRoot(): string {
	return dirname(dirname(fileURLToPath(import.meta.url)));
}

function manifestVersion(): string {
	const manifest = JSON.parse(
		readFileSync(join(repoRoot(), "package.json"), "utf8")
	) as { version: string };
	return manifest.version;
}

test("hcc --help describes the command", async () => {
	const io = capture();
	const code = await hccMain(["--help"], io);
	assert.equal(code, 0);
	assert.match(io.text(), /hcc — interactive terminal interface/);
});

test("hcc --version prints a semver", async () => {
	const io = capture();
	const code = await hccMain(["--version"], io);
	assert.equal(code, 0);
	assert.match(io.text(), /^hcc \d+\.\d+\.\d+\n$/);
});

test("hcc --version matches package.json byte-exactly", async () => {
	const io = capture();
	const code = await hccMain(["--version"], io);
	assert.equal(code, 0);
	assert.equal(io.text(), `hcc ${manifestVersion()}\n`);
});

test("packageVersion resolves from this test file", () => {
	assert.equal(packageVersion(import.meta.url), manifestVersion());
});

test("packageVersion resolves from a nested dist-style path", () => {
	const nested = pathToFileURL(
		join(repoRoot(), "dist", "nested", "cli.js")
	).href;
	assert.equal(packageVersion(nested), manifestVersion());
});

test("hcc reaches headlesscode chat", async () => {
	const io = capture();
	const code = await terminalMain(["--help"], {
		output: io.stdout as unknown as NodeJS.WriteStream,
	});
	assert.equal(code, 0);
	assert.match(io.text(), /terminal chat|Usage/i);
});

test("isMainModule matches the current module file", () => {
	const cliPath = join(repoRoot(), "src", "cli.ts");
	const cliUrl = pathToFileURL(cliPath).href;
	assert.equal(isMainModule(cliPath, cliUrl), true);
	assert.equal(isMainModule(cliPath), true);
});

test("isMainModule rejects other entry points", () => {
	const cliUrl = pathToFileURL(join(repoRoot(), "src", "cli.ts")).href;
	const other = fileURLToPath(import.meta.url);
	assert.equal(isMainModule(other, cliUrl), false);
	assert.equal(isMainModule(other), false);
});

test("isMainModule rejects undefined argv1", () => {
	const cliUrl = pathToFileURL(join(repoRoot(), "src", "cli.ts")).href;
	assert.equal(isMainModule(undefined, cliUrl), false);
	assert.equal(isMainModule(undefined), false);
});
