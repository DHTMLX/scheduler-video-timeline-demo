/**
 * Frame sources.
 *
 * Every source exposes the same shape so the pipeline does not care where the
 * pixels come from:
 *
 *   { kind, drawable, width, height, ready, start(), stop(), requestFrame(cb) }
 *
 * requestFrame() uses requestVideoFrameCallback() when the browser has it, so we
 * sample decoded frames rather than display frames, and falls back to rAF.
 */

const GENERATED_WIDTH = 320;
const GENERATED_HEIGHT = 180;

function createVideoElement() {
	const video = document.createElement("video");
	video.muted = true;
	video.loop = true;
	video.playsInline = true;
	video.crossOrigin = "anonymous";
	video.preload = "auto";
	// kept out of the layout: the scheduler is the only player here
	video.style.position = "absolute";
	video.style.width = "1px";
	video.style.height = "1px";
	video.style.opacity = "0";
	video.style.pointerEvents = "none";
	return video;
}

export function createVideoSource() {
	const video = createVideoElement();
	document.body.appendChild(video);

	let frameHandle = null;
	let usingVideoCallback = false;

	const source = {
		kind: "video",
		element: video,

		get drawable() {
			return video;
		},
		get width() {
			return video.videoWidth;
		},
		get height() {
			return video.videoHeight;
		},
		get ready() {
			return video.readyState >= 2 && video.videoWidth > 0;
		},
		get label() {
			return video.videoWidth ? video.videoWidth + "x" + video.videoHeight : "loading";
		},

		setSource(url) {
			video.src = url;
			return video.play().catch(function (error) {
				// autoplay policies: the caller retries from a user gesture
				return Promise.reject(error);
			});
		},

		setStream(stream) {
			video.srcObject = stream;
			return video.play();
		},

		start() {
			return video.play();
		},

		stop() {
			video.pause();
		},

		requestFrame(callback) {
			if (video.requestVideoFrameCallback) {
				usingVideoCallback = true;
				frameHandle = video.requestVideoFrameCallback(function () {
					callback();
				});
			} else {
				usingVideoCallback = false;
				frameHandle = requestAnimationFrame(function () {
					callback();
				});
			}
		},

		cancelFrame() {
			if (frameHandle === null) return;
			if (usingVideoCallback && video.cancelVideoFrameCallback) {
				video.cancelVideoFrameCallback(frameHandle);
			} else if (!usingVideoCallback) {
				cancelAnimationFrame(frameHandle);
			}
			frameHandle = null;
		},

		destroy() {
			source.cancelFrame();
			video.pause();
			video.removeAttribute("src");
			video.srcObject = null;
			video.remove();
		}
	};

	return source;
}

/**
 * Built-in clip, so the page is useful without supplying a video file.
 * Plasma field plus a marquee - enough color movement to keep most of the
 * pool changing every frame, which is the interesting case.
 */
export function createGeneratedSource() {
	const canvas = document.createElement("canvas");
	canvas.width = GENERATED_WIDTH;
	canvas.height = GENERATED_HEIGHT;
	const context = canvas.getContext("2d");

	const image = context.createImageData(GENERATED_WIDTH, GENERATED_HEIGHT);
	const pixels = image.data;

	let frameHandle = null;
	let running = false;
	let phase = 0;

	// precomputed sine table: the generator must not compete with the scheduler for time
	const SINE_STEPS = 1024;
	const sine = new Float32Array(SINE_STEPS);
	for (let i = 0; i < SINE_STEPS; i++) {
		sine[i] = Math.sin((i / SINE_STEPS) * Math.PI * 2);
	}
	function fastSine(value) {
		const index = ((value * (SINE_STEPS / (Math.PI * 2))) | 0) & (SINE_STEPS - 1);
		return sine[index];
	}

	function drawPlasma() {
		let offset = 0;
		for (let y = 0; y < GENERATED_HEIGHT; y++) {
			const yTerm = fastSine(y * 0.06 + phase * 1.3);
			for (let x = 0; x < GENERATED_WIDTH; x++) {
				const value =
					fastSine(x * 0.045 + phase) +
					yTerm +
					fastSine((x + y) * 0.03 - phase * 0.7) +
					fastSine(Math.sqrt(x * x + y * y) * 0.05 + phase * 1.9);

				pixels[offset++] = 128 + 127 * fastSine(value * 1.1);
				pixels[offset++] = 128 + 127 * fastSine(value * 1.1 + 2.09);
				pixels[offset++] = 128 + 127 * fastSine(value * 1.1 + 4.18);
				pixels[offset++] = 255;
			}
		}
		context.putImageData(image, 0, 0);
	}

	function drawMarquee() {
		const text = "NEVER GONNA GIVE YOU UP  •  ";
		context.font = "bold 34px Inter, Arial, sans-serif";
		context.textBaseline = "middle";

		const width = context.measureText(text).width;
		const shift = (phase * 60) % width;

		context.fillStyle = "rgba(0, 0, 0, 0.45)";
		context.fillRect(0, GENERATED_HEIGHT / 2 - 24, GENERATED_WIDTH, 48);

		context.fillStyle = "#ffffff";
		for (let x = -shift; x < GENERATED_WIDTH; x += width) {
			context.fillText(text, x, GENERATED_HEIGHT / 2);
		}
	}

	function render() {
		phase += 0.05;
		drawPlasma();
		drawMarquee();
	}

	const source = {
		kind: "generated",
		element: canvas,

		get drawable() {
			return canvas;
		},
		get width() {
			return GENERATED_WIDTH;
		},
		get height() {
			return GENERATED_HEIGHT;
		},
		get ready() {
			return true;
		},
		get label() {
			return "built-in clip " + GENERATED_WIDTH + "x" + GENERATED_HEIGHT;
		},

		start() {
			running = true;
			return Promise.resolve();
		},

		stop() {
			running = false;
		},

		requestFrame(callback) {
			frameHandle = requestAnimationFrame(function () {
				if (running) render();
				callback();
			});
		},

		cancelFrame() {
			if (frameHandle !== null) {
				cancelAnimationFrame(frameHandle);
				frameHandle = null;
			}
		},

		destroy() {
			source.cancelFrame();
		}
	};

	render();
	return source;
}
