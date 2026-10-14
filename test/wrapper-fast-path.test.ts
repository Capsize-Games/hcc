import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { hccMain } from "../src/cli.js";

const HELP_FLAGS = ["--help", "-h"];
const VERSION_FLAGS = ["--version", "-v"];

function repoRoot(): string {
	return dirname(dirname(fileURLToPath(import.meta.url)));
}

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

/** Canonical output straight from src/cli.ts. */
async function oracle(flag: string): Promise<string> {
	const io = capture();
	const code = await hccMain([flag], io);
	assert.equal(code, 0);
	return io.text();
}

/**
 * Fixture install: package.json + bin/hcc.mjs, but no
 * node_modules — tsx is unresolvable from inside it.
 */
function makeFixture(): string {
	const dir = mkdtempSync(join(tmpdir(), "hcc-fast-path-"));
	mkdirSync(join(dir, "bin"), { recursive: true });
	copyFileSync(join(repoRoot(), "package.json"), join(dir, "package.json"));
	copyFileSync(join(repoRoot(), "bin", "hcc.mjs"), join(dir, "bin", "hcc.mjs"));
	return dir;
}

function fixtureVersion(dir: string): string {
	const manifest = JSON.parse(
		readFileSync(join(dir, "package.json"), "utf8")
	) as { version: string };
	return manifest.version;
}

function withFixture(run: (dir: string, wrapper: string) => void): void {
	const dir = makeFixture();
	try {
		run(dir, join(dir, "bin", "hcc.mjs"));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

for (const flag of VERSION_FLAGS) {
	test(`wrapper ${flag} works with no node_modules`, async () => {
		const expected = await oracle(flag);
		assert.match(expected, /^hcc \d+\.\d+\.\d+\n$/);
		withFixture((dir, wrapper) => {
			assert.equal(expected, `hcc ${fixtureVersion(dir)}\n`);
			const child = spawnSync(process.execPath, [wrapper, flag], {
				encoding: "utf8",
			});
			assert.equal(child.status, 0);
			assert.equal(child.stdout, expected);
			assert.equal(child.stderr, "");
		});
	});
}

for (const flag of HELP_FLAGS) {
	test(`wrapper ${flag} works with no node_modules`, async () => {
		const expected = await oracle(flag);
		withFixture((_dir, wrapper) => {
			const child = spawnSync(process.execPath, [wrapper, flag], {
				encoding: "utf8",
			});
			assert.equal(child.status, 0);
			assert.equal(child.stdout, expected);
			assert.equal(child.stderr, "");
		});
	});
}

for (const flag of [...HELP_FLAGS, ...VERSION_FLAGS]) {
	test(`wrapper ${flag} never boots tsx`, async () => {
		const expected = await oracle(flag);
		const dir = makeFixture();
		try {
			// Poison any resolvable tsx: if the wrapper execs it,
			// this fails loudly instead of printing the answer.
			const shimDir = join(dir, "node_modules", "tsx", "dist");
			mkdirSync(shimDir, { recursive: true });
			writeFileSync(
				join(shimDir, "cli.mjs"),
				'process.stderr.write("poisoned tsx booted\\n");\n' +
					"process.exit(99);\n"
			);
			const child = spawnSync(
				process.execPath,
				[join(dir, "bin", "hcc.mjs"), flag],
				{ encoding: "utf8" }
			);
			assert.equal(child.status, 0);
			assert.equal(child.stdout, expected);
			assert.equal(child.stderr, "");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test(`wrapper ${flag} matches hccMain byte-exactly`, async () => {
		const expected = await oracle(flag);
		const child = spawnSync(
			process.execPath,
			[join(repoRoot(), "bin", "hcc.mjs"), flag],
			{ encoding: "utf8" }
		);
		assert.equal(child.status, 0);
		assert.equal(child.stdout, expected);
		assert.equal(child.stderr, "");
	});
}
