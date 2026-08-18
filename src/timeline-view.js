/**
 * Timeline set-up for the video demo.
 *
 * Everything the scheduler normally does for a human - text, resize handles,
 * aria attributes, drag, selection - is turned off. None of it is free at
 * 960 events a frame, and none of it means anything for a video.
 */

import { VIEW_START } from "./config.js";

const VIEW_NAME = "video";

function computeRowHeight(available, rows) {
	return Math.max(3, Math.floor(available / rows));
}

function applyRowHeight(view, rowHeight) {
	const eventHeight = rowHeight + 2; // render_timeline_event() subtracts 2 for borders

	view.dy = rowHeight;
	view.event_dy = eventHeight;
	view.event_min_dy = eventHeight;
	// exact row coverage: the defaults inset every bar by a pixel, which reads as
	// scan lines once 48 rows are stacked
	view.getEventTop = function () {
		return 0;
	};
	view.getEventHeight = function () {
		return eventHeight;
	};
}

/**
 * Re-shapes the existing view for a different preset: new sections, new scale.
 *
 * The view is only ever created once. createTimelineView() wraps
 * scheduler.render_data, so calling it a second time would stack another wrapper
 * on top of the first.
 */
export function applyPreset(scheduler, preset, sections) {
	const view = scheduler.matrix[VIEW_NAME];

	view.y_unit = sections;
	view.order = {};
	for (let i = 0; i < sections.length; i++) view.order[sections[i].key] = i;

	view.x_step = preset.sampleColumns / preset.gridColumns;
	view.x_size = preset.gridColumns;
	view.x_length = preset.gridColumns;

	// the column widths, the date trace and the ms-per-pixel step are all
	// recalculated from the view config on a full render
	scheduler.updateView();
}

/**
 * Re-fits the rows to whatever vertical space the view actually got, then reports
 * the shape of one sample cell on screen so the sampler can letterbox correctly.
 */
export function fitToContainer(scheduler, preset) {
	const view = scheduler.matrix[VIEW_NAME];
	let rowHeight = view.dy;

	const dataArea = scheduler.$container.querySelector(".dhx_cal_data");
	rowHeight = computeRowHeight(dataArea.clientHeight, preset.rows);

	if (view.dy !== rowHeight) {
		applyRowHeight(view, rowHeight);
		scheduler.updateView();
	}

	let columnsWidth = 0;
	for (let i = 0; i < scheduler._cols.length; i++) columnsWidth += scheduler._cols[i];

	const cellWidth = columnsWidth / preset.sampleColumns;
	return {
		rowHeight,
		cellAspect: cellWidth > 0 ? rowHeight / cellWidth : 1
	};
}

export function createVideoTimeline(scheduler, preset, sections, containerId) {
	const container = document.getElementById(containerId);

	scheduler.plugins({ timeline: true });

	scheduler.config.wai_aria_attributes = false;
	scheduler.config.drag_resize = false;
	scheduler.config.drag_move = false;
	scheduler.config.drag_create = false;
	scheduler.config.dblclick_create = false;
	scheduler.config.details_on_create = false;
	scheduler.config.details_on_dblclick = false;
	scheduler.config.select = false;
	scheduler.config.readonly = true;
	scheduler.config.show_loading = false;
	scheduler.config.update_render = false;

	// no navigation chrome: there is one view and nothing to navigate to
	scheduler.config.header = [];
	scheduler.xy.nav_height = 0;

	scheduler.templates.event_bar_text = function () {
		return "";
	};
	scheduler.templates.event_class = function () {
		return "";
	};


	const rowHeight = computeRowHeight(container.clientHeight - scheduler.xy.scale_height, preset.rows);
	const eventHeight = rowHeight + 2; // render_timeline_event() subtracts 2 for borders

	scheduler.createTimelineView({
		name: VIEW_NAME,
		x_unit: "minute",
		x_date: "%H:%i",
		x_step: preset.sampleColumns / preset.gridColumns,
		x_size: preset.gridColumns,
		x_length: preset.gridColumns,
		x_start: 0,
		y_unit: sections,
		y_property: "section_id",
		render: "bar",
		dx: 44,
		dy: rowHeight,
		event_dy: eventHeight,
		event_min_dy: eventHeight,
		section_autoheight: false,
		resize_events: false,
		fit_events: false,
		round_position: false,
		getEventTop: function () {
			return 0;
		},
		getEventHeight: function () {
			return eventHeight;
		}
	});

	scheduler.templates[VIEW_NAME + "_scale_label"] = function (key, label) {
		return label;
	};
	scheduler.templates[VIEW_NAME + "_scale_date"] = function (date) {
		return "";
	};
	scheduler.templates[VIEW_NAME + "_cell_class"] = function () {
		return "";
	};

	scheduler.init(containerId, VIEW_START, VIEW_NAME);

	return { name: VIEW_NAME };
}
