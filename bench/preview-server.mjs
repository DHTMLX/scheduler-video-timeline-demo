/**
 * Serves the production build for the benchmark.
 *
 * The benchmark measures the built bundle, not the dev server: the dev server
 * hands over unbundled modules and injects its own client, neither of which a
 * deployed page has to pay for.
 */

import { preview } from "vite";

/**
 * @returns {Promise<{url: string, close: () => Promise<void>}>}
 */
export async function startPreviewServer() {
	// port 0 keeps parallel runs from colliding
	const server = await preview({ preview: { port: 0, open: false } });

	const url = server.resolvedUrls?.local?.[0];
	if (!url) throw new Error("vite preview did not report a local URL");

	return {
		url,
		close: () => server.close()
	};
}
