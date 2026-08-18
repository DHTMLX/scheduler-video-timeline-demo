/**
 * The single place this demo touches the scheduler package.
 *
 * `@dhx/trial-scheduler` is the evaluation build of DHTMLX Scheduler. It ships an
 * ES module that exports the same `scheduler` object the CDN build puts on
 * `window`, so nothing else in the demo has to know where it came from.
 *
 * The stylesheet is imported here rather than in `index.html` so that the bundler
 * owns the ordering: this file is the first import of `main.js`, which puts the
 * scheduler's own CSS ahead of the demo's overrides in the emitted stylesheet.
 */

import "@dhx/trial-scheduler/codebase/dhtmlxscheduler.css";
import { scheduler } from "@dhx/trial-scheduler";

export { scheduler };
