/**
 * Timing overlay.
 *
 * Numbers are averaged over a rolling window and the DOM is only touched a few
 * times a second - a HUD that repaints every frame measures itself.
 */

const WINDOW_SIZE = 60;
const REFRESH_MS = 250;

function createSeries() {
	return { values: new Float64Array(WINDOW_SIZE), index: 0, filled: 0 };
}

function push(series, value) {
	series.values[series.index] = value;
	series.index = (series.index + 1) % WINDOW_SIZE;
	if (series.filled < WINDOW_SIZE) series.filled++;
}

function average(series) {
	if (!series.filled) return 0;
	let total = 0;
	for (let i = 0; i < series.filled; i++) total += series.values[i];
	return total / series.filled;
}

function percentile(series, fraction) {
	if (!series.filled) return 0;
	const sorted = Array.prototype.slice.call(series.values, 0, series.filled).sort(function (a, b) {
		return a - b;
	});
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export function createHud(root) {
	const fields = {};
	root.querySelectorAll("[data-hud]").forEach(function (node) {
		fields[node.getAttribute("data-hud")] = node;
	});

	const series = {
		sample: createSeries(),
		encode: createSeries(),
		diff: createSeries(),
		render: createSeries(),
		total: createSeries(),
		changed: createSeries(),
		interval: createSeries()
	};

	let lastRefresh = 0;
	let lastFrameStart = 0;
	let frames = 0;

	function set(name, value) {
		const node = fields[name];
		if (node) node.textContent = value;
	}

	return {
		record(timings) {
			const now = performance.now();
			if (lastFrameStart) push(series.interval, now - lastFrameStart);
			lastFrameStart = now;
			frames++;

			push(series.sample, timings.sample);
			push(series.encode, timings.encode);
			push(series.diff, timings.diff);
			push(series.render, timings.render);
			push(series.total, timings.total);
			push(series.changed, timings.changed);

			if (now - lastRefresh < REFRESH_MS) return;
			lastRefresh = now;

			const interval = average(series.interval);

			set("fps", interval ? (1000 / interval).toFixed(1) : "-");
			set("sample", average(series.sample).toFixed(1));
			set("encode", average(series.encode).toFixed(1));
			set("diff", average(series.diff).toFixed(1));
			set("render", average(series.render).toFixed(1));
			set("total", average(series.total).toFixed(1));
			set("p95", percentile(series.total, 0.95).toFixed(1));
			set("changed", Math.round(average(series.changed)));
			set("frames", String(frames));
		},

		setStatic(name, value) {
			set(name, value);
		},

		reset() {
			Object.keys(series).forEach(function (key) {
				series[key] = createSeries();
			});
			lastFrameStart = 0;
			frames = 0;
		},

		snapshot() {
			return {
				frames,
				fps: average(series.interval) ? 1000 / average(series.interval) : 0,
				sample: average(series.sample),
				encode: average(series.encode),
				diff: average(series.diff),
				render: average(series.render),
				total: average(series.total),
				totalP95: percentile(series.total, 0.95),
				changed: average(series.changed)
			};
		}
	};
}
