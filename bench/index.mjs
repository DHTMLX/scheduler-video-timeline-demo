/**
 * Headless benchmark runner.
 *
 * Runs a fixed warm-up plus measurement window against the built bundle and
 * prints the timings. The built-in generated clip is used, so runs are
 * comparable across machines and need no video file.
 *
 *   npm run bench                     # builds, serves, measures
 *   PRESET=large npm run bench
 *   BASE_URL=http://localhost:3000 node bench/index.mjs   # an already-running server
 *
 * Environment: PRESET, WIDTH, HEIGHT, BASE_URL.
 */

import { PRESETS, DEFAULT_PRESET } from "../src/config.js";
import { startPreviewServer } from "./preview-server.mjs";
import { runPage } from "./run-page.mjs";
import { printReport } from "./report.mjs";

function readPreset() {
	const key = process.env.PRESET || DEFAULT_PRESET;
	if (!PRESETS[key]) {
		throw new Error("unknown PRESET " + JSON.stringify(key) + "; expected one of " + Object.keys(PRESETS).join(", "));
	}
	return key;
}

function readSize(name, fallback) {
	if (process.env[name] === undefined) return fallback;

	const value = Number(process.env[name]);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(name + " must be a positive integer, got " + JSON.stringify(process.env[name]));
	}
	return value;
}

const preset = readPreset();
const width = readSize("WIDTH", 1440);
const height = readSize("HEIGHT", 900);

// BASE_URL points the run at a server that is already up; otherwise the built
// bundle is served here, which keeps `npm run bench` a single command
const external = process.env.BASE_URL;
const server = external ? { url: external, close: () => Promise.resolve() } : await startPreviewServer();

try {
	const { result, pool, grid, agent } = await runPage({ url: server.url, preset, width, height });
	printReport({ preset, width, height, pool, grid, agent, result });
} finally {
	await server.close();
}
