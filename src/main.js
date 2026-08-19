/**
 * Video-in-a-timeline demo - wiring and frame loop.
 *
 * Pipeline per frame:
 *   source -> sampler -> encoder -> event pool (diff) -> scheduler.updateEvent()
 *
 * The only thing the scheduler is asked to do is repaint the events whose
 * segment actually changed. Everything before that stage exists to keep that
 * number as small as honestly possible.
 */

// scheduler.js first, so its stylesheet lands ahead of the overrides in style.css
import { scheduler } from "./scheduler.js";
import "./style.css";

import { PRESETS, defaultPresetKey, DEFAULT_QUANTIZE_BITS, validatePreset, poolSize } from "./config.js";
import { createSampler } from "./sampler.js";
import { createFrameEncoder } from "./quantize.js";
import { createEventPool } from "./pool.js";
import { createVideoTimeline, applyPreset, fitToContainer } from "./timeline-view.js";
import { createHud } from "./hud.js";
import { createVideoSource, createGeneratedSource } from "./video-source.js";

const BENCHMARK_WARMUP_MS = 3000;
const BENCHMARK_MEASURE_MS = 10000;

// options live in the hash so they survive a static host with no query rewriting
const params = new URLSearchParams(location.hash.slice(1));
const presetKey = PRESETS[params.get("preset")] ? params.get("preset") : defaultPresetKey();

const hud = createHud(document.getElementById("hud"));

let preset = validatePreset(PRESETS[presetKey]);
let pool = createEventPool(scheduler, preset);
let sampler;
let encoder;

createVideoTimeline(scheduler, preset, pool.sections, "scheduler_here");

function fitLayout() {
	sampler.setCellAspect(fitToContainer(scheduler, preset).cellAspect);
	// row geometry changed, so nothing on screen can be trusted as a diff baseline
	pool.reset();
}

/** Builds everything that depends on the preset. */
function buildPipeline() {
	pool.load();
	sampler = createSampler(preset.sampleColumns, preset.rows);
	encoder = createFrameEncoder(preset, DEFAULT_QUANTIZE_BITS);

	hud.setStatic("pool", String(poolSize(preset)));
	hud.setStatic("grid", preset.rows + " rows x " + preset.sampleColumns + " samples");
	fitLayout();
}

/**
 * Swaps resolution without a reload, so whatever is playing keeps playing - an
 * uploaded file could not survive a page load anyway.
 */
function usePreset(key) {
	const wasRunning = running;
	stop();

	preset = validatePreset(PRESETS[key]);
	scheduler.clearAll();
	pool = createEventPool(scheduler, preset);
	applyPreset(scheduler, preset, pool.sections);
	buildPipeline();

	// keep the option shareable, without navigating
	params.set("preset", key);
	history.replaceState(null, "", "#" + params.toString());

	if (wasRunning) start();
}

buildPipeline();

const generated = createGeneratedSource();
let videoSource = null;
let source = generated;
let running = false;

// ---------------------------------------------------------------- frame loop

function processFrame() {
	if (!running) return;

	if (source.ready) {
		const startedAt = performance.now();

		const pixels = sampler.sample(source.drawable, source.width, source.height);
		const sampledAt = performance.now();

		const frame = encoder.encode(pixels);
		const encodedAt = performance.now();

		const changed = pool.applyFrame(frame);
		const diffedAt = performance.now();

		const list = changed.list;
		for (let i = 0; i < changed.count; i++) {
			scheduler.updateEvent(list[i].id);
		}
		const renderedAt = performance.now();

		hud.record({
			sample: sampledAt - startedAt,
			encode: encodedAt - sampledAt,
			diff: diffedAt - encodedAt,
			render: renderedAt - diffedAt,
			total: renderedAt - startedAt,
			changed: changed.count
		});
	}

	source.requestFrame(processFrame);
}

function start() {
	if (running) return;
	running = true;
	document.getElementById("empty-state").hidden = true;
	hud.reset();
	source.start();
	source.requestFrame(processFrame);
	setStatus("playing");
}

function stop() {
	const wasRunning = running;
	running = false;
	source.cancelFrame();
	source.stop();
	// nothing was playing, so leave whatever the status was saying
	if (wasRunning) setStatus("paused");
}

// ------------------------------------------------------------------ sources

function useSource(next) {
	const wasRunning = running;
	stop();

	source = next;
	hud.setStatic("source", source.label);
	pool.reset();

	if (wasRunning) start();
}

function ensureVideoSource() {
	if (!videoSource) videoSource = createVideoSource();
	return videoSource;
}

function loadVideoUrl(url, description) {
	const video = ensureVideoSource();
	video
		.setSource(url)
		.then(function () {
			useSource(video);
			hud.setStatic("source", description || video.label);
			start();
		})
		.catch(function (error) {
			reportProblem("could not play: " + error.message);
		});
}

function loadCamera() {
	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		reportProblem("camera not available");
		return;
	}
	navigator.mediaDevices
		.getUserMedia({ video: true, audio: false })
		.then(function (stream) {
			const video = ensureVideoSource();
			return video.setStream(stream).then(function () {
				useSource(video);
				hud.setStatic("source", "camera");
				start();
			});
		})
		.catch(function (error) {
			reportProblem("camera refused: " + error.message);
		});
}

// --------------------------------------------------------------- benchmark

function wait(ms) {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms);
	});
}

/** Warm up, then measure a fixed window. Resolves with the timings. */
function runBenchmark() {
	const wasRunning = running;

	// the numbers land in the HUD, which is a closed sheet on a phone
	showStats(true);
	start();
	setStatus("benchmarking, " + (BENCHMARK_WARMUP_MS + BENCHMARK_MEASURE_MS) / 1000 + "s");

	return wait(BENCHMARK_WARMUP_MS)
		.then(function () {
			hud.reset();
			return wait(BENCHMARK_MEASURE_MS);
		})
		.then(function () {
			const result = hud.snapshot();
			renderResult(result);
			if (!wasRunning) stop();
			return result;
		});
}

function renderResult(result) {
	const table = document.getElementById("results");

	table.innerHTML =
		"<tr><th>fps</th><td>" + result.fps.toFixed(1) + "</td></tr>" +
		"<tr><th>scheduler ms</th><td>" + result.render.toFixed(1) + "</td></tr>" +
		"<tr><th>frame ms</th><td>" + result.total.toFixed(1) + "</td></tr>" +
		"<tr><th>p95 ms</th><td>" + result.totalP95.toFixed(1) + "</td></tr>" +
		"<tr><th>changed</th><td>" + Math.round(result.changed) + "</td></tr>";
	table.hidden = false;
	setStatus("benchmark complete");
}

// ------------------------------------------------------------------- status

function setStatus(text) {
	document.getElementById("status").textContent = text;
}

/**
 * The HUD is a sidebar on a wide screen and a sheet on a phone; the class does
 * nothing in the first case, so both paths share one call.
 */
function showStats(open) {
	document.body.classList.toggle("stats-open", open);
	document.getElementById("btn-stats").setAttribute("aria-expanded", String(open));
}

/** Something failed, and the message is only useful if it is on screen. */
function reportProblem(text) {
	setStatus(text);
	showStats(true);
}

// --------------------------------------------------------------------- init

function useGeneratedSource() {
	useSource(generated);
	start();
}

function on(id, handler) {
	document.getElementById(id).addEventListener("click", handler);
}

function bindControls() {
	const presetSelect = document.getElementById("preset");
	Object.keys(PRESETS).forEach(function (key) {
		const option = document.createElement("option");
		option.value = key;
		option.textContent = PRESETS[key].label;
		option.selected = key === presetKey;
		presetSelect.appendChild(option);
	});
	presetSelect.addEventListener("change", function () {
		usePreset(presetSelect.value);
	});

	on("btn-play", function () {
		if (running) stop();
		else start();
	});

	// the toolbar and the empty state offer the same three sources
	on("btn-generated", useGeneratedSource);
	on("empty-generated", useGeneratedSource);
	on("btn-camera", loadCamera);
	on("empty-camera", loadCamera);

	document.getElementById("file").addEventListener("change", function (event) {
		const file = event.target.files && event.target.files[0];
		if (file) loadVideoUrl(URL.createObjectURL(file), file.name);
	});

	on("btn-bench", runBenchmark);

	on("btn-stats", function () {
		showStats(!document.body.classList.contains("stats-open"));
	});

	let resizeTimer = null;
	window.addEventListener("resize", function () {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(fitLayout, 200);
	});

	bindDropZone();
}

/**
 * The whole page is a drop target, empty state included.
 *
 * Both dragenter and dragover have to be cancelled, and an explicit dropEffect
 * set - without it the browser is free to resolve the effect to "none" and then
 * silently refuses the drop.
 */
function bindDropZone() {
	const body = document.body;

	function carriesFile(event) {
		const types = event.dataTransfer && event.dataTransfer.types;
		return !!types && Array.prototype.indexOf.call(types, "Files") > -1;
	}

	function offer(event) {
		if (!carriesFile(event)) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		body.classList.add("dropping");
	}

	body.addEventListener("dragenter", offer);
	body.addEventListener("dragover", offer);

	body.addEventListener("dragleave", function (event) {
		// relatedTarget is null when the pointer leaves the window entirely
		if (!event.relatedTarget) body.classList.remove("dropping");
	});

	body.addEventListener("drop", function (event) {
		body.classList.remove("dropping");
		if (!carriesFile(event)) return;

		event.preventDefault();
		const file = event.dataTransfer.files && event.dataTransfer.files[0];
		if (file) loadVideoUrl(URL.createObjectURL(file), file.name);
	});
}

bindControls();

hud.setStatic("source", "nothing playing yet");
setStatus("pick a source to start");

// nothing plays until the viewer chooses a source. `source` still points at the
// generated clip, so play/pause and the benchmark work straight from the empty state.

// the scale header only gets its height after the first layout pass, so the row
// fit computed during init is one measurement early - redo it once it settles
requestAnimationFrame(function () {
	requestAnimationFrame(fitLayout);
});

// handle for automated runs
window.videoBenchmark = {
	preset,
	run: runBenchmark,
	snapshot: function () {
		return hud.snapshot();
	},
	start,
	stop
};
