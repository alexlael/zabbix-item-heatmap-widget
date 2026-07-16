(() => {
	const COLOR_SCALE_AUTOMATIC = 0;
	const COLOR_SCALE_MANUAL = 1;
	const originalEnsureState = CWidgetItemHeatmap.prototype.ensureState;
	const originalProcessUpdateResponse = CWidgetItemHeatmap.prototype.processUpdateResponse;
	const originalGetCellColor = CWidgetItemHeatmap.prototype.getCellColor;
	const originalDrawLegend = CWidgetItemHeatmap.prototype.drawLegend;

	CWidgetItemHeatmap.prototype.ensureState = function() {
		originalEnsureState.call(this);

		if (this._colorScaleStateInitialized) {
			return;
		}

		this._colorScaleStateInitialized = true;
		this._colorScaleMode = COLOR_SCALE_AUTOMATIC;
		this._colorScaleLow = 3;
		this._colorScaleHigh = 10;
	};

	CWidgetItemHeatmap.prototype.processUpdateResponse = function(response) {
		originalProcessUpdateResponse.call(this, response);

		if (!this._container) {
			return;
		}

		this._colorScaleMode = Number(this._container.dataset.colorScaleMode || 0) === COLOR_SCALE_MANUAL
			? COLOR_SCALE_MANUAL
			: COLOR_SCALE_AUTOMATIC;
		this._colorScaleLow = Math.max(0, Number(this._container.dataset.colorScaleLow || 3));
		this._colorScaleHigh = Math.max(0, Number(this._container.dataset.colorScaleHigh || 10));

		if (!Number.isFinite(this._colorScaleLow)) {
			this._colorScaleLow = 3;
		}
		if (!Number.isFinite(this._colorScaleHigh) || this._colorScaleHigh <= this._colorScaleLow) {
			this._colorScaleHigh = this._colorScaleLow + 1;
		}

		this.drawCurrentWeek();
	};

	CWidgetItemHeatmap.prototype.getCellColor = function(value, maxValue, palette) {
		if (this._colorScaleMode !== COLOR_SCALE_MANUAL) {
			return originalGetCellColor.call(this, value, maxValue, palette);
		}

		const numericValue = Number(value || 0);

		if (numericValue <= 0) {
			return palette.zeroCell;
		}
		if (numericValue <= this._colorScaleLow) {
			return palette.scale[0];
		}
		if (numericValue >= this._colorScaleHigh) {
			return palette.scale[4];
		}

		const ratio = (numericValue - this._colorScaleLow) / (this._colorScaleHigh - this._colorScaleLow);

		if (ratio < 0.25) {
			return palette.scale[1];
		}
		if (ratio < 0.5) {
			return palette.scale[2];
		}
		if (ratio < 0.75) {
			return palette.scale[3];
		}

		return palette.scale[4];
	};

	CWidgetItemHeatmap.prototype.drawLegend = function(ctx, metrics, columnLayout, legendY, palette) {
		if (this._colorScaleMode !== COLOR_SCALE_MANUAL) {
			originalDrawLegend.call(this, ctx, metrics, columnLayout, legendY, palette);
			return;
		}

		const canvasWidth = ctx.canvas.width / (window.devicePixelRatio || 1);
		const legendX = metrics.outerPaddingX;
		const availableWidth = canvasWidth - (metrics.outerPaddingX * 2);
		const gradientX = legendX + 52;
		const gradientWidth = itemHeatmapClamp(availableWidth * 0.18, 110, 170);
		const gradient = ctx.createLinearGradient(gradientX, 0, gradientX + gradientWidth, 0);
		gradient.addColorStop(0, palette.scale[0]);
		gradient.addColorStop(0.25, palette.scale[1]);
		gradient.addColorStop(0.5, palette.scale[2]);
		gradient.addColorStop(0.75, palette.scale[3]);
		gradient.addColorStop(1, palette.scale[4]);

		ctx.textBaseline = 'middle';
		ctx.font = itemHeatmapFont(10, 700);
		ctx.textAlign = 'left';
		ctx.fillStyle = palette.legendText;
		ctx.fillText(`Low <= ${this.formatValue(this._colorScaleLow)}`, legendX, legendY);
		itemHeatmapDrawRoundedRect(ctx, gradientX, legendY - 4, gradientWidth, 8, 4, gradient);
		ctx.fillText(`High >= ${this.formatValue(this._colorScaleHigh)}`, gradientX + gradientWidth + 10, legendY);

		ctx.textAlign = 'right';
		ctx.font = itemHeatmapFont(9, 600);
		ctx.fillStyle = palette.textMuted;
		ctx.fillText('Manual scale', canvasWidth - metrics.outerPaddingX, legendY);
	};
})();
