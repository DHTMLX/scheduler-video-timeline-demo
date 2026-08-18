import { defineConfig } from "vite";

export default defineConfig({
	// relative asset URLs, so the build works from a GitHub Pages project subpath
	// (https://dhtmlx.github.io/<repo>/) without hardcoding the repository name
	base: "./",

	build: {
		// this is a performance demo, so it ships the same minified code a real
		// application would; the source map is what keeps a CPU profile readable
		sourcemap: true
	},

	server: {
		port: 3000,
		open: true
	}
});
