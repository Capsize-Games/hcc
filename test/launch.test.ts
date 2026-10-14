import assert from "node:assert/strict";
import test from "node:test";
import { terminalMain } from "headlesscode/src/terminal/cli.js";
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

test("hcc reaches headlesscode chat", async () => {
	const io = capture();
	const code = await terminalMain(["--help"], {
		output: io.stdout as unknown as NodeJS.WriteStream,
	});
	assert.equal(code, 0);
	assert.match(io.text(), /terminal chat|Usage/i);
});
