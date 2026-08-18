/**
 * The event pool.
 *
 * A fixed set of rows * maxSegments scheduler events is created once and then
 * reused for the whole run - no event is ever added or removed while the video
 * plays. Each frame only rewrites the events whose segment actually changed.
 *
 * Unlike the Bryntum demo, positions are not faked in a renderer: every segment
 * gets a real start_date / end_date and the timeline places it with its own
 * date-to-pixel math.
 */

import { MS_PER_SAMPLE_COLUMN, VIEW_START } from "./config.js";

const HIDDEN = -1;

/**
 * Distinct from HIDDEN so the first frame writes every slot, including the ones it
 * leaves unused. Without it those slots keep the dates `parse()` gave them - and
 * `addEvent()` stretches anything shorter than `time_step` to a five minute
 * minimum, which would leave a stray bar at the start of every under-used row.
 */
const UNSET = -2;

/**
 * An end date landing exactly on a column boundary is drawn one pixel short by
 * the timeline - see the `delta !== 0` branch of `_timeline_getX`. Deliberate for
 * a schedule, where it keeps an event visually inside its column, but here it
 * lets the column separator show through between two adjacent segments.
 *
 * Ending a millisecond earlier lands on the same pixel everywhere else (a pixel
 * is thousands of milliseconds wide at this scale) and removes the seam.
 */
const END_INSET_MS = 1;

function buildColorCache() {
	const cache = new Map();
	return function cssColor(packed) {
		let value = cache.get(packed);
		if (value === undefined) {
			value = "#" + (packed | 0x1000000).toString(16).slice(1);
			cache.set(packed, value);
		}
		return value;
	};
}

export function createEventPool(scheduler, preset) {
	const { rows, maxSegments } = preset;
	const cssColor = buildColorCache();
	const baseTime = VIEW_START.getTime();

	const events = new Array(rows * maxSegments);
	const sections = new Array(rows);

	// diff state, mirrors what is currently on screen
	const stateStart = new Int32Array(rows * maxSegments).fill(UNSET);
	const stateEnd = new Int32Array(rows * maxSegments).fill(UNSET);
	const stateColor = new Int32Array(rows * maxSegments).fill(UNSET);

	for (let row = 0; row < rows; row++) {
		// section keys start at 1: render_timeline_event() treats a falsy section as unassigned
		sections[row] = { key: row + 1, label: String(row + 1) };

		for (let slot = 0; slot < maxSegments; slot++) {
			const index = row * maxSegments + slot;
			events[index] = {
				id: index + 1,
				section_id: row + 1,
				text: "",
				color: "#000000",
				start_date: new Date(baseTime),
				end_date: new Date(baseTime)
			};
		}
	}

	const changed = new Array(rows * maxSegments);

	return {
		sections,
		size: events.length,

		load() {
			scheduler.parse(events);
			// re-read through the API: parse() stores its own normalized copies
			for (let i = 0; i < events.length; i++) {
				events[i] = scheduler.getEvent(i + 1);
			}
		},

		/**
		 * Writes a frame into the pool and returns the events that changed.
		 * @returns {{list: Array, count: number}} reused buffer - do not retain
		 */
		applyFrame(frame) {
			const { segments, counts } = frame;
			let changedCount = 0;

			for (let row = 0; row < rows; row++) {
				const rowSegments = segments[row];
				const used = counts[row];

				for (let slot = 0; slot < maxSegments; slot++) {
					const index = row * maxSegments + slot;
					const event = events[index];

					if (slot < used) {
						const segment = rowSegments[slot];
						if (
							stateStart[index] === segment.start &&
							stateEnd[index] === segment.end &&
							stateColor[index] === segment.color
						) {
							continue;
						}

						// mutate the existing Date objects instead of allocating new ones
						event.start_date.setTime(baseTime + segment.start * MS_PER_SAMPLE_COLUMN);
						event.end_date.setTime(baseTime + segment.end * MS_PER_SAMPLE_COLUMN - END_INSET_MS);
						event.color = cssColor(segment.color);

						stateStart[index] = segment.start;
						stateEnd[index] = segment.end;
						stateColor[index] = segment.color;
					} else {
						if (stateStart[index] === HIDDEN) continue;

						// zero length at the view start falls outside is_visible_events(),
						// so the scheduler drops the node instead of drawing a sliver
						event.start_date.setTime(baseTime);
						event.end_date.setTime(baseTime);

						stateStart[index] = HIDDEN;
						stateEnd[index] = HIDDEN;
						stateColor[index] = HIDDEN;
					}

					changed[changedCount++] = event;
				}
			}

			return { list: changed, count: changedCount };
		},

		/** Forgets what is on screen, so the next frame rewrites every event. */
		reset() {
			stateStart.fill(UNSET);
			stateEnd.fill(UNSET);
			stateColor.fill(UNSET);
		}
	};
}
