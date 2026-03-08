class CWidgetItemHeatmap extends CWidget {
	processUpdateResponse(response) {
		super.processUpdateResponse(response);

		const container = this._target.querySelector('.item-heatmap-widget');
		if (!container) {
			return;
		}

		const canvas = container.querySelector('.item-heatmap-widget__canvas');
		if (!canvas) {
			return;
		}

		const rawWeeks = container.dataset.weeks || '[]';

		let weeks = [];

		try {
			weeks = JSON.parse(rawWeeks);
		}
		catch (e) {
			console.error('ItemHeatmap: invalid weeks JSON', e);
			return;
		}

		if (!Array.isArray(weeks)) {
			return;
		}

		if (typeof this._weekIndex !== 'number') {
			this._weekIndex = Math.max(weeks.length - 1, 0);
		}

		if (this._weekIndex > weeks.length - 1) {
			this._weekIndex = Math.max(weeks.length - 1, 0);
		}

		this._weeks = weeks;
		this._canvas = canvas;
		this._container = container;

		this.bindCanvasEvents();
		this.drawCurrentWeek();
	}

	bindCanvasEvents() {
		if (!this._canvas || this._eventsBound) {
			return;
		}

		this._canvas.addEventListener('click', (e) => {
			const hit = this.getClickTarget(e);
			if (!hit) {
				return;
			}

			if (hit === 'prev' && this._weekIndex > 0) {
				this._weekIndex--;
				this.drawCurrentWeek();
			}
			else if (hit === 'next' && this._weekIndex < this._weeks.length - 1) {
				this._weekIndex++;
				this.drawCurrentWeek();
			}
		});

		this._eventsBound = true;
	}

	getClickTarget(event) {
		if (!this._canvas || !this._navBoxes) {
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
				return key;
			}
		}

		return null;
	}

	drawCurrentWeek() {
		if (!this._weeks || !this._weeks.length || !this._canvas) {
			return;
		}

		const week = this._weeks[this._weekIndex];
		this.drawHeatmap(this._canvas, week, this._weekIndex, this._weeks.length);
	}

	drawHeatmap(canvas, week, weekIndex, totalWeeks) {
		const ctx = canvas.getContext('2d');
		const parent = canvas.parentElement;

		const width = Math.max(parent.clientWidth - 8, 700);
		const height = Math.max(parent.clientHeight - 8, 280);

		canvas.width = width;
		canvas.height = height;

		ctx.clearRect(0, 0, width, height);

		const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		const hours = [
			'12 am','1 am','2 am','3 am','4 am','5 am',
			'6 am','7 am','8 am','9 am','10 am','11 am',
			'12 pm','1 pm','2 pm','3 pm','4 pm','5 pm',
			'6 pm','7 pm','8 pm','9 pm','10 pm','11 pm'
		];

		const matrix = week.matrix || [];
		const maxValue = Number(week.max_value || 0);

		const paddingTop = 64;
		const paddingLeft = 54;
		const paddingRight = 14;
		const paddingBottom = 36;

		const headerY = 24;
		const navButtonW = 34;
		const navButtonH = 28;

		const prevX = width / 2 - 96;
		const nextX = width / 2 + 62;

		this._navBoxes = {
			prev: { x: prevX, y: 10, w: navButtonW, h: navButtonH },
			next: { x: nextX, y: 10, w: navButtonW, h: navButtonH }
		};

		const gridWidth = width - paddingLeft - paddingRight;
		const gridHeight = height - paddingTop - paddingBottom;

		const cols = 24;
		const rows = 7;

		const cellWidth = gridWidth / cols;
		const cellHeight = gridHeight / rows;

		const getColor = (value) => {
			if (maxValue <= 0 || value <= 0) return '#252525';

			const ratio = value / maxValue;

			if (ratio < 0.2) return '#1f6f4a';
			if (ratio < 0.4) return '#2f9e44';
			if (ratio < 0.6) return '#f08c00';
			if (ratio < 0.8) return '#f76707';
			return '#c92a2a';
		};

		const drawRoundedRect = (x, y, w, h, r, fillStyle, strokeStyle = null, lineWidth = 1) => {
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

			ctx.fillStyle = fillStyle;
			ctx.fill();

			if (strokeStyle) {
				ctx.lineWidth = lineWidth;
				ctx.strokeStyle = strokeStyle;
				ctx.stroke();
			}
		};

		ctx.textBaseline = 'middle';

		drawRoundedRect(
			this._navBoxes.prev.x,
			this._navBoxes.prev.y,
			this._navBoxes.prev.w,
			this._navBoxes.prev.h,
			7,
			weekIndex > 0 ? '#313131' : '#222222',
			weekIndex > 0 ? '#4a4a4a' : '#303030'
		);
		drawRoundedRect(
			this._navBoxes.next.x,
			this._navBoxes.next.y,
			this._navBoxes.next.w,
			this._navBoxes.next.h,
			7,
			weekIndex < totalWeeks - 1 ? '#313131' : '#222222',
			weekIndex < totalWeeks - 1 ? '#4a4a4a' : '#303030'
		);

		ctx.fillStyle = weekIndex > 0 ? '#f1f5f9' : '#666';
		ctx.font = 'bold 15px Arial';
		ctx.textAlign = 'center';
		ctx.fillText('←', this._navBoxes.prev.x + navButtonW / 2, headerY);

		ctx.fillStyle = weekIndex < totalWeeks - 1 ? '#f1f5f9' : '#666';
		ctx.fillText('→', this._navBoxes.next.x + navButtonW / 2, headerY);

		ctx.fillStyle = '#e5e7eb';
		ctx.font = 'bold 14px Arial';
		ctx.fillText(week.label || 'Week', width / 2, headerY);

		ctx.font = '11px Arial';
		ctx.fillStyle = '#9ea7b3';

		for (let h = 0; h < cols; h++) {
			const x = paddingLeft + (h * cellWidth) + (cellWidth / 2);
			ctx.fillText(hours[h], x, 48);
		}

		ctx.textAlign = 'right';
		for (let d = 0; d < rows; d++) {
			const y = paddingTop + (d * cellHeight) + (cellHeight / 2);
			ctx.fillStyle = '#9ea7b3';
			ctx.fillText(days[d], paddingLeft - 8, y);
		}

		ctx.textAlign = 'center';
		ctx.font = 'bold 11px Arial';

		for (let d = 0; d < rows; d++) {
			for (let h = 0; h < cols; h++) {
				const value = Number(matrix?.[d]?.[h] ?? 0);

				const x = paddingLeft + (h * cellWidth);
				const y = paddingTop + (d * cellHeight);

				const cardX = x + 2.5;
				const cardY = y + 3;
				const cardW = cellWidth - 5;
				const cardH = cellHeight - 6;

				drawRoundedRect(
					cardX,
					cardY,
					cardW,
					cardH,
					5,
					getColor(value),
					'#3c3f44'
				);

				ctx.fillStyle = '#ffffff';
				ctx.fillText(String(value), x + (cellWidth / 2), y + (cellHeight / 2));
			}
		}

		const legendY = height - 14;
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

		drawRoundedRect(legendX, legendY - 5, 120, 8, 4, gradient);

		ctx.fillText('High', legendX + 130, legendY);
	}
}
