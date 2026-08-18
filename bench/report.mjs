/**
 * Prints a benchmark run as a markdown table, ready to paste into a report.
 */

export function printReport({ preset, width, height, pool, grid, agent, result }) {
	console.log("preset: " + preset + "  pool: " + pool + "  grid: " + grid);
	console.log("viewport: " + width + "x" + height);
	console.log(agent);
	console.log("");
	console.log("| fps | scheduler ms | frame ms | p95 ms | changed events |");
	console.log("|---|---|---|---|---|");
	console.log(
		"| " + result.fps.toFixed(1) +
		" | " + result.render.toFixed(1) +
		" | " + result.total.toFixed(1) +
		" | " + result.totalP95.toFixed(1) +
		" | " + Math.round(result.changed) + " |"
	);
}
