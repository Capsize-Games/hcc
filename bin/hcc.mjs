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

function resolveTsxCli(dir) {
	const candidate = path.join(dir, "node_modules", "tsx", "dist", "cli.mjs");
	if (fs.existsSync(candidate)) return candidate;
	const parent = path.dirname(dir);
	if (parent === dir) return undefined;
	return resolveTsxCli(parent);
}

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
