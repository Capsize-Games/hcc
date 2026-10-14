#!/usr/bin/env tsx
/**
 * hcc — interactive terminal interface for headlesscode.
 *
 * Bare `hcc` opens the terminal chat; all other arguments pass
 * through to it. Exit codes mirror headlesscode's chat command.
 */

import { createRequire } from "node:module";
import { terminalMain } from "headlesscode/src/terminal/cli.js";

export interface HccIo {
	stdout: Pick<typeof process.stdout, "write">;
}

function version(): string {
	const require = createRequire(import.meta.url);
	const manifest = require("../package.json") as { version: string };
	return manifest.version;
}

function usage(): string {
	return [
		"hcc — interactive terminal interface for headlesscode",
		"",
		"Usage: hcc [--workspace <path>] [--resume <id>] [--model <model>] [--mode <mode>]",
		"       hcc --help | --version",
		"",
		"Opens the terminal chat. Each message starts one turn; /help lists",
		"chat commands once inside.",
	].join("\n");
}

export async function hccMain(
	argv: string[],
	io: HccIo = { stdout: process.stdout }
): Promise<number> {
	if (argv.includes("--help") || argv.includes("-h")) {
		io.stdout.write(`${usage()}\n`);
		return 0;
	}
	if (argv.includes("--version") || argv.includes("-v")) {
		io.stdout.write(`hcc ${version()}\n`);
		return 0;
	}
	const passthrough = argv[0] === "chat" ? argv.slice(1) : argv;
	return terminalMain(passthrough, {
		output: process.stdout,
		errorOutput: process.stderr,
	});
}

const invoked = process.argv[1]?.endsWith("src/cli.ts") ?? false;
if (invoked) {
	hccMain(process.argv.slice(2))
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error: unknown) => {
			process.stderr.write(
				`hcc: unexpected error: ${error instanceof Error ? error.message : String(error)}\n`
			);
			process.exitCode = 2;
		});
}
