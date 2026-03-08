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
        $current_week_start = $provider->getCurrentWeekStart();
        $oldest_week_start = $provider->getOldestWeekStart($current_week_start);
        $requested_week_start = $this->getRequestedWeekStart($provider, $current_week_start, $oldest_week_start);
        $week = $provider->buildWeeklyMatrix($itemids, $aggregation, $requested_week_start);

        $this->setResponse(new CControllerResponseData([
            'name' => $this->fields_values['name'] ?? 'Item Heatmap',
            'itemids' => $itemids,
            'aggregation' => $aggregation,
            'week' => $week,
            'current_week_start_ts' => $current_week_start,
            'oldest_week_start_ts' => $oldest_week_start,
            'primary_itemid' => $itemids[0] ?? null,
            'primary_item_url' => $this->buildPrimaryItemUrl($itemids),
            'selected_item_count' => count($itemids),
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
