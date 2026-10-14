#!/usr/bin/env tsx
/**
 * hcc — interactive terminal interface for headlesscode.
 *
 * Bare `hcc` opens the terminal chat; all other arguments pass
 * through to it. Exit codes mirror headlesscode's chat command.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { terminalMain } from "headlesscode/src/terminal/cli.js";

export interface HccIo {
	stdout: Pick<typeof process.stdout, "write">;
}

interface PackageManifest {
	name?: string;
	version: string;
}

function readManifest(path: string): PackageManifest {
	return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

/**
 * Walk up from `fromUrl` to the hcc package root, so version
 * resolution keeps working under any src/dist layout or bundling
 * that leaves the entry point inside the package.
 */
export function packageRoot(fromUrl: string = import.meta.url): string {
	let dir = dirname(fileURLToPath(fromUrl));
	while (true) {
		const manifest = join(dir, "package.json");
		if (existsSync(manifest) && readManifest(manifest).name === "hcc") {
			return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) {
			throw new Error("hcc: package root not found");
		}
		dir = parent;
	}
}

export function packageVersion(fromUrl: string = import.meta.url): string {
	return readManifest(join(packageRoot(fromUrl), "package.json")).version;
}

function usage(): string {
	return [
		"hcc — interactive terminal interface for headlesscode",
		"",
		"Usage: hcc [--workspace <path>] [--resume <id>] [--model <model>] [--mode <mode>]",
		"       hcc --help | --version",
		"",
		"Opens the terminal chat. Each message starts one turn; /help lists",
		"chat commands once inside. Quit with /exit or Ctrl-D; press",
		"Ctrl-C twice to force quit a stuck turn.",
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
		io.stdout.write(`hcc ${packageVersion()}\n`);
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
