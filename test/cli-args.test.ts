import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { hccMain } from "../src/cli.js";

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

function manifestVersion(): string {
	const root = dirname(dirname(fileURLToPath(import.meta.url)));
	const manifest = JSON.parse(
		readFileSync(join(root, "package.json"), "utf8")
	) as { version: string };
	return manifest.version;
}

// An unknown option makes headlesscode report the offending flag
// and exit 2 without launching the chat, which exposes exactly
// which arguments hcc passed through.
const BOGUS = "--bogus-hcc-probe";

test("hcc strips a leading chat prefix before passthrough", async () => {
	const io = capture();
	const code = await hccMain(["chat", BOGUS], io);
	assert.equal(code, 2);
	assert.match(io.text(), new RegExp(`Unknown chat option: ${BOGUS}`));
	assert.doesNotMatch(io.text(), /Unknown chat option: chat/);
});

test("hcc chat prefix matches bare passthrough", async () => {
	const prefixed = capture();
	await hccMain(["chat", BOGUS], prefixed);
	const bare = capture();
	await hccMain([BOGUS], bare);
	assert.equal(prefixed.text(), bare.text());
});

test("hcc -h prints the same help as --help", async () => {
	const short = capture();
	const shortCode = await hccMain(["-h"], short);
	const long = capture();
	const longCode = await hccMain(["--help"], long);
	assert.equal(shortCode, 0);
	assert.equal(longCode, 0);
	assert.equal(short.text(), long.text());
	assert.match(short.text(), /hcc — interactive terminal interface/);
});

test("hcc -v prints the same version as --version", async () => {
	const short = capture();
	const shortCode = await hccMain(["-v"], short);
	assert.equal(shortCode, 0);
	assert.equal(short.text(), `hcc ${manifestVersion()}\n`);
	assert.match(short.text(), /^hcc \d+\.\d+\.\d+\n$/);
});
