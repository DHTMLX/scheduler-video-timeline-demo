# Video in a Scheduler Timeline

[![dhtmlx.com](https://img.shields.io/badge/made%20by-DHTMLX-blue)](https://dhtmlx.com/)

Play video inside the Timeline view of [DHTMLX Scheduler](https://dhtmlx.com/docs/products/dhtmlxScheduler/). Every colored rectangle is a real scheduler event with its own `start_date` and `end_date`.

**[Open the live demo](https://dhtmlx.github.io/scheduler-video-timeline-demo/)**

Choose the built-in animation, drop in a video file, or use your webcam. Video stays in
your browser and is never uploaded.

## Run locally

```bash
git clone https://github.com/DHTMLX/scheduler-video-timeline-demo.git
cd scheduler-video-timeline-demo
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The demo uses `@dhx/trial-scheduler`, the evaluation build of DHTMLX Scheduler. The
repository's `.npmrc` configures the DHTMLX registry, and the trial package requires no
access token.

## What you can try

- Play the built-in generated animation with no setup.
- Drop a local video file anywhere on the page.
- Use your webcam as the video source.
- Switch between workloads from 288 to 3840 events.
- Run a timed benchmark and inspect sampling, encoding, repaint, and FPS measurements.

## How it works

Each frame goes through a five-stage pipeline:

```
source -> sampler -> encoder -> event pool (diff) -> scheduler.updateEvent()
```

1. **Source** — a detached muted `<video>` (uploaded file or webcam), or a generated clip
   that ships with the demo.
2. **Sampler** — draws the frame into a 96 × 48 off-screen canvas and reads back the RGBA
   bytes. Letterboxing happens in *screen* space, because a timeline row is not as tall as
   a sample column is wide.
3. **Encoder** — quantizes each color channel to 4 bits, run-length encodes each row, then
   merges it down to at most 20 segments.
4. **Pool** — a fixed set of 960 events, created once, never added to or removed. Each
   frame is diffed against the previous one, so only changed segments are written.
5. **Repaint** — `scheduler.updateEvent(id)` per changed event. The public API, the same
   call any application makes; nothing is painted around the component.

Each segment uses real event dates. Column *c* of the picture maps to
`viewStart + c minutes`. A run covering columns `[c0, c1)` becomes an event from
`viewStart + c0` to `viewStart + c1`, and the Timeline places it with the same
date-to-pixel calculation it uses for an appointment.

Sample resolution is deliberately decoupled from column count. Events are positioned by
date with sub-column precision, so the *grid* can be 12 columns while the *video* is 96
samples wide. This avoids rendering roughly 4000 extra grid cells.

## Geometry

```
rows            48   ->  48 timeline sections
sampleColumns   96   ->  horizontal sample resolution
maxSegments     20   ->  events per row
pool            960  ->  48 x 20 fixed events
grid columns    12   ->  x_unit "minute", x_step 8, x_size 12, spanning 96 minutes
```

Four presets ship, selectable from the toolbar or the URL hash:

| preset | rows × samples | events |
|---|---|---|
| `small` | 24 × 48 | 288 |
| `medium` (default) | 48 × 96 | 960 |
| `large` | 72 × 144 | 2016 |
| `huge` | 96 × 192 | 3840 |

Switching presets rebuilds the pool, sections, and scale without reloading the page, so an
uploaded video keeps playing.

Add a preset to the URL hash to open it directly, for example `#preset=large`.

## Benchmark

```bash
npm run bench                  # builds, serves dist/, measures, prints a markdown row
PRESET=large npm run bench
```

The runner uses the generated clip to provide the same workload without shipping a video
file. It runs a 3 s warm-up followed by a 10 s measurement window. The **Run benchmark**
button in the demo uses the same measurement path.

Environment overrides: `PRESET`, `WIDTH`, `HEIGHT`, and `BASE_URL` to measure a server
that is already running instead of starting one.

Reference results from a MacBook Air M1, using the built-in generated clip:

| Scheduler | preset | changed/frame | Scheduler ms | frame ms | p95 ms | FPS |
|---|---|---:|---:|---:|---:|---:|
| 7.2.14 | 960 events | 890 | 96.3 | 99.4 | 102.4 | 8.8 |
| 7.2.15 | 960 events | 880 | 10.9 | 12.7 | 14.8 | 37.4 |
| 7.2.15 | 2016 events | 1835 | 29.5 | 32.0 | 48.1 | 16.3 |

For the 960-event workload, Scheduler repainting is 8.8× faster in 7.2.15 than in 7.2.14.
Total JavaScript frame time is 7.8× lower. The two runs updated nearly the same number of
events per frame.

`Scheduler ms` measures event repainting. `Frame ms` covers the complete JavaScript
pipeline, and `p95 ms` is its 95th-percentile frame time. FPS also includes browser
rendering and compositor work. For repeatable comparisons, use the millisecond figures
from runs made with the same browser and viewport.

> **Note on scheduler version.** Repainting many events per frame was quadratic in the
> number of rendered events up to and including `@dhx/trial-scheduler@7.2.14`: refreshing
> one event scanned the whole array of rendered nodes. DHTMLX Scheduler 7.2.15 indexes
> rendered nodes by event ID instead. The dependency starts at `^7.2.15`, so this demo uses
> the fixed path.

## Performance design

The demo keeps each frame within a bounded workload:

- **Reduce the data first.** Quantisation, run-length encoding and segment merging cut a
  96 × 48 frame to at most 960 rectangles before the component sees anything.
- **Diff every frame.** Only events whose segment actually changed are repainted — an
  average of 880 of 960 in the latest reference run of the built-in clip.
- **Disable unused interaction.** `drag_move`, `drag_resize`, `drag_create`, selection,
  the lightbox, and the loading indicator are off in this display-only view.
- **Keep the templates trivial.** `event_bar_text` and `event_class` return empty strings;
  the scale templates return the label or nothing.
- **Shape the view for the job.** One view, no navigation header, 12 grid columns,
  `fit_events: false`, `round_position: false`, `section_autoheight: false`, and fixed
  `getEventTop` / `getEventHeight` so bars cover their row exactly.
- **Take the CSS out of the hot path.** No radii, no shadows, no transitions, no padding
  on the event bars — every one of those is style work multiplied by the pool size.

The demo also disables generated WAI-ARIA attributes because its event bars represent
video pixels rather than interactive schedule data. Keep accessibility features enabled
in user-facing scheduling applications.

## Project structure

```
index.html               markup, controls, HUD
vite.config.js           dev server and build config
src/main.js              wiring, frame loop
src/scheduler.js         the only import of @dhx/trial-scheduler
src/config.js            geometry presets
src/timeline-view.js     timeline set-up and row fitting
src/video-source.js      uploaded file / webcam / built-in clip
src/sampler.js           off-screen canvas -> Uint8ClampedArray
src/quantize.js          quantisation, run-length encoding, segment merge
src/pool.js              event pool creation and differential apply
src/hud.js               timings overlay
src/style.css            page chrome and the event-bar overrides
bench/index.mjs          headless benchmark entry point
```

## The built-in clip

The demo generates its own animation: a plasma field with a scrolling marquee, drawn to a
320 × 180 canvas from a precomputed sine table so the generator never competes with the
scheduler for frame time.

It is a repeatable benchmark source because it is deterministic, has no codec dependency,
and keeps most of the event pool changing. Real video can be much easier: one tested screen
recording changed only four events in some frames.

## Available scripts

| command | purpose |
|---|---|
| `npm start` | Start the Vite development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run bench` | Build and run the headless benchmark |

## License

The demo source is available under the [MIT License](LICENSE).

`@dhx/trial-scheduler` is a commercial trial package. Use it under a valid evaluation or
commercial agreement. The Timeline view is a Professional-edition feature and is not
included in the free `dhtmlx-scheduler` package.

## DHTMLX Scheduler resources

- [Product page](https://dhtmlx.com/docs/products/dhtmlxScheduler/)
- [Documentation](https://docs.dhtmlx.com/scheduler/)
- [Timeline view guide](https://docs.dhtmlx.com/scheduler/views/timeline)
- [Start a trial](https://dhtmlx.com/docs/products/dhtmlxScheduler/download.shtml)
- [Support forum](https://forum.dhtmlx.com/c/scheduler)
