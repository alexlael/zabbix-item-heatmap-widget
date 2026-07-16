# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog and follows semantic versioning
for project releases.

## [1.1.0] - 2026-07-16

### Added

- Optional `Associated log item` field in the widget configuration.
- `Error logs` drill-down action for populated heatmap cells.
- Exact bucket time filtering when opening the associated log item's history.
- Support for workflows that use a numeric counter item for the heatmap and a
  separate log or text item for the original event details.
- Documentation for the `asterisk.errors.total` and `asterisk.errors.log`
  integration pattern.

### Changed

- Widget manifest version updated from `1.0.0` to `1.1.0`.
- Project description updated to mention optional log drill-down.
- README updated with configuration, investigation flow, compatibility notes,
  and release details.

### Validation

- The log drill-down is enabled only when exactly one distinct valid associated
  log item is configured.
- Existing graph, primary item history, latest data, and related problem actions
  remain available.

## [1.0.0] - 2026-03-08

### Added

- Initial public project structure for the Item Heatmap widget.
- Weekly heatmap visualization for numeric item data in Zabbix.
- Support for multi-item aggregation and comparison-oriented dashboards.
- Dashboard interactions such as weekly navigation, hover context, and cell
  drill-down.
- Open source repository essentials, including README, issue templates,
  contributing guide, and security guidance.
