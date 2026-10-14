import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chatHelp } from "headlesscode/src/terminal/chat.js";

const KEYBOARD_STATES = [
	"S1",
	"S2",
	"S3",
	"S4",
	"S5",
	"S6",
	"S7",
	"S8",
	"S9",
	"S10",
	"S11",
	"S12",
	"S13",
];

function keyboardDoc(): string {
	const root = dirname(dirname(fileURLToPath(import.meta.url)));
	return readFileSync(join(root, "docs", "KEYBOARD.md"), "utf8");
}

test("upstream /help documents the keyboard exits", () => {
	const help = chatHelp();
	assert.match(help, /Ctrl-C cancels an active turn/);
	assert.match(help, /twice force quits/);
	assert.match(help, /Ctrl-D exits/);
});

test("KEYBOARD.md names every audited state", () => {
	const doc = keyboardDoc();
	for (const state of KEYBOARD_STATES) {
		assert.ok(doc.includes(state), `KEYBOARD.md is missing ${state}`);
	}
	for (const followUp of ["H1", "H2", "H3"]) {
		assert.ok(doc.includes(followUp), `missing ${followUp}`);
	}
});
