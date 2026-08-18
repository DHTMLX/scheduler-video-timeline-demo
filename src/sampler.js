/**
 * Frame sampler: draws an arbitrary CanvasImageSource into a tiny off-screen
 * canvas and hands back the raw RGBA bytes.
 *
 * The canvas is the resolution of the video as the timeline will show it, so the
 * browser's own image downscaler does the heavy lifting for us.
 */

export function createSampler(columns, rows) {
	const canvas = document.createElement("canvas");
	canvas.width = columns;
	canvas.height = rows;

	const context = canvas.getContext("2d", { willReadFrequently: true });
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "low";

	// Sample cells are not square on screen: a timeline row is rarely as tall as a
	// sample column is wide. Letterboxing has to happen in screen space or the
	// picture comes out stretched.
	let cellAspect = 1;

	return {
		columns,
		rows,
		canvas,

		setCellAspect(value) {
			if (value > 0 && isFinite(value)) cellAspect = value;
		},

		/**
		 * @param {CanvasImageSource} source
		 * @param {number} sourceWidth
		 * @param {number} sourceHeight
		 * @returns {Uint8ClampedArray} RGBA bytes, columns * rows * 4
		 */
		sample(source, sourceWidth, sourceHeight) {
			context.fillStyle = "#000000";
			context.fillRect(0, 0, columns, rows);

			if (sourceWidth > 0 && sourceHeight > 0) {
				// target width/height expressed in cells, corrected for cell shape
				const ratio = (sourceWidth / sourceHeight) * cellAspect;

				let drawHeight = rows;
				let drawWidth = rows * ratio;
				if (drawWidth > columns) {
					drawWidth = columns;
					drawHeight = columns / ratio;
				}

				context.drawImage(
					source,
					(columns - drawWidth) / 2,
					(rows - drawHeight) / 2,
					drawWidth,
					drawHeight
				);
			}

			return context.getImageData(0, 0, columns, rows).data;
		}
	};
}
