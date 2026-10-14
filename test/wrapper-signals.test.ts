import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	".."
);
const WRAPPER = path.join(PKG_ROOT, "bin", "hcc.mjs");
const LINUX_ONLY = { skip: process.platform !== "linux" };

test("wrapper mirrors the child exit code", () => {
	const child = spawnSync(process.execPath, [WRAPPER, "--version"], {
		encoding: "utf8",
	});
	assert.equal(child.status, 0);
	assert.match(child.stdout, /^hcc \d+\.\d+\.\d+\n$/);
});

/** Direct children of pid, via /proc (Linux only). */
function childPids(pid: number): number[] {
	const found: number[] = [];
	for (const entry of readdirSync("/proc")) {
		if (!/^\d+$/.test(entry)) continue;
		const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
		const ppid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
		if (ppid === pid) found.push(Number(entry));
	}
	return found;
}

function pidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function waitFor(
	ready: () => boolean,
	timeoutMs: number,
	what: string
): Promise<void> {
	const start = Date.now();
	while (!ready()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error(`timed out waiting for ${what}`);
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	test(
		`wrapper forwards ${signal} to the child (no orphan)`,
		{ ...LINUX_ONLY, timeout: 60000 },
		async () => {
			const wrapper = spawn(process.execPath, [WRAPPER], {
				cwd: PKG_ROOT,
				stdio: ["pipe", "pipe", "pipe"],
				detached: true,
			});
			assert.ok(wrapper.pid !== undefined);
			const pid: number = wrapper.pid;
			const exited = new Promise<void>((resolve) =>
				wrapper.on("exit", () => resolve())
			);
			try {
				let output = "";
				const onData = (chunk: Buffer): void => {
					output += chunk.toString();
				};
				wrapper.stdout.on("data", onData);
				wrapper.stderr.on("data", onData);
				await waitFor(() => output.includes("Session "), 45000, "chat to boot");
				await waitFor(() => childPids(pid).length > 0, 5000, "wrapper child");
				const [childPid] = childPids(pid);
				assert.ok(pidAlive(childPid));

				process.kill(pid, signal);
				const timeout = new Promise<never>((_resolve, reject) => {
					const timer = setTimeout(
						() => reject(new Error("wrapper did not exit")),
						10000
					);
					timer.unref();
				});
				await Promise.race([exited, timeout]);

				// The wrapper must terminate abnormally (never a
				// clean success) and take the child with it.
				const failed = wrapper.signalCode !== null || wrapper.exitCode !== 0;
				assert.ok(failed, `wrapper exited 0 after ${signal}`);
				assert.ok(!pidAlive(childPid), `child ${childPid} survived ${signal}`);
			} finally {
				wrapper.stdin.destroy();
				try {
					process.kill(-pid, "SIGKILL");
				} catch {
					// Already gone.
				}
				await exited;
			}
		}
	);
}
