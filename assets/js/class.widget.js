const ITEM_HEATMAP_WEEK_SECONDS = 7 * 24 * 60 * 60;
const ITEM_HEATMAP_DAY_SECONDS = 24 * 60 * 60;
const ITEM_HEATMAP_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ITEM_HEATMAP_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ITEM_HEATMAP_SURFACE_LABEL = 'DAY x TIME HEATMAP';
const ITEM_HEATMAP_DISPLAY_MODE_CONSOLIDATED = 0;
const ITEM_HEATMAP_DISPLAY_MODE_COMPARE = 1;
const ITEM_HEATMAP_COMPARISON_MIN_PANEL_HEIGHT = 134;

function itemHeatmapClamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function itemHeatmapFont(size, weight = 400, style = 'normal') {
	return `${style} ${weight} ${size}px "Segoe UI", Arial, sans-serif`;
}

function itemHeatmapDrawRoundedRect(ctx, x, y, w, h, r, fillStyle = null, strokeStyle = null, lineWidth = 1) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();

	if (fillStyle !== null) {
		ctx.fillStyle = fillStyle;
		ctx.fill();
	}

	if (strokeStyle !== null) {
		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = strokeStyle;
		ctx.stroke();
	}
}

class CWidgetItemHeatmap extends CWidget {
	ensureState() {
		if (this._heatmapStateInitialized) {
			return;
		}

		this._heatmapStateInitialized = true;
		this._canvas = null;
		this._container = null;
		this._canvasWrap = null;
		this._tooltip = null;
		this._menu = null;
		this._week = null;
		this._weeks = new Map();
		this._visibleWeekStartTs = null;
		this._requestedWeekStartTs = null;
		this._currentWeekStartTs = null;
		this._oldestWeekStartTs = null;
		this._primaryItemId = 0;
		this._primaryItemUrl = '';
		this._selectedItemCount = 0;
		this._slotSeconds = 3600;
		this._periodWeeks = 12;
		this._displayMode = ITEM_HEATMAP_DISPLAY_MODE_CONSOLIDATED;
		this._hourFormat = 12;
		this._displayTitle = '';
		this._showDisplayTitle = true;
		this._legendText = '';
		this._showLegend = false;
		this._isLoading = false;
		this._hoveredCellKey = null;
		this._hoveredNavKey = null;
		this._pressedCellKey = null;
		this._openMenuCellKey = null;
		this._cellBoxes = [];
		this._navBoxes = {};
		this._boundCanvas = null;
		this._globalEventsBound = false;
		this._handleMouseMove = (event) => this.handleMouseMove(event);
		this._handleMouseLeave = () => this.handleMouseLeave();
		this._handleClick = (event) => this.handleClick(event);
		this._handleDocumentPointerDown = (event) => this.handleDocumentPointerDown(event);
		this._handleCanvasWrapScroll = () => this.handleCanvasWrapScroll();
	}

	getUpdateRequestData() {
		this.ensureState();

		const data = super.getUpdateRequestData();
		const weekStartTs = this._requestedWeekStartTs ?? this._visibleWeekStartTs;

		if (weekStartTs !== null) {
			data.week_start_ts = weekStartTs;
		}

		return data;
	}

	promiseUpdate() {
		this.ensureState();
		this.setLoadingState(true);

		return super.promiseUpdate().finally(() => {
			this.setLoadingState(false);
		});
	}

	processUpdateResponse(response) {
		this.ensureState();
		super.processUpdateResponse(response);
		this.captureElements();

		if (!this._container || !this._canvas) {
			return;
		}

		const week = this.parseWeek(this._container.dataset.week || '{}');

		if (!week) {
			this._week = null;
			this.hideTooltip();
			this.hideContextMenu();
			return;
		}

		this._week = week;
		this._weeks.set(String(week.start_ts), week);
		this._visibleWeekStartTs = Number(week.start_ts);
		this._requestedWeekStartTs = Number(week.start_ts);
		this._currentWeekStartTs = Number(this._container.dataset.currentWeekStart || week.start_ts);
		this._oldestWeekStartTs = Number(this._container.dataset.oldestWeekStart || week.start_ts);
		this._primaryItemId = Number(this._container.dataset.primaryItemid || 0);
		this._primaryItemUrl = this._container.dataset.primaryItemUrl || '';
		this._selectedItemCount = Number(this._container.dataset.selectedItemCount || 0);
		this._slotSeconds = this.normalizeSlotSeconds(this._container.dataset.slotSeconds || week.slot_seconds);
		this._periodWeeks = Number(this._container.dataset.periodWeeks || 12);
		this._displayMode = this.normalizeDisplayMode(this._container.dataset.displayMode);
		this._hourFormat = this.normalizeHourFormat(this._container.dataset.hourFormat);
		this._displayTitle = this._container.dataset.displayTitle || this._container.dataset.name || 'Item Heatmap';
		this._showDisplayTitle = Number(this._container.dataset.showDisplayTitle || 0) === 1;
		this._legendText = this._container.dataset.legendText || '';
		this._showLegend = Number(this._container.dataset.showLegend || 0) === 1;
		this._hoveredCellKey = null;
		this._hoveredNavKey = null;
		this._pressedCellKey = null;
		this._openMenuCellKey = null;
		this.hideTooltip();
		this.hideContextMenu();

		this.bindCanvasEvents();
		this.bindGlobalEvents();
		this.drawCurrentWeek();
	}

	processUpdateErrorResponse(response) {
		this.ensureState();
		this.setLoadingState(false);
		super.processUpdateErrorResponse(response);
	}

	onResize() {
		this.ensureState();
		super.onResize();

		if (this._canvas && this.getVisibleWeek()) {
			this.hideTooltip();
			this.hideContextMenu();
			this.drawCurrentWeek();
		}
	}

	captureElements() {
		this._container = this._target.querySelector('.item-heatmap-widget');
		this._canvasWrap = this._container?.querySelector('.item-heatmap-widget__canvas-wrap') ?? null;
		this._canvas = this._container?.querySelector('.item-heatmap-widget__canvas') ?? null;
		this._tooltip = this._container?.querySelector('.item-heatmap-widget__tooltip') ?? null;
		this._menu = this._container?.querySelector('.item-heatmap-widget__menu') ?? null;
		this.setLoadingState(this._isLoading);
	}

	bindCanvasEvents() {
		if (!this._canvas) {
			return;
		}

		if (this._boundCanvas && this._boundCanvas !== this._canvas) {
			this._boundCanvas.removeEventListener('mousemove', this._handleMouseMove);
			this._boundCanvas.removeEventListener('mouseleave', this._handleMouseLeave);
			this._boundCanvas.removeEventListener('click', this._handleClick);
		}

		if (this._boundCanvas !== this._canvas) {
			this._canvas.addEventListener('mousemove', this._handleMouseMove);
			this._canvas.addEventListener('mouseleave', this._handleMouseLeave);
			this._canvas.addEventListener('click', this._handleClick);
			this._boundCanvas = this._canvas;
		}

		if (this._canvasWrap) {
			this._canvasWrap.removeEventListener('scroll', this._handleCanvasWrapScroll);
			this._canvasWrap.addEventListener('scroll', this._handleCanvasWrapScroll);
		}
	}

	bindGlobalEvents() {
		if (this._globalEventsBound) {
			return;
		}

		document.addEventListener('pointerdown', this._handleDocumentPointerDown);
		this._globalEventsBound = true;
	}

	parseWeek(rawWeek) {
		try {
			const week = JSON.parse(rawWeek);

			return typeof week === 'object' && week !== null ? week : null;
		}
		catch (error) {
			console.error('ItemHeatmap: invalid week JSON', error);
			return null;
		}
	}

	getVisibleWeek() {
		if (this._visibleWeekStartTs !== null && this._weeks.has(String(this._visibleWeekStartTs))) {
			return this._weeks.get(String(this._visibleWeekStartTs));
		}

		return this._week;
	}

	getWeekItems(week = this.getVisibleWeek()) {
		return Array.isArray(week?.items) ? week.items : [];
	}

	getPrimaryItemMetadata(week = this.getVisibleWeek()) {
		const items = this.getWeekItems(week);

		if (this._primaryItemId > 0) {
			const match = items.find((item) => Number(item.itemid) === this._primaryItemId);

			if (match) {
				return match;
			}
		}

		return items[0] ?? null;
	}

	getItemMetadataById(itemid, week = this.getVisibleWeek()) {
		return this.getWeekItems(week).find((item) => Number(item.itemid) === Number(itemid)) || null;
	}

	drawCurrentWeek() {
		const week = this.getVisibleWeek();

		if (!week || !this._canvas) {
			return;
		}

		this.drawHeatmap(this._canvas, week);
	}

	drawHeatmap(canvas, week) {
		const ctx = canvas.getContext('2d');
		const parent = canvas.parentElement;

		if (!ctx || !parent) {
			return;
		}

		const width = Math.max(parent.clientWidth, 280);
		const baseHeight = Math.max(parent.clientHeight, 190);
		const dpr = window.devicePixelRatio || 1;
		const palette = this.getThemePalette();
		const items = this.getWeekItems(week);
		const comparisonMode = this.shouldUseComparisonMode(week);
		const slotCount = Number(week.slot_count || Math.max(1, ITEM_HEATMAP_DAY_SECONDS / this._slotSeconds));
		const compact = width < 640 || baseHeight < 250;
		const metrics = this.measureSurface(width, compact, week);
		const gridWidth = Math.max(width - metrics.gridX - metrics.outerPaddingX, 120);
		const columnLayout = this.getColumnLayout(gridWidth, slotCount);
		const legendHeight = baseHeight >= 210 ? 18 : 14;
		let totalHeight = baseHeight;
		let legendY = 0;
		let consolidatedLayout = null;
		let comparisonLayout = null;

		if (comparisonMode) {
			comparisonLayout = this.getComparisonPanelLayout(baseHeight, metrics, columnLayout, items.length, compact, legendHeight);
			totalHeight = comparisonLayout.totalHeight;
			legendY = comparisonLayout.legendY;
		}
		else {
			consolidatedLayout = this.getConsolidatedGridLayout(baseHeight, metrics, columnLayout, compact, legendHeight);
			totalHeight = consolidatedLayout.totalHeight;
			legendY = consolidatedLayout.legendY;
		}

		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(totalHeight * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${totalHeight}px`;

		if (this._canvasWrap) {
			this._canvasWrap.style.overflowY = totalHeight > baseHeight ? 'auto' : 'hidden';
		}

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, totalHeight);
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'center';

		this._navBoxes = {
			prev: { x: metrics.prevX, y: metrics.outerPaddingTop, w: metrics.navButtonW, h: metrics.navButtonH, enabled: metrics.hasPrev },
			next: { x: metrics.nextX, y: metrics.outerPaddingTop, w: metrics.navButtonW, h: metrics.navButtonH, enabled: metrics.hasNext }
		};
		this._cellBoxes = [];

		this.drawHeader(ctx, metrics, week, palette);
		this.drawSlotLabels(ctx, metrics, columnLayout, slotCount, palette, compact);

		if (comparisonMode) {
			this.drawComparisonMode(ctx, metrics, columnLayout, legendY, week, palette, compact, comparisonLayout);
		}
		else {
			this.drawConsolidatedMode(ctx, metrics, columnLayout, legendY, week, palette, compact, consolidatedLayout);
		}

		this.drawLegend(ctx, metrics, columnLayout, legendY, palette);
	}

	measureSurface(width, compact, week) {
		const outerPaddingX = compact ? 6 : 10;
		const outerPaddingTop = compact ? 6 : 8;
		const outerPaddingBottom = compact ? 8 : 10;
		const gridLabelWidth = compact ? 34 : 44;
		const displayTitle = this.getDisplayTitle();
		const showDisplayTitle = this._showDisplayTitle && displayTitle !== '';
		const weekLabel = week.label || 'Week';
		const navButtonW = compact ? 26 : 30;
		const navButtonH = compact ? 22 : 26;
		const navGap = compact ? 8 : 10;
		const tempCanvas = document.createElement('canvas');
		const tempCtx = tempCanvas.getContext('2d');
		let weekLabelWidth = 80;

		if (tempCtx) {
			tempCtx.font = itemHeatmapFont(compact ? 11 : 12, 700);
			weekLabelWidth = Math.ceil(tempCtx.measureText(weekLabel).width);
		}

		const navRowWidth = (navButtonW * 2) + (navGap * 2) + weekLabelWidth;
		const navStartX = Math.max(width - outerPaddingX - navRowWidth, outerPaddingX);
		const prevX = navStartX;
		const labelCenterX = prevX + navButtonW + navGap + (weekLabelWidth / 2);
		const nextX = labelCenterX + (weekLabelWidth / 2) + navGap;
		const titleMaxWidth = Math.max(navStartX - outerPaddingX - 12, 100);
		let contentTop = outerPaddingTop + navButtonH + (compact ? 4 : 6);

		if (this._showLegend && this._legendText.trim() !== '') {
			contentTop += compact ? 14 : 16;
		}

		return {
			compact,
			outerPaddingX,
			outerPaddingTop,
			outerPaddingBottom,
			gridLabelWidth,
			gridX: outerPaddingX + gridLabelWidth + 4,
			slotLabelY: contentTop + (compact ? 7 : 9),
			contentTop,
			prevX,
			nextX,
			labelCenterX,
			navButtonW,
			navButtonH,
			showDisplayTitle,
			displayTitle,
			titleMaxWidth,
			hasPrev: Number(week.start_ts || 0) > this._oldestWeekStartTs,
			hasNext: Number(week.start_ts || 0) < this._currentWeekStartTs
		};
	}

	getColumnLayout(gridWidth, slotCount) {
		let gapX = gridWidth > 760 ? 4 : (gridWidth > 520 ? 3 : 2);
		let cellWidth = (gridWidth - (gapX * (slotCount - 1))) / slotCount;

		if (cellWidth < 11) {
			gapX = 1;
			cellWidth = (gridWidth - (gapX * (slotCount - 1))) / slotCount;
		}

		if (cellWidth < 8) {
			gapX = 0.5;
			cellWidth = (gridWidth - (gapX * (slotCount - 1))) / slotCount;
		}

		return {
			gapX,
			cellWidth,
			hourFontSize: cellWidth < 14 ? 8 : (cellWidth < 22 ? 9 : 10),
			labelStep: cellWidth < 10 ? 8 : (cellWidth < 13 ? 6 : (cellWidth < 17 ? 4 : (cellWidth < 22 ? 2 : 1)))
		};
	}

	getConsolidatedGridLayout(baseHeight, metrics, columnLayout, compact, legendHeight) {
		const rowGap = columnLayout.gapX;
		const cellSize = columnLayout.cellWidth;
		const gridTop = metrics.slotLabelY + (compact ? 10 : 12);
		const gridHeight = (cellSize * 7) + (rowGap * 6);
		const totalHeight = Math.max(
			baseHeight,
			gridTop + gridHeight + (compact ? 12 : 14) + legendHeight + metrics.outerPaddingBottom
		);
		const legendY = totalHeight - metrics.outerPaddingBottom - (legendHeight / 2);

		return {
			rowGap,
			cellSize,
			gridTop,
			totalHeight,
			legendY
		};
	}

	getComparisonPanelLayout(baseHeight, metrics, columnLayout, itemCount, compact, legendHeight) {
		const panelGap = compact ? 12 : 14;
		const panelHeaderHeight = compact ? 20 : 22;
		const rowGap = columnLayout.gapX;
		const cellSize = columnLayout.cellWidth;
		const panelGridHeight = (cellSize * 7) + (rowGap * 6);
		const panelHeight = Math.max(
			ITEM_HEATMAP_COMPARISON_MIN_PANEL_HEIGHT,
			panelHeaderHeight + panelGridHeight
		);
		const firstPanelTop = metrics.slotLabelY + (compact ? 14 : 16);
		const totalPanelsHeight = (itemCount * panelHeight) + (Math.max(itemCount - 1, 0) * panelGap);
		const totalHeight = Math.max(
			baseHeight,
			firstPanelTop + totalPanelsHeight + legendHeight + metrics.outerPaddingBottom + (compact ? 16 : 18)
		);
		const legendY = totalHeight - metrics.outerPaddingBottom - (legendHeight / 2);

		return {
			panelGap,
			panelHeaderHeight,
			panelGridHeight,
			panelHeight,
			rowGap,
			cellSize,
			firstPanelTop,
			totalHeight,
			legendY
		};
	}

	drawHeader(ctx, metrics, week, palette) {
		const compact = metrics.compact;
		const titleFontSize = compact ? 13 : 15;
		const legendFontSize = compact ? 9 : 10;
		const titleBaselineY = metrics.outerPaddingTop + (metrics.navButtonH / 2);
		const weekLabel = week.label || 'Week';

		if (metrics.showDisplayTitle) {
			ctx.textAlign = 'left';
			ctx.fillStyle = palette.textStrong;
			ctx.font = itemHeatmapFont(titleFontSize, 700);
			ctx.fillText(this.truncateText(ctx, metrics.displayTitle, metrics.titleMaxWidth), metrics.outerPaddingX, titleBaselineY);
		}

		itemHeatmapDrawRoundedRect(
			ctx,
			metrics.prevX,
			metrics.outerPaddingTop,
			metrics.navButtonW,
			metrics.navButtonH,
			6,
			metrics.hasPrev ? (this._hoveredNavKey === 'prev' ? palette.navBgHover : palette.navBg) : palette.navBgDisabled,
			metrics.hasPrev ? palette.navBorder : palette.navBorderDisabled,
			1
		);
		itemHeatmapDrawRoundedRect(
			ctx,
			metrics.nextX,
			metrics.outerPaddingTop,
			metrics.navButtonW,
			metrics.navButtonH,
			6,
			metrics.hasNext ? (this._hoveredNavKey === 'next' ? palette.navBgHover : palette.navBg) : palette.navBgDisabled,
			metrics.hasNext ? palette.navBorder : palette.navBorderDisabled,
			1
		);

		ctx.textAlign = 'center';
		ctx.font = itemHeatmapFont(compact ? 12 : 13, 700);
		ctx.fillStyle = metrics.hasPrev ? palette.textStrong : palette.navDisabledText;
		ctx.fillText('\u2190', metrics.prevX + (metrics.navButtonW / 2), metrics.outerPaddingTop + (metrics.navButtonH / 2));
		ctx.fillStyle = metrics.hasNext ? palette.textStrong : palette.navDisabledText;
		ctx.fillText('\u2192', metrics.nextX + (metrics.navButtonW / 2), metrics.outerPaddingTop + (metrics.navButtonH / 2));
		ctx.fillStyle = palette.textStrong;
		ctx.font = itemHeatmapFont(compact ? 11 : 12, 700);
		ctx.fillText(weekLabel, metrics.labelCenterX, metrics.outerPaddingTop + (metrics.navButtonH / 2));

		if (this._showLegend && this._legendText.trim() !== '') {
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';
			ctx.fillStyle = palette.textSubdued;
			ctx.font = itemHeatmapFont(legendFontSize, 500);
			ctx.fillText(
				this.truncateText(ctx, this._legendText, (ctx.canvas.width / (window.devicePixelRatio || 1)) - (metrics.outerPaddingX * 2)),
				metrics.outerPaddingX,
				metrics.outerPaddingTop + metrics.navButtonH + (compact ? 5 : 7)
			);
			ctx.textBaseline = 'middle';
		}
	}

	drawSlotLabels(ctx, metrics, columnLayout, slotCount, palette, compact) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = itemHeatmapFont(columnLayout.hourFontSize, 500);
		ctx.fillStyle = palette.textMuted;

		for (let slot = 0; slot < slotCount; slot++) {
			if (slot % columnLayout.labelStep !== 0) {
				continue;
			}

			const x = metrics.gridX + (slot * (columnLayout.cellWidth + columnLayout.gapX)) + (columnLayout.cellWidth / 2);
			ctx.fillText(this.formatSlotHeaderLabel(slot), x, metrics.slotLabelY);
		}

		ctx.textAlign = 'left';
		ctx.fillStyle = palette.textSubdued;
		ctx.font = itemHeatmapFont(compact ? 11 : 12, 700);
		ctx.fillText(ITEM_HEATMAP_SURFACE_LABEL, metrics.outerPaddingX, metrics.outerPaddingTop + metrics.navButtonH + (compact ? 2 : 4));
	}

	drawConsolidatedMode(ctx, metrics, columnLayout, legendY, week, palette, compact, gridLayout = null) {
		const matrix = Array.isArray(week.matrix) ? week.matrix : [];
		const maxValue = Number(week.max_value || 0);
		const layout = gridLayout ?? this.getConsolidatedGridLayout(ctx.canvas.height / (window.devicePixelRatio || 1), metrics, columnLayout, compact, 18);
		const gridTop = layout.gridTop;
		const gapY = layout.rowGap;
		const cellSize = layout.cellSize;
		const rows = 7;
		const dayFontSize = cellSize < 18 ? 9 : 11;
		const valueFontSize = itemHeatmapClamp(Math.floor(cellSize * 0.42), 9, 14);
		const radius = itemHeatmapClamp(cellSize * 0.22, 3, 7);

		this.drawDayLabels(ctx, metrics.gridX, gridTop, cellSize, gapY, dayFontSize, palette);

		for (let day = 0; day < rows; day++) {
			for (let slot = 0; slot < week.slot_count; slot++) {
				const detail = this.getBucketDetail(week, day, slot);
				const value = Number(matrix?.[day]?.[slot] ?? detail.value ?? 0);
				const x = metrics.gridX + (slot * (cellSize + columnLayout.gapX));
				const y = gridTop + (day * (cellSize + gapY));
				const cellKey = this.getCellKey('all', day, slot);

				this.drawCell(ctx, {
					x,
					y,
					w: cellSize,
					h: cellSize,
					radius,
					value,
					maxValue,
					palette,
					cellKey,
					valueFontSize,
					problemCount: Number(detail.problem_count || 0)
				});

				this._cellBoxes.push(this.createCellHitBox({
					scope: 'all',
					day,
					slot,
					value,
					weekLabel: week.label,
					problemCount: Number(detail.problem_count || 0),
					itemid: null,
					x,
					y,
					w: cellSize,
					h: cellSize,
					startTs: this.getSlotStartTs(Number(week.start_ts || 0), day, slot, this._slotSeconds)
				}));
			}
		}
	}

	drawComparisonMode(ctx, metrics, columnLayout, legendY, week, palette, compact, panelLayout = null) {
		const layout = panelLayout ?? this.getComparisonPanelLayout(ctx.canvas.height / (window.devicePixelRatio || 1), metrics, columnLayout, this.getWeekItems(week).length, compact, 18);
		const dayFontSize = 9;
		const rowGap = layout.rowGap;
		const cellSize = layout.cellSize;
		const radius = itemHeatmapClamp(cellSize * 0.2, 3, 7);
		const valueFontSize = itemHeatmapClamp(Math.floor(cellSize * 0.4), 8, 12);
		const sharedMaxValue = Number(week.comparison_max_value || 0);
		const panels = Array.isArray(week.comparison) ? week.comparison : [];

		panels.forEach((panel, index) => {
			const panelY = layout.firstPanelTop + (index * (layout.panelHeight + layout.panelGap));
			const panelGridTop = panelY + layout.panelHeaderHeight;
			const latestLabel = this.formatLatestLabel(panel);

			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = palette.textStrong;
			ctx.font = itemHeatmapFont(compact ? 11 : 12, 700);
			ctx.fillText(
				this.truncateText(
					ctx,
					panel.full_label || panel.label || panel.name || `Item ${panel.itemid}`,
					(ctx.canvas.width / (window.devicePixelRatio || 1)) - (metrics.outerPaddingX * 2) - 90
				),
				metrics.outerPaddingX,
				panelY + (layout.panelHeaderHeight / 2)
			);

			if (latestLabel !== '') {
				ctx.textAlign = 'right';
				ctx.fillStyle = palette.textSubdued;
				ctx.font = itemHeatmapFont(compact ? 9 : 10, 500);
				ctx.fillText(latestLabel, (ctx.canvas.width / (window.devicePixelRatio || 1)) - metrics.outerPaddingX, panelY + (layout.panelHeaderHeight / 2));
			}

			this.drawDayLabels(ctx, metrics.gridX, panelGridTop, cellSize, rowGap, dayFontSize, palette);

			for (let day = 0; day < 7; day++) {
				for (let slot = 0; slot < week.slot_count; slot++) {
					const detail = this.getBucketDetail(week, day, slot);
					const itemDetail = this.getItemDetail(detail, panel.itemid);
					const value = Number(panel.matrix?.[day]?.[slot] ?? itemDetail?.value ?? 0);
					const x = metrics.gridX + (slot * (cellSize + columnLayout.gapX));
					const y = panelGridTop + (day * (cellSize + rowGap));
					const cellKey = this.getCellKey(panel.itemid, day, slot);

					this.drawCell(ctx, {
						x,
						y,
						w: cellSize,
						h: cellSize,
						radius,
						value,
						maxValue: sharedMaxValue,
						palette,
						cellKey,
						valueFontSize,
						problemCount: Number(detail.problem_count || 0)
					});

					this._cellBoxes.push(this.createCellHitBox({
						scope: 'compare',
						day,
						slot,
						value,
						weekLabel: week.label,
						problemCount: Number(detail.problem_count || 0),
						itemid: Number(panel.itemid),
						panelLabel: panel.full_label || panel.label || panel.name || '',
						x,
						y,
						w: cellSize,
						h: cellSize,
						startTs: this.getSlotStartTs(Number(week.start_ts || 0), day, slot, this._slotSeconds)
					}));
				}
			}
		});
	}

	drawDayLabels(ctx, gridX, gridTop, cellHeight, gapY, fontSize, palette) {
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.font = itemHeatmapFont(fontSize, 700);
		ctx.fillStyle = palette.textMuted;

		for (let day = 0; day < 7; day++) {
			const y = gridTop + (day * (cellHeight + gapY)) + (cellHeight / 2);
			ctx.fillText(ITEM_HEATMAP_DAY_LABELS[day], gridX - 6, y);
		}
	}

	drawCell(ctx, options) {
		const fill = this.getCellColor(options.value, options.maxValue, options.palette);
		const isHovered = this._hoveredCellKey === options.cellKey;
		const isPressed = this._pressedCellKey === options.cellKey || this._openMenuCellKey === options.cellKey;
		const stroke = isPressed ? options.palette.pressBorder : (isHovered ? options.palette.hoverBorder : options.palette.cellBorder);
		const strokeWidth = isPressed || isHovered ? 1.8 : 1;

		itemHeatmapDrawRoundedRect(ctx, options.x, options.y, options.w, options.h, options.radius, fill, stroke, strokeWidth);

		if (isHovered || isPressed) {
			itemHeatmapDrawRoundedRect(
				ctx,
				options.x,
				options.y,
				options.w,
				options.h,
				options.radius,
				isPressed ? options.palette.pressOverlay : options.palette.hoverOverlay
			);
		}

		if (options.problemCount > 0) {
			ctx.beginPath();
			ctx.arc(options.x + options.w - 5, options.y + 5, 2.4, 0, Math.PI * 2);
			ctx.fillStyle = options.palette.problemDot;
			ctx.fill();
		}

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = itemHeatmapFont(options.valueFontSize, 700);
		ctx.fillStyle = options.value > 0 ? options.palette.valueText : options.palette.zeroValueText;
		ctx.fillText(this.formatValue(options.value), options.x + (options.w / 2), options.y + (options.h / 2));
	}

	drawLegend(ctx, metrics, columnLayout, legendY, palette) {
		const legendX = metrics.outerPaddingX + metrics.gridLabelWidth;
		const canvasWidth = ctx.canvas.width / (window.devicePixelRatio || 1);
		const gradientWidth = itemHeatmapClamp((canvasWidth - legendX - metrics.outerPaddingX) * 0.16, 90, 136);
		const gradient = ctx.createLinearGradient(legendX, 0, legendX + gradientWidth, 0);
		gradient.addColorStop(0, palette.scale[0]);
		gradient.addColorStop(0.45, palette.scale[2]);
		gradient.addColorStop(1, palette.scale[4]);

		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = palette.legendText;
		ctx.font = itemHeatmapFont(10, 700);
		ctx.fillText('Low', metrics.outerPaddingX, legendY);
		itemHeatmapDrawRoundedRect(ctx, legendX, legendY - 3, gradientWidth, 6, 3, gradient);
		ctx.fillText('High', legendX + gradientWidth + 10, legendY);
	}

	handleMouseMove(event) {
		const hit = this.hitTest(event);
		let shouldRedraw = false;

		if (!hit) {
			shouldRedraw = this._hoveredCellKey !== null || this._hoveredNavKey !== null;
			this._hoveredCellKey = null;
			this._hoveredNavKey = null;
			this.hideTooltip();
			this.updateCursor(null);

			if (shouldRedraw) {
				this.drawCurrentWeek();
			}

			return;
		}

		if (hit.type === 'nav') {
			shouldRedraw = this._hoveredNavKey !== hit.key || this._hoveredCellKey !== null;
			this._hoveredNavKey = hit.key;
			this._hoveredCellKey = null;
			this.hideTooltip();
			this.updateCursor(hit.enabled ? 'pointer' : 'default');

			if (shouldRedraw) {
				this.drawCurrentWeek();
			}

			return;
		}

		const cellKey = this.getCellKey(hit.itemid || 'all', hit.day, hit.slot);
		shouldRedraw = this._hoveredCellKey !== cellKey || this._hoveredNavKey !== null;
		this._hoveredCellKey = cellKey;
		this._hoveredNavKey = null;
		this.updateTooltip(hit, event);
		this.updateCursor(this.isCellActionable(hit) ? 'pointer' : 'default');

		if (shouldRedraw) {
			this.drawCurrentWeek();
		}
	}

	handleMouseLeave() {
		const shouldRedraw = this._hoveredCellKey !== null || this._hoveredNavKey !== null;

		this._hoveredCellKey = null;
		this._hoveredNavKey = null;
		this.hideTooltip();
		this.updateCursor(null);

		if (shouldRedraw) {
			this.drawCurrentWeek();
		}
	}

	handleClick(event) {
		const hit = this.hitTest(event);

		if (!hit) {
			this.hideContextMenu();
			return;
		}

		if (hit.type === 'nav') {
			this.hideContextMenu();
			this.navigateWeek(hit.key);
			return;
		}

		if (!this.isCellActionable(hit)) {
			this.hideContextMenu();
			return;
		}

		const cellKey = this.getCellKey(hit.itemid || 'all', hit.day, hit.slot);
		this._pressedCellKey = cellKey;
		this._openMenuCellKey = cellKey;
		this.drawCurrentWeek();
		this.showContextMenu(hit, event);

		window.setTimeout(() => {
			if (this._pressedCellKey === cellKey) {
				this._pressedCellKey = null;
				this.drawCurrentWeek();
			}
		}, 180);
	}

	handleDocumentPointerDown(event) {
		if (!this._container || !this._menu || !this._menu.classList.contains('is-visible')) {
			return;
		}

		if (this._container.contains(event.target)) {
			return;
		}

		this.hideContextMenu();
	}

	handleCanvasWrapScroll() {
		this.hideTooltip();
		this.hideContextMenu();
	}

	navigateWeek(direction) {
		if (this._isLoading || this._visibleWeekStartTs === null) {
			return;
		}

		const delta = direction === 'prev' ? -ITEM_HEATMAP_WEEK_SECONDS : ITEM_HEATMAP_WEEK_SECONDS;
		const targetWeekStart = this._visibleWeekStartTs + delta;

		if (targetWeekStart < this._oldestWeekStartTs || targetWeekStart > this._currentWeekStartTs) {
			return;
		}

		this.hideTooltip();
		this.hideContextMenu();
		this._hoveredCellKey = null;
		this._hoveredNavKey = null;
		this._openMenuCellKey = null;

		if (this._weeks.has(String(targetWeekStart))) {
			this._visibleWeekStartTs = targetWeekStart;
			this._requestedWeekStartTs = targetWeekStart;
			this.drawCurrentWeek();
			return;
		}

		this._requestedWeekStartTs = targetWeekStart;
		this.requestWeekUpdate();
	}

	requestWeekUpdate() {
		this._stopUpdating({do_abort: true});
		this._startUpdating();
	}

	hitTest(event) {
		if (!this._canvas) {
			return null;
		}

		const rect = this._canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		for (const [key, box] of Object.entries(this._navBoxes)) {
			if (
				x >= box.x
				&& x <= box.x + box.w
				&& y >= box.y
				&& y <= box.y + box.h
			) {
				return {
					type: 'nav',
					key,
					enabled: Boolean(box.enabled)
				};
			}
		}

		for (const cell of this._cellBoxes) {
			if (
				x >= cell.x
				&& x <= cell.x + cell.w
				&& y >= cell.y
				&& y <= cell.y + cell.h
			) {
				return cell;
			}
		}

		return null;
	}

	updateTooltip(cell, event) {
		if (!this._tooltip || !this._container) {
			return;
		}

		this._tooltip.innerHTML = this.buildTooltipContent(cell);
		this._tooltip.classList.add('is-visible');

		const containerRect = this._container.getBoundingClientRect();
		const tooltipRect = this._tooltip.getBoundingClientRect();
		let left = event.clientX - containerRect.left + 14;
		let top = event.clientY - containerRect.top + 14;

		if (left + tooltipRect.width > containerRect.width - 8) {
			left = containerRect.width - tooltipRect.width - 8;
		}

		if (top + tooltipRect.height > containerRect.height - 8) {
			top = event.clientY - containerRect.top - tooltipRect.height - 14;
		}

		left = Math.max(left, 8);
		top = Math.max(top, 8);
		this._tooltip.style.transform = `translate(${left}px, ${top}px)`;
	}

	buildTooltipContent(cell) {
		const week = this.getVisibleWeek();
		const detail = this.getBucketDetail(week, cell.day, cell.slot);
		const dayName = ITEM_HEATMAP_DAY_NAMES[cell.day] || ITEM_HEATMAP_DAY_LABELS[cell.day];
		const slotRange = this.formatSlotRange(cell.slot, this._slotSeconds);
		const rows = [
			{ label: 'Day', value: dayName },
			{ label: 'Slot', value: slotRange },
			{ label: 'Value', value: this.formatValueWithUnits(cell.value, this.resolveCellUnits(cell)) }
		];
		const itemBreakdown = this.getTooltipBreakdownItems(detail, cell);
		const problemNames = Array.isArray(detail.problem_names) ? detail.problem_names : [];

		if (detail.problem_count > 0) {
			rows.push({ label: 'Problems', value: String(detail.problem_count) });
		}

		const cellItem = cell.itemid ? this.getItemDetail(detail, cell.itemid) : null;

		if (cellItem) {
			const latestLabel = this.formatLatestDetail(cellItem);

			if (latestLabel !== '') {
				rows.push({ label: 'Latest', value: latestLabel });
			}
		}

		const rowsMarkup = rows.map((row) => (
			`<div class="item-heatmap-widget__tooltip-row">`
			+ `<span class="item-heatmap-widget__tooltip-label">${this.escapeHtml(row.label)}</span>`
			+ `<span class="item-heatmap-widget__tooltip-value">${this.escapeHtml(row.value)}</span>`
			+ `</div>`
		)).join('');

		const problemMarkup = problemNames.length > 0
			? `<div class="item-heatmap-widget__tooltip-sublist">${problemNames.map((name) => `<div>${this.escapeHtml(name)}</div>`).join('')}</div>`
			: '';
		const breakdownMarkup = itemBreakdown.length > 0
			? `
				<div class="item-heatmap-widget__tooltip-divider"></div>
				<div class="item-heatmap-widget__tooltip-section-title">${this.escapeHtml(cell.itemid ? 'Item context' : 'Item breakdown')}</div>
				<div class="item-heatmap-widget__tooltip-items">
					${itemBreakdown.map((item) => `
						<div class="item-heatmap-widget__tooltip-item">
							<div class="item-heatmap-widget__tooltip-item-name">${this.escapeHtml(item.label)}</div>
							<div class="item-heatmap-widget__tooltip-item-value">${this.escapeHtml(item.value)}</div>
						</div>
					`).join('')}
				</div>
			`
			: '';

		return `
			<div class="item-heatmap-widget__tooltip-week">${this.escapeHtml(cell.weekLabel)}</div>
			${cell.panelLabel ? `<div class="item-heatmap-widget__tooltip-heading">${this.escapeHtml(cell.panelLabel)}</div>` : ''}
			${rowsMarkup}
			${problemMarkup}
			${breakdownMarkup}
		`;
	}

	getTooltipBreakdownItems(detail, cell) {
		const items = Array.isArray(detail.items) ? detail.items.slice() : [];

		if (cell.itemid) {
			const currentItem = items.find((item) => Number(item.itemid) === Number(cell.itemid));

			if (!currentItem) {
				return [];
			}

			return [{
				label: currentItem.full_label || currentItem.label || currentItem.name || `Item ${currentItem.itemid}`,
				value: this.formatValueWithUnits(currentItem.value, currentItem.units || '')
			}];
		}

		const contributingItems = items
			.filter((item) => Number(item.sample_count || 0) > 0 || Number(item.value || 0) > 0)
			.sort((left, right) => Number(right.value || 0) - Number(left.value || 0));

		return contributingItems.slice(0, 8).map((item) => ({
			label: item.label || item.name || `Item ${item.itemid}`,
			value: this.formatValueWithUnits(item.value, item.units || '')
		}));
	}

	showContextMenu(cell, event) {
		if (!this._menu || !this._container) {
			return;
		}

		const links = this.getContextMenuLinks(cell);

		if (links.length === 0) {
			this.hideContextMenu();
			return;
		}

		const dayName = ITEM_HEATMAP_DAY_NAMES[cell.day] || ITEM_HEATMAP_DAY_LABELS[cell.day];
		const slotRange = this.formatSlotRange(cell.slot, this._slotSeconds);
		const summaryParts = [this.formatValueWithUnits(cell.value, this.resolveCellUnits(cell))];

		if (cell.problemCount > 0) {
			summaryParts.push(`${cell.problemCount} problems`);
		}

		this._menu.innerHTML = `
			<div class="item-heatmap-widget__menu-title">${this.escapeHtml(dayName)} | ${this.escapeHtml(slotRange)}</div>
			<div class="item-heatmap-widget__menu-week">${this.escapeHtml(cell.weekLabel)}</div>
			<div class="item-heatmap-widget__menu-summary">${this.escapeHtml(summaryParts.join(' | '))}</div>
			<div class="item-heatmap-widget__menu-links">
				${links.map((link) => (
					`<a class="item-heatmap-widget__menu-link" href="${this.escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(link.label)}</a>`
				)).join('')}
			</div>
		`;
		this._menu.classList.add('is-visible');

		const containerRect = this._container.getBoundingClientRect();
		const menuRect = this._menu.getBoundingClientRect();
		let left = event.clientX - containerRect.left + 12;
		let top = event.clientY - containerRect.top + 12;

		if (left + menuRect.width > containerRect.width - 8) {
			left = containerRect.width - menuRect.width - 8;
		}

		if (top + menuRect.height > containerRect.height - 8) {
			top = event.clientY - containerRect.top - menuRect.height - 12;
		}

		left = Math.max(left, 8);
		top = Math.max(top, 8);
		this._menu.style.transform = `translate(${left}px, ${top}px)`;
	}

	getContextMenuLinks(cell) {
		const week = this.getVisibleWeek();
		const item = cell.itemid
			? this.getItemMetadataById(cell.itemid, week)
			: this.getPrimaryItemMetadata(week);
		const from = this.formatAbsoluteDateTime(cell.startTs);
		const to = this.formatAbsoluteDateTime(cell.endTs);
		const links = [];
		const hostids = Array.isArray(week?.hostids) ? week.hostids.map((hostid) => Number(hostid)).filter((hostid) => hostid > 0) : [];

		if (item) {
			links.push({
				label: cell.itemid ? 'Exact graph' : 'Primary item graph',
				url: this.buildGraphUrl(item.itemid, from, to)
			});
			links.push({
				label: cell.itemid ? 'History values' : 'Primary item values',
				url: this.buildValuesUrl(item.itemid, from, to)
			});
			links.push({
				label: 'Latest data',
				url: this.buildLatestDataUrl(item, from, to)
			});
		}

		if (hostids.length > 0) {
			links.push({
				label: 'Related problems',
				url: this.buildProblemsUrl(hostids, from, to)
			});
		}

		return links;
	}

	hideTooltip() {
		if (!this._tooltip) {
			return;
		}

		this._tooltip.classList.remove('is-visible');
	}

	hideContextMenu() {
		if (!this._menu) {
			return;
		}

		this._menu.classList.remove('is-visible');

		if (this._openMenuCellKey !== null) {
			this._openMenuCellKey = null;
			this.drawCurrentWeek();
		}
	}

	updateCursor(cursor) {
		if (this._canvas) {
			this._canvas.style.cursor = cursor || 'default';
		}
	}

	setLoadingState(isLoading) {
		this._isLoading = Boolean(isLoading);

		if (this._container) {
			this._container.classList.remove('is-loading');
		}
	}

	shouldUseComparisonMode(week) {
		return this._displayMode === ITEM_HEATMAP_DISPLAY_MODE_COMPARE && this.getWeekItems(week).length > 1;
	}

	isCellActionable(cell) {
		return Number(cell.value || 0) > 0 || Number(cell.problemCount || 0) > 0;
	}

	createCellHitBox(options) {
		const startTs = Number(options.startTs);

		return {
			type: 'cell',
			scope: options.scope,
			day: options.day,
			slot: options.slot,
			value: Number(options.value || 0),
			weekLabel: options.weekLabel || '',
			problemCount: Number(options.problemCount || 0),
			itemid: options.itemid,
			panelLabel: options.panelLabel || '',
			x: options.x,
			y: options.y,
			w: options.w,
			h: options.h,
			startTs,
			endTs: startTs + this._slotSeconds - 1
		};
	}

	getBucketDetail(week, day, slot) {
		return week?.bucket_details?.[day]?.[slot] || {
			value: 0,
			problem_count: 0,
			problem_names: [],
			items: []
		};
	}

	getItemDetail(detail, itemid) {
		return (Array.isArray(detail?.items) ? detail.items : []).find((item) => Number(item.itemid) === Number(itemid)) || null;
	}

	getCellKey(scope, day, slot) {
		return `${scope}:${day}:${slot}`;
	}

	getCellColor(value, maxValue, palette) {
		if (maxValue <= 0 || value <= 0) {
			return palette.zeroCell;
		}

		const ratio = value / maxValue;

		if (ratio < 0.2) {
			return palette.scale[0];
		}
		if (ratio < 0.45) {
			return palette.scale[1];
		}
		if (ratio < 0.65) {
			return palette.scale[2];
		}
		if (ratio < 0.85) {
			return palette.scale[3];
		}

		return palette.scale[4];
	}

	formatValue(value) {
		const numericValue = Number(value || 0);

		if (Number.isInteger(numericValue)) {
			return String(numericValue);
		}

		return numericValue.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
	}

	formatValueWithUnits(value, units) {
		const formattedValue = this.formatValue(value);
		const normalizedUnits = String(units || '').trim();

		return normalizedUnits !== '' ? `${formattedValue} ${normalizedUnits}` : formattedValue;
	}

	formatLatestLabel(item) {
		const detail = this.formatLatestDetail(item);

		return detail === '' ? '' : `Latest ${detail}`;
	}

	formatLatestDetail(item) {
		const latestValue = String(item?.latest_value ?? '').trim();
		const latestClock = Number(item?.latest_clock || 0);

		if (latestValue === '' && latestClock <= 0) {
			return '';
		}

		const formattedValue = latestValue === '' ? 'n/a' : this.formatValueWithUnits(latestValue, item?.units || '');

		if (latestClock <= 0) {
			return formattedValue;
		}

		return `${formattedValue} | ${this.formatRelativeTime(latestClock)}`;
	}

	formatRelativeTime(timestamp) {
		const seconds = Math.max(0, Math.round(Date.now() / 1000) - Number(timestamp || 0));

		if (seconds < 60) {
			return `${seconds}s ago`;
		}

		const minutes = Math.floor(seconds / 60);

		if (minutes < 60) {
			return `${minutes}m ago`;
		}

		const hours = Math.floor(minutes / 60);

		if (hours < 24) {
			return `${hours}h ago`;
		}

		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	formatSlotHeaderLabel(slot) {
		const startSeconds = slot * this._slotSeconds;
		const hours = Math.floor(startSeconds / 3600);
		const minutes = Math.floor((startSeconds % 3600) / 60);

		if (this._slotSeconds >= 3600 && minutes === 0) {
			return this.formatHourLabel(hours);
		}

		if (this._slotSeconds === 1800) {
			return minutes === 0 ? this.formatHourLabel(hours) : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
		}

		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
	}

	formatHourLabel(hour) {
		if (this._hourFormat === 24) {
			return `${String(hour).padStart(2, '0')}h`;
		}

		if (this._hourFormat === 120) {
			return `${hour % 12 === 0 ? 12 : hour % 12}h`;
		}

		const meridiem = hour < 12 ? 'am' : 'pm';
		const displayHour = hour % 12 === 0 ? 12 : hour % 12;
		return `${displayHour} ${meridiem}`;
	}

	formatSlotRange(slot, slotSeconds) {
		const startSeconds = slot * slotSeconds;
		const endSeconds = startSeconds + slotSeconds - 1;

		return `${this.formatClockSeconds(startSeconds)} - ${this.formatClockSeconds(endSeconds)}`;
	}

	formatClockSeconds(totalSeconds) {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);

		if (this._hourFormat === 24) {
			return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
		}

		const meridiem = hours < 12 ? 'AM' : 'PM';
		const displayHour = hours % 12 === 0 ? 12 : hours % 12;

		if (this._hourFormat === 120) {
			return `${String(displayHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
		}

		return `${String(displayHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${meridiem}`;
	}

	getSlotStartTs(weekStartTs, day, slot, slotSeconds) {
		return weekStartTs + (day * ITEM_HEATMAP_DAY_SECONDS) + (slot * slotSeconds);
	}

	formatAbsoluteDateTime(timestamp) {
		const date = new Date(Number(timestamp || 0) * 1000);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');

		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	}

	buildGraphUrl(itemid, from, to) {
		return `history.php?${new URLSearchParams({
			action: 'showgraph',
			'itemids[]': String(itemid),
			from,
			to
		}).toString()}`;
	}

	buildValuesUrl(itemid, from, to) {
		return `history.php?${new URLSearchParams({
			action: 'showvalues',
			'itemids[]': String(itemid),
			from,
			to
		}).toString()}`;
	}

	buildLatestDataUrl(item, from, to) {
		return `zabbix.php?${new URLSearchParams({
			action: 'latest.view',
			filter_set: '1',
			'hostids[]': String(item.hostid || 0),
			name: item.name || '',
			from,
			to
		}).toString()}`;
	}

	buildProblemsUrl(hostids, from, to) {
		const params = new URLSearchParams({
			action: 'problem.view',
			filter_set: '1',
			from,
			to
		});

		hostids.forEach((hostid) => params.append('hostids[]', String(hostid)));

		return `zabbix.php?${params.toString()}`;
	}

	normalizeDisplayMode(value) {
		return Number(value || 0) === ITEM_HEATMAP_DISPLAY_MODE_COMPARE
			? ITEM_HEATMAP_DISPLAY_MODE_COMPARE
			: ITEM_HEATMAP_DISPLAY_MODE_CONSOLIDATED;
	}

	normalizeSlotSeconds(value) {
		const numericValue = Number(value || 3600);
		const supportedValues = [1800, 3600, 7200, 14400, 21600, 43200];

		return supportedValues.includes(numericValue) ? numericValue : 3600;
	}

	normalizeHourFormat(value) {
		const numericValue = Number(value || 12);

		if (numericValue === 24) {
			return 24;
		}

		if (numericValue === 120) {
			return 120;
		}

		return 12;
	}

	getDisplayTitle() {
		return String(this._displayTitle || '').trim();
	}

	getThemePalette() {
		const sampleElements = [
			this._container,
			this._target,
			this._target?.closest('.dashboard-grid-widget-container'),
			document.body,
			document.documentElement
		];
		const backgroundColor = this.getFirstOpaqueColor(sampleElements, 'backgroundColor') || 'rgb(36, 39, 43)';
		const themeTextColor = this.getFirstOpaqueColor(sampleElements, 'color') || '#eef2f7';
		const isLightTheme = this.getColorLuminance(backgroundColor) >= 0.55;

		return {
			textStrong: themeTextColor,
			textMuted: isLightTheme ? '#5e7283' : '#b5bcc7',
			textSubdued: isLightTheme ? '#6d7f8f' : '#aab2bd',
			navBg: isLightTheme ? 'rgba(31, 44, 51, 0.06)' : 'rgba(255, 255, 255, 0.08)',
			navBgHover: isLightTheme ? 'rgba(31, 44, 51, 0.10)' : 'rgba(255, 255, 255, 0.14)',
			navBgDisabled: isLightTheme ? 'rgba(31, 44, 51, 0.03)' : 'rgba(255, 255, 255, 0.04)',
			navBorder: isLightTheme ? 'rgba(31, 44, 51, 0.14)' : 'rgba(255, 255, 255, 0.18)',
			navBorderDisabled: isLightTheme ? 'rgba(31, 44, 51, 0.08)' : 'rgba(255, 255, 255, 0.08)',
			navDisabledText: isLightTheme ? '#8b98a3' : '#7b818c',
			zeroCell: isLightTheme ? 'rgba(31, 44, 51, 0.14)' : '#3b3d42',
			cellBorder: isLightTheme ? 'rgba(31, 44, 51, 0.12)' : 'rgba(255, 255, 255, 0.07)',
			hoverBorder: isLightTheme ? '#1f2c33' : '#f3f4f6',
			pressBorder: isLightTheme ? '#de8b24' : '#f8c33d',
			hoverOverlay: isLightTheme ? 'rgba(31, 44, 51, 0.06)' : 'rgba(255, 255, 255, 0.07)',
			pressOverlay: isLightTheme ? 'rgba(222, 139, 36, 0.10)' : 'rgba(248, 195, 61, 0.14)',
			valueText: '#f8fafc',
			zeroValueText: isLightTheme ? '#4d6070' : '#e7ebf0',
			legendText: isLightTheme ? '#607384' : '#b2bac5',
			problemDot: isLightTheme ? '#d97706' : '#f59e0b',
			scale: ['#2ebd62', '#35bf69', '#f59a23', '#ef7d24', '#dc4d35']
		};
	}

	getFirstOpaqueColor(elements, property) {
		for (const element of elements) {
			if (!element) {
				continue;
			}

			const value = window.getComputedStyle(element)[property];

			if (!this.isTransparentColor(value)) {
				return String(value).trim();
			}
		}

		return '';
	}

	isTransparentColor(value) {
		if (!value || value === 'transparent') {
			return true;
		}

		return /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)$/i.test(String(value).trim());
	}

	parseColor(value) {
		const normalized = String(value || '').trim();
		const rgbMatch = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);

		if (rgbMatch) {
			return {
				r: Number(rgbMatch[1]),
				g: Number(rgbMatch[2]),
				b: Number(rgbMatch[3])
			};
		}

		const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

		if (!hexMatch) {
			return null;
		}

		const hex = hexMatch[1];

		if (hex.length === 3) {
			return {
				r: parseInt(hex[0] + hex[0], 16),
				g: parseInt(hex[1] + hex[1], 16),
				b: parseInt(hex[2] + hex[2], 16)
			};
		}

		return {
			r: parseInt(hex.slice(0, 2), 16),
			g: parseInt(hex.slice(2, 4), 16),
			b: parseInt(hex.slice(4, 6), 16)
		};
	}

	getColorLuminance(value) {
		const color = this.parseColor(value);

		if (!color) {
			return 0;
		}

		const toLinear = (channel) => {
			const normalized = channel / 255;
			return normalized <= 0.03928
				? normalized / 12.92
				: ((normalized + 0.055) / 1.055) ** 2.4;
		};

		return (0.2126 * toLinear(color.r)) + (0.7152 * toLinear(color.g)) + (0.0722 * toLinear(color.b));
	}

	truncateText(ctx, text, maxWidth) {
		let result = String(text || '');

		if (ctx.measureText(result).width <= maxWidth) {
			return result;
		}

		while (result.length > 1 && ctx.measureText(`${result}...`).width > maxWidth) {
			result = result.slice(0, -1);
		}

		return `${result}...`;
	}

	escapeHtml(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	resolveCellUnits(cell) {
		if (cell.itemid) {
			const item = this.getItemMetadataById(cell.itemid);
			return item?.units || '';
		}

		return '';
	}
}

