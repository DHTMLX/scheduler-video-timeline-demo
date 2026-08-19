/**
 * Geometry presets for the video-in-a-timeline demo.
 *
 * rows          - number of timeline sections; the vertical resolution of the video
 * sampleColumns - horizontal sample resolution; NOT the number of grid columns
 * maxSegments   - events per row; the pool size is rows * maxSegments
 * gridColumns   - visible time-scale columns; must divide sampleColumns evenly
 *
 * Events are positioned by real dates with sub-column precision, so horizontal
 * resolution is independent of how many columns the scale draws. Keeping
 * gridColumns low removes thousands of grid cells from the DOM for free.
 */

export const MINUTES_PER_SAMPLE_COLUMN = 1;
export const MS_PER_SAMPLE_COLUMN = MINUTES_PER_SAMPLE_COLUMN * 60 * 1000;

export const PRESETS = {
	small: {
		label: "24 x 48 - 288 events",
		rows: 24,
		sampleColumns: 48,
		maxSegments: 12,
		gridColumns: 8
	},
	medium: {
		label: "48 x 96 - 960 events",
		rows: 48,
		sampleColumns: 96,
		maxSegments: 20,
		gridColumns: 12
	},
	large: {
		label: "72 x 144 - 2016 events",
		rows: 72,
		sampleColumns: 144,
		maxSegments: 28,
		gridColumns: 12
	},
	huge: {
		label: "96 x 192 - 3840 events",
		rows: 96,
		sampleColumns: 192,
		maxSegments: 40,
		gridColumns: 12
	}
};

export const DEFAULT_PRESET = "medium";

/**
 * A phone gets the small workload by default.
 *
 * The medium preset asks a phone for ~700 event repaints a frame, and a visitor
 * arriving from a link judges the component by whatever plays first. The heavier
 * presets stay one tap away in the toolbar.
 */
export function defaultPresetKey() {
	const shortSide = Math.min(window.innerWidth, window.innerHeight);
	return shortSide <= 520 ? "small" : DEFAULT_PRESET;
}

/** Bits dropped from every color channel. 4 => 4096 distinct colors, as in the Bryntum demo. */
export const DEFAULT_QUANTIZE_BITS = 4;

/** Base date of the timeline. Arbitrary - only the offsets from it carry meaning. */
export const VIEW_START = new Date(2026, 0, 1, 0, 0, 0, 0);

export function poolSize(preset) {
	return preset.rows * preset.maxSegments;
}

export function validatePreset(preset) {
	if (preset.sampleColumns % preset.gridColumns !== 0) {
		throw new Error(
			"sampleColumns (" + preset.sampleColumns + ") must be divisible by gridColumns (" + preset.gridColumns + ")"
		);
	}
	return preset;
}
