/**
 * Drives one benchmark run in headless Chromium.
 *
 * The page exposes `window.videoBenchmark`, which owns the warm-up and the
 * measurement window - the timings therefore come from the same code path as the
 * "run benchmark" button, and the two are directly comparable.
 */

import { chromium } from "playwright";

const SETTLE_MS = 2000;

/**
 * @param {object} options
 * @param {string} options.url    page URL, without the options hash
 * @param {string} options.preset preset key, see src/config.js
 * @param {number} options.width  viewport width
 * @param {number} options.height viewport height
 * @returns {Promise<{result: object, pool: string, grid: string, agent: string}>}
 */
export async function runPage({ url, preset, width, height }) {
	const browser = await chromium.launch();

	try {
		const page = await browser.newPage({ viewport: { width, height } });
		page.on("pageerror", error => console.error("page error:", error.message));

		await page.goto(url + "#preset=" + preset, { waitUntil: "networkidle" });
		await page.waitForTimeout(SETTLE_MS);

		// the run itself is longer than any sensible default timeout
		const result = await page.evaluate(() => window.videoBenchmark.run(), undefined, { timeout: 0 });
		const info = await page.evaluate(() => ({
			pool: document.querySelector("[data-hud=pool]").textContent,
			grid: document.querySelector("[data-hud=grid]").textContent,
			agent: navigator.userAgent
		}));

		return { result, ...info };
	} finally {
		await browser.close();
	}
}
