# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog and follows semantic versioning
for project releases.

## [1.2.2] - 2026-07-20

### Fixed in 1.2.2

- Removed direct `CScriptTag` output from the widget edit view.
- Restored the expected single form response used by the Zabbix widget editor.
- Prevented the custom module from breaking edit and create dialogs for all
  dashboard widgets.

## [1.2.1] - 2026-07-20

### Changed in 1.2.1

- Removed the redundant custom display-title controls from the widget form.
- The native Zabbix widget `Name` and `Show header` controls are now the only
  title controls.
- Compact manual-threshold legend aligned with the automatic legend footprint.
- Removed the redundant `Manual scale` text from the rendered legend.

## [1.2.0] - 2026-07-16

### Added in 1.2.0

- `Color scale` configuration with `Automatic` and `Manual thresholds` modes.
- Configurable low and high threshold values for stable operational coloring.
- Manual-scale legend labels that expose the effective low and high limits.
- Separate frontend color-scale behavior loaded through `color-scale.js`.

### Changed in 1.2.0

- Widget manifest version updated from `1.1.0` to `1.2.0`.
- Manual mode now keeps values at or below the low threshold in the low color,
  graduates intermediate values, and pins values at or above the high threshold
  to the high color.
- README updated with scale behavior, configuration guidance, and an Asterisk
  error-counter example.

### Validation for 1.2.0

- Invalid manual ranges are normalized so the high threshold is always greater
  than the low threshold.
- Zero and negative values remain visually neutral.
- Automatic mode preserves the original relative-to-week-maximum behavior.

## [1.1.0] - 2026-07-16

### Added in 1.1.0

- Optional `Associated log item` field in the widget configuration.
- `Error logs` drill-down action for populated heatmap cells.
- Exact bucket time filtering when opening the associated log item's history.
- Support for workflows that use a numeric counter item for the heatmap and a
  separate log or text item for the original event details.
- Documentation for the `asterisk.errors.total` and `asterisk.errors.log`
  integration pattern.

### Changed in 1.1.0

- Widget manifest version updated from `1.0.0` to `1.1.0`.
- Project description updated to mention optional log drill-down.
- README updated with configuration, investigation flow, compatibility notes,
  and release details.

### Validation for 1.1.0

- The log drill-down is enabled only when exactly one distinct valid associated
  log item is configured.
- Existing graph, primary item history, latest data, and related problem actions
  remain available.

## [1.0.0] - 2026-03-08

### Added in 1.0.0

- Initial public project structure for the Item Heatmap widget.
- Weekly heatmap visualization for numeric item data in Zabbix.
- Support for multi-item aggregation and comparison-oriented dashboards.
- Dashboard interactions such as weekly navigation, hover context, and cell
  drill-down.
- Open source repository essentials, including README, issue templates,
  contributing guide, and security guidance.
