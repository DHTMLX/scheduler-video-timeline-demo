/**
 * Turns a sampled frame into per-row colored segments.
 *
 * Three reductions happen here, all of them aimed at giving the scheduler less
 * work rather than making it work faster:
 *
 *   1. color quantization  - low bits dropped from each channel, so visually
 *                            identical neighbours become byte-identical
 *   2. run-length encoding - consecutive identical samples collapse into one run
 *   3. segment merging     - rows longer than maxSegments are merged down, always
 *                            sacrificing the cheapest boundary first
 *
 * Everything is allocated once and reused; a steady-state frame allocates nothing.
 */

const MAX_MERGE_COST = Number.MAX_VALUE;

function colorDistance(r1, g1, b1, r2, g2, b2) {
	const dr = r1 - r2;
	const dg = g1 - g2;
	const db = b1 - b2;
	return dr * dr + dg * dg + db * db;
}

export function createFrameEncoder(preset, quantizeBits) {
	const { rows, sampleColumns, maxSegments } = preset;
	const mask = (0xff << quantizeBits) & 0xff;

	// working buffers for a single row, sized for the worst case (every sample its own run)
	const runStart = new Int32Array(sampleColumns);
	const runEnd = new Int32Array(sampleColumns);
	const runR = new Int32Array(sampleColumns);
	const runG = new Int32Array(sampleColumns);
	const runB = new Int32Array(sampleColumns);
	const mergeCost = new Float64Array(sampleColumns);

	// reusable output segments
	const segments = new Array(rows);
	for (let r = 0; r < rows; r++) {
		segments[r] = new Array(maxSegments);
		for (let k = 0; k < maxSegments; k++) {
			segments[r][k] = { start: 0, end: 0, color: 0 };
		}
	}
	const counts = new Int32Array(rows);

	function buildRuns(pixels, rowIndex) {
		let count = 0;
		let base = rowIndex * sampleColumns * 4;

		for (let column = 0; column < sampleColumns; column++, base += 4) {
			const r = pixels[base] & mask;
			const g = pixels[base + 1] & mask;
			const b = pixels[base + 2] & mask;

			if (count > 0 && runR[count - 1] === r && runG[count - 1] === g && runB[count - 1] === b) {
				runEnd[count - 1] = column + 1;
			} else {
				runStart[count] = column;
				runEnd[count] = column + 1;
				runR[count] = r;
				runG[count] = g;
				runB[count] = b;
				count++;
			}
		}
		return count;
	}

	function costAt(index, count) {
		if (index < 0 || index + 1 >= count) return MAX_MERGE_COST;

		const leftLength = runEnd[index] - runStart[index];
		const rightLength = runEnd[index + 1] - runStart[index + 1];
		const distance = colorDistance(
			runR[index], runG[index], runB[index],
			runR[index + 1], runG[index + 1], runB[index + 1]
		);
		return distance * Math.min(leftLength, rightLength);
	}

	function mergeDown(count) {
		if (count <= maxSegments) return count;

		for (let i = 0; i < count - 1; i++) {
			mergeCost[i] = costAt(i, count);
		}

		while (count > maxSegments) {
			let best = 0;
			let bestCost = mergeCost[0];
			for (let i = 1; i < count - 1; i++) {
				if (mergeCost[i] < bestCost) {
					bestCost = mergeCost[i];
					best = i;
				}
			}

			// length-weighted blend, re-quantized to keep the palette bounded
			const leftLength = runEnd[best] - runStart[best];
			const rightLength = runEnd[best + 1] - runStart[best + 1];
			const total = leftLength + rightLength;

			runR[best] = (((runR[best] * leftLength + runR[best + 1] * rightLength) / total) | 0) & mask;
			runG[best] = (((runG[best] * leftLength + runG[best + 1] * rightLength) / total) | 0) & mask;
			runB[best] = (((runB[best] * leftLength + runB[best + 1] * rightLength) / total) | 0) & mask;
			runEnd[best] = runEnd[best + 1];

			for (let i = best + 1; i < count - 1; i++) {
				runStart[i] = runStart[i + 1];
				runEnd[i] = runEnd[i + 1];
				runR[i] = runR[i + 1];
				runG[i] = runG[i + 1];
				runB[i] = runB[i + 1];
			}
			count--;

			// boundaries past the merge point shift left, the merge point and the
			// boundary before it are the only ones whose value actually changed
			for (let i = best + 1; i < count - 1; i++) {
				mergeCost[i] = mergeCost[i + 1];
			}
			if (best - 1 >= 0) mergeCost[best - 1] = costAt(best - 1, count);
			if (best < count - 1) mergeCost[best] = costAt(best, count);
		}

		return count;
	}

	return {
		segments,
		counts,

		/**
		 * @param {Uint8ClampedArray} pixels RGBA bytes from the sampler
		 * @returns {{segments: Array, counts: Int32Array}} reused buffers - copy before keeping
		 */
		encode(pixels) {
			for (let row = 0; row < rows; row++) {
				const count = mergeDown(buildRuns(pixels, row));
				const target = segments[row];

				for (let k = 0; k < count; k++) {
					const segment = target[k];
					segment.start = runStart[k];
					segment.end = runEnd[k];
					segment.color = (runR[k] << 16) | (runG[k] << 8) | runB[k];
				}
				counts[row] = count;
			}
			return { segments, counts };
		}
	};
}
