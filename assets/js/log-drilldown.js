(() => {
	if (typeof CWidgetItemHeatmap === 'undefined') {
		return;
	}

	const originalEnsureState = CWidgetItemHeatmap.prototype.ensureState;
	const originalProcessUpdateResponse = CWidgetItemHeatmap.prototype.processUpdateResponse;
	const originalGetContextMenuLinks = CWidgetItemHeatmap.prototype.getContextMenuLinks;

	CWidgetItemHeatmap.prototype.ensureState = function() {
		originalEnsureState.call(this);

		if (typeof this._associatedLogItemId === 'undefined') {
			this._associatedLogItemId = 0;
		}
	};

	CWidgetItemHeatmap.prototype.processUpdateResponse = function(response) {
		originalProcessUpdateResponse.call(this, response);
		this._associatedLogItemId = Number(this._container?.dataset.associatedLogItemid || 0);
	};

	CWidgetItemHeatmap.prototype.getContextMenuLinks = function(cell) {
		const links = originalGetContextMenuLinks.call(this, cell);
		const logItemId = Number(this._associatedLogItemId || 0);

		if (logItemId <= 0) {
			return links;
		}

		const from = this.formatAbsoluteDateTime(cell.startTs);
		const to = this.formatAbsoluteDateTime(cell.endTs);
		const logLink = {
			label: 'Error logs',
			url: this.buildValuesUrl(logItemId, from, to)
		};
		const valuesLinkIndex = links.findIndex((link) => (
			link.label === 'Primary item values' || link.label === 'History values'
		));

		if (valuesLinkIndex >= 0) {
			links.splice(valuesLinkIndex, 0, logLink);
		}
		else {
			links.unshift(logLink);
		}

		return links;
	};
})();
