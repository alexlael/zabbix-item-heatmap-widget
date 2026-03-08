<?php

namespace Modules\ItemHeatmapWidget\Actions;

use CControllerDashboardWidgetView;
use CControllerResponseData;
use Modules\ItemHeatmapWidget\Includes\HeatmapDataProvider;

class WidgetView extends CControllerDashboardWidgetView {

    protected function init(): void {
        parent::init();

        $this->addValidationRules([
            'week_start_ts' => 'int32'
        ]);
    }

    protected function doAction(): void {
        $provider = new HeatmapDataProvider();
        $itemids = $this->getItemIds();
        $aggregation = $this->getAggregation();
        $hour_format = $this->getHourFormat();
        $current_week_start = $provider->getCurrentWeekStart();
        $oldest_week_start = $provider->getOldestWeekStart($current_week_start);
        $requested_week_start = $this->getRequestedWeekStart($provider, $current_week_start, $oldest_week_start);
        $week = $provider->buildWeeklyMatrix($itemids, $aggregation, $requested_week_start);
        $widget_name = $this->getWidgetName();
        $display_title = $this->getDisplayTitle($widget_name);
        $legend_text = $this->getLegendText();

        $this->setResponse(new CControllerResponseData([
            'name' => $widget_name,
            'itemids' => $itemids,
            'aggregation' => $aggregation,
            'hour_format' => $hour_format,
            'week' => $week,
            'current_week_start_ts' => $current_week_start,
            'oldest_week_start_ts' => $oldest_week_start,
            'primary_itemid' => $itemids[0] ?? null,
            'primary_item_url' => $this->buildPrimaryItemUrl($itemids),
            'selected_item_count' => count($itemids),
            'display_title' => $display_title,
            'show_display_title' => $this->shouldShowDisplayTitle($display_title),
            'legend_text' => $legend_text,
            'show_legend' => $this->shouldShowLegend($legend_text),
            'user' => [
                'debug_mode' => $this->getDebugMode()
            ]
        ]));
    }

    private function getItemIds(): array {
        $itemids = $this->fields_values['itemids'] ?? [];
        $normalized = [];

        foreach ($itemids as $itemid) {
            $normalized_itemid = (int) $itemid;

            if ($normalized_itemid <= 0 || in_array($normalized_itemid, $normalized, true)) {
                continue;
            }

            $normalized[] = $normalized_itemid;
        }

        return $normalized;
    }

    private function getAggregation(): int {
        return (int) ($this->fields_values['aggregation'] ?? HeatmapDataProvider::AGGREGATION_SUM);
    }

    private function getHourFormat(): int {
        $hour_format = (int) ($this->fields_values['hour_format'] ?? 12);

        if ($hour_format === 24) {
            return 24;
        }

        if ($hour_format === 120) {
            return 120;
        }

        return 12;
    }

    private function getWidgetName(): string {
        return trim((string) ($this->fields_values['name'] ?? 'Item Heatmap')) ?: 'Item Heatmap';
    }

    private function getDisplayTitle(string $widget_name): string {
        $display_title = trim((string) ($this->fields_values['display_title'] ?? ''));

        return $display_title !== '' ? $display_title : $widget_name;
    }

    private function shouldShowDisplayTitle(string $display_title): bool {
        return (int) ($this->fields_values['show_display_title'] ?? 1) === 1 && $display_title !== '';
    }

    private function getLegendText(): string {
        return trim((string) ($this->fields_values['legend_text'] ?? ''));
    }

    private function shouldShowLegend(string $legend_text): bool {
        return (int) ($this->fields_values['show_legend'] ?? 0) === 1 && $legend_text !== '';
    }

    private function getRequestedWeekStart(
        HeatmapDataProvider $provider,
        int $current_week_start,
        int $oldest_week_start
    ): int {
        $requested_week_start = (int) $this->getInput('week_start_ts', $current_week_start);
        $normalized_week_start = $provider->normalizeWeekStart($requested_week_start);

        if ($normalized_week_start < $oldest_week_start) {
            return $oldest_week_start;
        }

        if ($normalized_week_start > $current_week_start) {
            return $current_week_start;
        }

        return $normalized_week_start;
    }

    private function buildPrimaryItemUrl(array $itemids): ?string {
        if ($itemids === []) {
            return null;
        }

        return 'history.php?' . http_build_query([
            'action' => 'showgraph',
            'itemids' => [(int) $itemids[0]],
            'from' => 'now-7d',
            'to' => 'now'
        ]);
    }
}
