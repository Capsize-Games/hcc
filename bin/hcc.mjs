#!/usr/bin/env node
/**
 * hcc bin launcher.
 *
 * Resolves this package's own node_modules/tsx (same ancestor walk-up
 * npm's flattener uses) and re-execs node through it, so `hcc` works
 * without tsx on PATH. See headlesscode's bin launcher.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	".."
);

/**
 * Fast path: answer --help/-h and --version/-v without booting
 * tsx, so those flags work with no node_modules installed.
 *
 * The usage text duplicates usage() in src/cli.ts. The .mjs
 * launcher cannot import that TypeScript module without the tsx
 * runtime this fast path exists to avoid, and hcc has no build
 * step emitting importable JS — so a shared import would need
 * the runtime we refuse to boot, and any "lighter exec" still
 * pays for a child process plus TS loader. The duplicated copy
 * is eight static lines; test/wrapper-fast-path.test.ts pins
 * wrapper output byte-equal to hccMain and fails on drift.
 */
const USAGE = [
	"hcc — interactive terminal interface for headlesscode",
	"",
	"Usage: hcc [--workspace <path>] [--resume <id>] [--model <model>] [--mode <mode>]",
	"       hcc --help | --version",
	"",
	"Opens the terminal chat. Each message starts one turn; /help lists",
	"chat commands once inside. Quit with /exit or Ctrl-D; press",
	"Ctrl-C twice to force quit a stuck turn.",
].join("\n");

/**
 * Print --help/-h or --version/-v directly and return true.
 * Mirrors hccMain's flag matching (anywhere in argv, help wins
 * over version). A version read failure returns false so the
 * caller falls through to the tsx path and its real error.
 */
function handleFastPath(argv) {
	if (argv.includes("--help") || argv.includes("-h")) {
		process.stdout.write(`${USAGE}\n`);
		return true;
	}
	if (argv.includes("--version") || argv.includes("-v")) {
		try {
			const manifest = JSON.parse(
				fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8")
			);
			process.stdout.write(`hcc ${manifest.version}\n`);
			return true;
		} catch {
			return false;
		}
	}
	return false;
}

function resolveTsxCli(dir) {
	const candidate = path.join(dir, "node_modules", "tsx", "dist", "cli.mjs");
	if (fs.existsSync(candidate)) return candidate;
	const parent = path.dirname(dir);
	if (parent === dir) return undefined;
	return resolveTsxCli(parent);
}

if (handleFastPath(process.argv.slice(2))) {
	// Answered above; exit naturally so piped stdout flushes
	// before the process ends (no explicit process.exit()).
	process.exitCode = 0;
} else {
	const tsxCli = resolveTsxCli(PKG_ROOT);
	if (!tsxCli) {
		console.error("hcc: tsx not found; run `npm install` first");
		process.exitCode = 2;
	} else {
		const entry = path.join(PKG_ROOT, "src", "cli.ts");
		const child = spawn(
			process.execPath,
			[tsxCli, entry, ...process.argv.slice(2)],
			{ stdio: "inherit", env: process.env }
		);
		// Forward termination signals so a real SIGINT/SIGTERM (boot
		// window before raw mode, kill from another terminal) reaches
		// the chat child instead of killing only this wrapper and
		// orphaning the child. Steady-state exits still mirror the
		// child's code below.
		const forward = (signal) => {
			if (child.exitCode === null && child.signalCode === null) {
				child.kill(signal);
			}
		};
		const onSigint = () => forward("SIGINT");
		const onSigterm = () => forward("SIGTERM");
		process.on("SIGINT", onSigint);
		process.on("SIGTERM", onSigterm);
		child.on("error", (error) => {
			console.error(`hcc: failed to start chat: ${error.message}`);
			process.exitCode = 1;
		});
		child.on("exit", (code, signal) => {
			process.removeListener("SIGINT", onSigint);
			process.removeListener("SIGTERM", onSigterm);
			if (signal !== null) {
				process.kill(process.pid, signal);
				process.exitCode = 1;
			} else {
				process.exitCode = code ?? 1;
			}
		});
	}
}
