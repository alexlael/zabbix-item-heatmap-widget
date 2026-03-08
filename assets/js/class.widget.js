const ITEM_HEATMAP_WEEK_SECONDS = 7 * 24 * 60 * 60;
const ITEM_HEATMAP_HOUR_SECONDS = 60 * 60;
const ITEM_HEATMAP_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ITEM_HEATMAP_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ITEM_HEATMAP_HOUR_LABELS = [
	'12 am', '1 am', '2 am', '3 am', '4 am', '5 am',
	'6 am', '7 am', '8 am', '9 am', '10 am', '11 am',
	'12 pm', '1 pm', '2 pm', '3 pm', '4 pm', '5 pm',
	'6 pm', '7 pm', '8 pm', '9 pm', '10 pm', '11 pm'
];

function itemHeatmapClamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
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

		const width = Math.max(parent.clientWidth - 16, 320);
		const height = Math.max(parent.clientHeight - 16, 240);
		const dpr = window.devicePixelRatio || 1;

		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);
		ctx.textBaseline = 'middle';

		const compact = width < 620;
		const matrix = Array.isArray(week.matrix) ? week.matrix : [];
		const maxValue = Number(week.max_value || 0);
		const weekStartTs = Number(week.start_ts || 0);
		const hasPrev = weekStartTs > this._oldestWeekStartTs;
		const hasNext = weekStartTs < this._currentWeekStartTs;
		const paddingTop = compact ? 58 : 66;
		const paddingLeft = compact ? 42 : 56;
		const paddingRight = 14;
		const paddingBottom = 38;
		const headerY = 24;
		const navButtonW = 34;
		const navButtonH = 28;
		const prevX = itemHeatmapClamp((width / 2) - 96, 10, width - (navButtonW * 2) - 18);
		const nextX = itemHeatmapClamp((width / 2) + 62, prevX + navButtonW + 8, width - navButtonW - 10);
		const gridWidth = Math.max(width - paddingLeft - paddingRight, 120);
		const gridHeight = Math.max(height - paddingTop - paddingBottom, 120);
		const cols = 24;
		const rows = 7;
		const cellWidth = gridWidth / cols;
		const cellHeight = gridHeight / rows;
		const hourLabelStep = width < 760 ? 2 : 1;
		const hourFontSize = width < 560 ? 9 : 11;
		const dayFontSize = compact ? 10 : 11;
		const valueFontSize = itemHeatmapClamp(Math.floor(Math.min(cellHeight * 0.45, cellWidth * 0.38)), 8, 12);

		this._navBoxes = {
			prev: { x: prevX, y: 10, w: navButtonW, h: navButtonH, enabled: hasPrev },
			next: { x: nextX, y: 10, w: navButtonW, h: navButtonH, enabled: hasNext }
		};
		this._cellBoxes = [];

		itemHeatmapDrawRoundedRect(ctx, prevX, 10, navButtonW, navButtonH, 7,
			hasPrev ? (this._hoveredNavKey === 'prev' ? '#3b3b3b' : '#313131') : '#222222',
			hasPrev ? '#53565c' : '#303030',
			1.2
		);
		itemHeatmapDrawRoundedRect(ctx, nextX, 10, navButtonW, navButtonH, 7,
			hasNext ? (this._hoveredNavKey === 'next' ? '#3b3b3b' : '#313131') : '#222222',
			hasNext ? '#53565c' : '#303030',
			1.2
		);

		ctx.fillStyle = hasPrev ? '#f1f5f9' : '#666666';
		ctx.font = 'bold 15px Arial';
		ctx.textAlign = 'center';
		ctx.fillText('\u2190', prevX + (navButtonW / 2), headerY);
		ctx.fillStyle = hasNext ? '#f1f5f9' : '#666666';
		ctx.fillText('\u2192', nextX + (navButtonW / 2), headerY);

		ctx.fillStyle = '#e5e7eb';
		ctx.font = `bold ${compact ? 13 : 14}px Arial`;
		ctx.fillText(week.label || 'Week', width / 2, headerY);

		ctx.font = `${hourFontSize}px Arial`;
		ctx.fillStyle = '#9ea7b3';
		ctx.textAlign = 'center';

		for (let hour = 0; hour < cols; hour++) {
			if (hour % hourLabelStep !== 0) {
				continue;
			}

			const x = paddingLeft + (hour * cellWidth) + (cellWidth / 2);
			ctx.fillText(ITEM_HEATMAP_HOUR_LABELS[hour], x, compact ? 46 : 49);
		}

		ctx.font = `${dayFontSize}px Arial`;
		ctx.textAlign = 'right';

		for (let day = 0; day < rows; day++) {
			const y = paddingTop + (day * cellHeight) + (cellHeight / 2);
			ctx.fillStyle = '#9ea7b3';
			ctx.fillText(ITEM_HEATMAP_DAY_LABELS[day], paddingLeft - 8, y);
		}

		ctx.textAlign = 'center';
		ctx.font = `600 ${valueFontSize}px Arial`;

		for (let day = 0; day < rows; day++) {
			for (let hour = 0; hour < cols; hour++) {
				const value = Number(matrix?.[day]?.[hour] ?? 0);
				const x = paddingLeft + (hour * cellWidth);
				const y = paddingTop + (day * cellHeight);
				const cardX = x + 2.5;
				const cardY = y + 3;
				const cardW = Math.max(cellWidth - 5, 4);
				const cardH = Math.max(cellHeight - 6, 4);
				const cellKey = this.getCellKey(day, hour);
				const isHovered = this._hoveredCellKey === cellKey;
				const isPressed = this._pressedCellKey === cellKey;
				const fill = this.getCellColor(value, maxValue);
				const stroke = isPressed ? '#ffd43b' : (isHovered ? '#f8fafc' : '#3c3f44');
				const strokeWidth = isPressed || isHovered ? 2 : 1;
				const cellStartTs = weekStartTs + (day * 86400) + (hour * ITEM_HEATMAP_HOUR_SECONDS);

				itemHeatmapDrawRoundedRect(ctx, cardX, cardY, cardW, cardH, 5, fill, stroke, strokeWidth);

				if (isHovered || isPressed) {
					itemHeatmapDrawRoundedRect(
						ctx,
						cardX,
						cardY,
						cardW,
						cardH,
						5,
						isPressed ? 'rgba(255, 212, 59, 0.12)' : 'rgba(255, 255, 255, 0.08)'
					);
				}

				ctx.fillStyle = value > 0 ? '#ffffff' : '#9ea7b3';
				ctx.fillText(this.formatValue(value), x + (cellWidth / 2), y + (cellHeight / 2));

				this._cellBoxes.push({
					type: 'cell',
					day,
					hour,
					value,
					weekLabel: week.label || 'Week',
					startTs: cellStartTs,
					endTs: cellStartTs + ITEM_HEATMAP_HOUR_SECONDS - 1,
					x: cardX,
					y: cardY,
					w: cardW,
					h: cardH
				});
			}
		}

		const legendY = height - 16;
		const legendX = 40;
		const gradient = ctx.createLinearGradient(legendX, 0, legendX + 120, 0);
		gradient.addColorStop(0, '#1f6f4a');
		gradient.addColorStop(0.35, '#2f9e44');
		gradient.addColorStop(0.65, '#f08c00');
		gradient.addColorStop(0.85, '#f76707');
		gradient.addColorStop(1, '#c92a2a');

		ctx.fillStyle = '#9ea7b3';
		ctx.font = '11px Arial';
		ctx.textAlign = 'left';
		ctx.fillText('Low', 12, legendY);
		itemHeatmapDrawRoundedRect(ctx, legendX, legendY - 5, 120, 8, 4, gradient);
		ctx.fillText('High', legendX + 130, legendY);
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
			this._container.classList.toggle('is-loading', this._isLoading);
		}
	}

	getCellClickUrl(cell) {
		if (!this._primaryItemUrl || cell.value <= 0) {
			return null;
		}

		return this._primaryItemUrl;
	}

	getCellKey(day, hour) {
		return `${day}:${hour}`;
	}

	getCellColor(value, maxValue) {
		if (maxValue <= 0 || value <= 0) {
			return '#252525';
		}

		const ratio = value / maxValue;

		if (ratio < 0.2) {
			return '#1f6f4a';
		}
		if (ratio < 0.4) {
			return '#2f9e44';
		}
		if (ratio < 0.6) {
			return '#f08c00';
		}
		if (ratio < 0.8) {
			return '#f76707';
		}

		return '#c92a2a';
	}

	formatValue(value) {
		const numericValue = Number(value || 0);

		if (Number.isInteger(numericValue)) {
			return String(numericValue);
		}

		return numericValue.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
	}

	formatHourRange(hour) {
		const paddedHour = String(hour).padStart(2, '0');
		return `${paddedHour}:00 - ${paddedHour}:59`;
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
