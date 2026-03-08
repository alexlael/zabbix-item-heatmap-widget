const ITEM_HEATMAP_WEEK_SECONDS = 7 * 24 * 60 * 60;
const ITEM_HEATMAP_HOUR_SECONDS = 60 * 60;
const ITEM_HEATMAP_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ITEM_HEATMAP_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ITEM_HEATMAP_HOUR_LABELS_12 = [
	'12 am', '1 am', '2 am', '3 am', '4 am', '5 am',
	'6 am', '7 am', '8 am', '9 am', '10 am', '11 am',
	'12 pm', '1 pm', '2 pm', '3 pm', '4 pm', '5 pm',
	'6 pm', '7 pm', '8 pm', '9 pm', '10 pm', '11 pm'
];
const ITEM_HEATMAP_SURFACE_LABEL = 'DAY x HOUR HEATMAP';
const ITEM_HEATMAP_HELP_LABEL = 'Click a non-zero cell to open the primary item graph';

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
		this._tooltip = null;
		this._week = null;
		this._weeks = new Map();
		this._visibleWeekStartTs = null;
		this._requestedWeekStartTs = null;
		this._currentWeekStartTs = null;
		this._oldestWeekStartTs = null;
		this._primaryItemUrl = '';
		this._selectedItemCount = 0;
		this._hourFormat = 12;
		this._displayTitle = '';
		this._showDisplayTitle = true;
		this._legendText = '';
		this._showLegend = false;
		this._isLoading = false;
		this._hoveredCellKey = null;
		this._hoveredNavKey = null;
		this._pressedCellKey = null;
		this._cellBoxes = [];
		this._navBoxes = {};
		this._boundCanvas = null;
		this._handleMouseMove = (event) => this.handleMouseMove(event);
		this._handleMouseLeave = () => this.handleMouseLeave();
		this._handleClick = (event) => this.handleClick(event);
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
			return;
		}

		this._week = week;
		this._weeks.set(String(week.start_ts), week);
		this._visibleWeekStartTs = Number(week.start_ts);
		this._requestedWeekStartTs = Number(week.start_ts);
		this._currentWeekStartTs = Number(this._container.dataset.currentWeekStart || week.start_ts);
		this._oldestWeekStartTs = Number(this._container.dataset.oldestWeekStart || week.start_ts);
		this._primaryItemUrl = this._container.dataset.primaryItemUrl || '';
		this._selectedItemCount = Number(this._container.dataset.selectedItemCount || 0);
		this._hourFormat = this.normalizeHourFormat(this._container.dataset.hourFormat);
		this._displayTitle = this._container.dataset.displayTitle || this._container.dataset.name || 'Item Heatmap';
		this._showDisplayTitle = Number(this._container.dataset.showDisplayTitle || 0) === 1;
		this._legendText = this._container.dataset.legendText || '';
		this._showLegend = Number(this._container.dataset.showLegend || 0) === 1;
		this._hoveredCellKey = null;
		this._hoveredNavKey = null;
		this._pressedCellKey = null;

		this.bindCanvasEvents();
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
			this.drawCurrentWeek();
		}
	}

	captureElements() {
		this._container = this._target.querySelector('.item-heatmap-widget');
		this._canvas = this._container?.querySelector('.item-heatmap-widget__canvas') ?? null;
		this._tooltip = this._container?.querySelector('.item-heatmap-widget__tooltip') ?? null;
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

		if (this._boundCanvas === this._canvas) {
			return;
		}

		this._canvas.addEventListener('mousemove', this._handleMouseMove);
		this._canvas.addEventListener('mouseleave', this._handleMouseLeave);
		this._canvas.addEventListener('click', this._handleClick);
		this._boundCanvas = this._canvas;
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
		const height = Math.max(parent.clientHeight, 170);
		const dpr = window.devicePixelRatio || 1;

		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);

		const matrix = Array.isArray(week.matrix) ? week.matrix : [];
		const maxValue = Number(week.max_value || 0);
		const weekStartTs = Number(week.start_ts || 0);
		const hasPrev = weekStartTs > this._oldestWeekStartTs;
		const hasNext = weekStartTs < this._currentWeekStartTs;
		const compact = width < 640 || height < 250;
		const outerPaddingX = compact ? 6 : 10;
		const outerPaddingTop = compact ? 6 : 8;
		const outerPaddingBottom = compact ? 6 : 8;
		const gridLabelWidth = compact ? 30 : 38;
		const displayTitle = this.getDisplayTitle();
		const showDisplayTitle = this._showDisplayTitle && displayTitle !== '';
		const showLegend = this._showLegend && this._legendText.trim() !== '';
		const navButtonW = compact ? 26 : 30;
		const navButtonH = compact ? 22 : 26;
		const navGap = compact ? 8 : 10;
		const titleFontSize = compact ? 13 : 15;
		const legendFontSize = compact ? 9 : 10;
		const titleBaselineY = outerPaddingTop + (navButtonH / 2);
		const weekLabel = week.label || 'Week';
		const palette = this.getThemePalette();

		ctx.textBaseline = 'middle';
		ctx.textAlign = 'center';
		ctx.font = itemHeatmapFont(compact ? 11 : 12, 700);
		const weekLabelWidth = Math.ceil(ctx.measureText(weekLabel).width);
		const navRowWidth = (navButtonW * 2) + (navGap * 2) + weekLabelWidth;
		const navStartX = Math.max(width - outerPaddingX - navRowWidth, outerPaddingX);
		const prevX = navStartX;
		const labelCenterX = prevX + navButtonW + navGap + (weekLabelWidth / 2);
		const nextX = labelCenterX + (weekLabelWidth / 2) + navGap;
		const titleMaxWidth = Math.max(navStartX - outerPaddingX - 12, 100);

		this._navBoxes = {
			prev: { x: prevX, y: outerPaddingTop, w: navButtonW, h: navButtonH, enabled: hasPrev },
			next: { x: nextX, y: outerPaddingTop, w: navButtonW, h: navButtonH, enabled: hasNext }
		};
		this._cellBoxes = [];

		if (showDisplayTitle) {
			ctx.textAlign = 'left';
			ctx.fillStyle = palette.textStrong;
			ctx.font = itemHeatmapFont(titleFontSize, 700);
			ctx.fillText(this.truncateText(ctx, displayTitle, titleMaxWidth), outerPaddingX, titleBaselineY);
		}

		itemHeatmapDrawRoundedRect(
			ctx,
			prevX,
			outerPaddingTop,
			navButtonW,
			navButtonH,
			6,
			hasPrev ? (this._hoveredNavKey === 'prev' ? palette.navBgHover : palette.navBg) : palette.navBgDisabled,
			hasPrev ? palette.navBorder : palette.navBorderDisabled,
			1
		);
		itemHeatmapDrawRoundedRect(
			ctx,
			nextX,
			outerPaddingTop,
			navButtonW,
			navButtonH,
			6,
			hasNext ? (this._hoveredNavKey === 'next' ? palette.navBgHover : palette.navBg) : palette.navBgDisabled,
			hasNext ? palette.navBorder : palette.navBorderDisabled,
			1
		);

		ctx.textAlign = 'center';
		ctx.font = itemHeatmapFont(compact ? 12 : 13, 700);
		ctx.fillStyle = hasPrev ? palette.textStrong : palette.navDisabledText;
		ctx.fillText('\u2190', prevX + (navButtonW / 2), outerPaddingTop + (navButtonH / 2));
		ctx.fillStyle = hasNext ? palette.textStrong : palette.navDisabledText;
		ctx.fillText('\u2192', nextX + (navButtonW / 2), outerPaddingTop + (navButtonH / 2));
		ctx.fillStyle = palette.textStrong;
		ctx.font = itemHeatmapFont(compact ? 11 : 12, 700);
		ctx.fillText(weekLabel, labelCenterX, outerPaddingTop + (navButtonH / 2));

		let contentTop = outerPaddingTop + navButtonH + (compact ? 4 : 6);

		if (showLegend) {
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';
			ctx.fillStyle = palette.textSubdued;
			ctx.font = itemHeatmapFont(legendFontSize, 500);
			ctx.fillText(this.truncateText(ctx, this._legendText, width - (outerPaddingX * 2)), outerPaddingX, contentTop);
			contentTop += compact ? 14 : 16;
		}

		const scaleLegendHeight = height >= 210 ? 18 : 14;
		const legendY = height - outerPaddingBottom - (scaleLegendHeight / 2);
		const hourLabelsY = contentTop + (compact ? 7 : 9);
		const gridTop = hourLabelsY + (compact ? 10 : 12);
		const gridBottom = legendY - (compact ? 10 : 12);
		const gridHeight = Math.max(gridBottom - gridTop, 1);
		const gridX = outerPaddingX + gridLabelWidth + 4;
		const gridWidth = Math.max(width - gridX - outerPaddingX, 100);
		const cols = 24;
		const rows = 7;
		let gapX = gridWidth > 760 ? 4 : (gridWidth > 520 ? 3 : 2);
		let gapY = gridHeight > 170 ? 4 : (gridHeight > 120 ? 3 : 2);
		let cellWidth = (gridWidth - (gapX * (cols - 1))) / cols;
		let cellHeight = (gridHeight - (gapY * (rows - 1))) / rows;

		if (cellWidth < 14) {
			gapX = 1;
			cellWidth = (gridWidth - (gapX * (cols - 1))) / cols;
		}

		if (cellHeight < 14) {
			gapY = 1;
			cellHeight = (gridHeight - (gapY * (rows - 1))) / rows;
		}

		const hourLabelStep = cellWidth < 16 ? 4 : (cellWidth < 20 ? 3 : (cellWidth < 26 ? 2 : 1));
		const hourFontSize = cellWidth < 16 ? 8 : (cellWidth < 22 ? 9 : 10);
		const dayFontSize = cellHeight < 18 ? 9 : 11;
		const valueFontSize = itemHeatmapClamp(Math.floor(Math.min(cellHeight * 0.56, cellWidth * 0.62)), 9, 16);
		const radius = itemHeatmapClamp(Math.min(cellWidth, cellHeight) * 0.22, 3, 7);

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = itemHeatmapFont(hourFontSize, 500);
		ctx.fillStyle = palette.textMuted;

		for (let hour = 0; hour < cols; hour++) {
			if (hour % hourLabelStep !== 0) {
				continue;
			}

			const x = gridX + (hour * (cellWidth + gapX)) + (cellWidth / 2);
			ctx.fillText(this.formatHourLabel(hour), x, hourLabelsY);
		}

		ctx.textAlign = 'right';
		ctx.font = itemHeatmapFont(dayFontSize, 700);
		ctx.fillStyle = palette.textMuted;

		for (let day = 0; day < rows; day++) {
			const y = gridTop + (day * (cellHeight + gapY)) + (cellHeight / 2);
			ctx.fillText(ITEM_HEATMAP_DAY_LABELS[day], gridX - 6, y);
		}

		ctx.textAlign = 'center';
		ctx.font = itemHeatmapFont(valueFontSize, 700);

		for (let day = 0; day < rows; day++) {
			for (let hour = 0; hour < cols; hour++) {
				const value = Number(matrix?.[day]?.[hour] ?? 0);
				const x = gridX + (hour * (cellWidth + gapX));
				const y = gridTop + (day * (cellHeight + gapY));
				const cellKey = this.getCellKey(day, hour);
				const isHovered = this._hoveredCellKey === cellKey;
				const isPressed = this._pressedCellKey === cellKey;
				const fill = this.getCellColor(value, maxValue, palette);
				const stroke = isPressed ? palette.pressBorder : (isHovered ? palette.hoverBorder : palette.cellBorder);
				const strokeWidth = isPressed || isHovered ? 1.8 : 1;
				const cellStartTs = weekStartTs + (day * 86400) + (hour * ITEM_HEATMAP_HOUR_SECONDS);

				itemHeatmapDrawRoundedRect(ctx, x, y, cellWidth, cellHeight, radius, fill, stroke, strokeWidth);

				if (isHovered || isPressed) {
					itemHeatmapDrawRoundedRect(
						ctx,
						x,
						y,
						cellWidth,
						cellHeight,
						radius,
						isPressed ? palette.pressOverlay : palette.hoverOverlay
					);
				}

				ctx.fillStyle = value > 0 ? palette.valueText : palette.zeroValueText;
				ctx.fillText(this.formatValue(value), x + (cellWidth / 2), y + (cellHeight / 2));

				this._cellBoxes.push({
					type: 'cell',
					day,
					hour,
					value,
					weekLabel,
					startTs: cellStartTs,
					endTs: cellStartTs + ITEM_HEATMAP_HOUR_SECONDS - 1,
					x,
					y,
					w: cellWidth,
					h: cellHeight
				});
			}
		}

		const legendX = outerPaddingX + gridLabelWidth;
		const gradientWidth = itemHeatmapClamp(gridWidth * 0.16, 90, 136);
		const gradient = ctx.createLinearGradient(legendX, 0, legendX + gradientWidth, 0);
		gradient.addColorStop(0, palette.scale[0]);
		gradient.addColorStop(0.45, palette.scale[2]);
		gradient.addColorStop(1, palette.scale[4]);

		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = palette.legendText;
		ctx.font = itemHeatmapFont(10, 700);
		ctx.fillText('Low', outerPaddingX, legendY);
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

		const cellKey = this.getCellKey(hit.day, hit.hour);
		shouldRedraw = this._hoveredCellKey !== cellKey || this._hoveredNavKey !== null;
		this._hoveredCellKey = cellKey;
		this._hoveredNavKey = null;
		this.updateTooltip(hit, event);
		this.updateCursor(hit.value > 0 ? 'pointer' : 'default');

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
			return;
		}

		if (hit.type === 'nav') {
			this.navigateWeek(hit.key);
			return;
		}

		if (hit.value <= 0) {
			return;
		}

		const url = this.getCellClickUrl(hit);

		if (!url) {
			return;
		}

		const cellKey = this.getCellKey(hit.day, hit.hour);
		this._pressedCellKey = cellKey;
		this.drawCurrentWeek();
		window.open(url, '_blank', 'noopener');

		window.setTimeout(() => {
			if (this._pressedCellKey === cellKey) {
				this._pressedCellKey = null;
				this.drawCurrentWeek();
			}
		}, 180);
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
		this._hoveredCellKey = null;
		this._hoveredNavKey = null;

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
		// Let the Zabbix widget lifecycle create the abort controller and manage the preloader.
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

		const rows = this.buildTooltipRows(cell);
		const content = rows.map((row) => (
			`<div class="item-heatmap-widget__tooltip-row">`
			+ `<span class="item-heatmap-widget__tooltip-label">${this.escapeHtml(row.label)}</span>`
			+ `<span class="item-heatmap-widget__tooltip-value">${this.escapeHtml(row.value)}</span>`
			+ `</div>`
		)).join('');

		this._tooltip.innerHTML = `
			<div class="item-heatmap-widget__tooltip-week">${this.escapeHtml(cell.weekLabel)}</div>
			${content}
		`;
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

	buildTooltipRows(cell) {
		const rows = [
			{ label: 'Day', value: ITEM_HEATMAP_DAY_NAMES[cell.day] || ITEM_HEATMAP_DAY_LABELS[cell.day] },
			{ label: 'Hour', value: this.formatHourRange(cell.hour) },
			{ label: 'Value', value: this.formatValue(cell.value) }
		];

		if (this._selectedItemCount > 1) {
			rows.push({ label: 'Items', value: `${this._selectedItemCount} aggregated` });
		}

		return rows;
	}

	hideTooltip() {
		if (!this._tooltip) {
			return;
		}

		this._tooltip.classList.remove('is-visible');
	}

	updateCursor(cursor) {
		if (this._canvas) {
			this._canvas.style.cursor = cursor || 'default';
		}
	}

	setLoadingState(isLoading) {
		this._isLoading = Boolean(isLoading);

		if (this._container) {
			// Keep only the native Zabbix widget preloader to avoid duplicated loading text inside the heatmap.
			this._container.classList.remove('is-loading');
		}
	}

	getCellClickUrl(cell) {
		if (!this._primaryItemUrl || cell.value <= 0) {
			return null;
		}

		return this._primaryItemUrl;
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

	getCellKey(day, hour) {
		return `${day}:${hour}`;
	}

	getCellColor(value, maxValue, palette = this.getThemePalette()) {
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

	formatHourLabel(hour) {
		if (this._hourFormat === 24) {
			return `${String(hour).padStart(2, '0')}h`;
		}

		if (this._hourFormat === 120) {
			return `${hour % 12 === 0 ? 12 : hour % 12}h`;
		}

		return ITEM_HEATMAP_HOUR_LABELS_12[hour] ?? String(hour);
	}

	formatHourRange(hour) {
		if (this._hourFormat === 24) {
			const paddedHour = String(hour).padStart(2, '0');
			return `${paddedHour}:00 - ${paddedHour}:59`;
		}

		if (this._hourFormat === 120) {
			const displayHour = hour % 12 === 0 ? 12 : hour % 12;
			const paddedHour = String(displayHour).padStart(2, '0');

			return `${paddedHour}:00 - ${paddedHour}:59`;
		}

		const meridiem = hour < 12 ? 'AM' : 'PM';
		const displayHour = hour % 12 === 0 ? 12 : hour % 12;
		const paddedHour = String(displayHour).padStart(2, '0');

		return `${paddedHour}:00 ${meridiem} - ${paddedHour}:59 ${meridiem}`;
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

	wrapTextLines(ctx, text, maxWidth, maxLines = 2) {
		const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();

		if (normalizedText === '') {
			return [];
		}

		const words = normalizedText.split(' ');
		const lines = [];
		let currentLine = '';

		for (let index = 0; index < words.length; index++) {
			const word = words[index];
			const candidate = currentLine === '' ? word : `${currentLine} ${word}`;

			if (ctx.measureText(candidate).width <= maxWidth) {
				currentLine = candidate;
				continue;
			}

			if (currentLine !== '') {
				lines.push(currentLine);

				if (lines.length === maxLines) {
					return lines.map((line, lineIndex) => (
						lineIndex === lines.length - 1 ? this.truncateText(ctx, line, maxWidth) : line
					));
				}
			}

			currentLine = word;
		}

		if (currentLine !== '') {
			lines.push(currentLine);
		}

		if (lines.length <= maxLines) {
			return lines;
		}

		const truncated = lines.slice(0, maxLines);
		truncated[maxLines - 1] = this.truncateText(ctx, truncated[maxLines - 1], maxWidth);
		return truncated;
	}

	truncateText(ctx, text, maxWidth) {
		let result = String(text);

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
}






