<?php

namespace Modules\ItemHeatmapWidget\Actions;

use CControllerDashboardWidgetView;
use CControllerResponseData;

class WidgetView extends CControllerDashboardWidgetView {

    private const WEEKS_TO_LOAD = 12;

    protected function doAction(): void {
        $itemids = $this->fields_values['itemids'] ?? [];
        $aggregation = (int) ($this->fields_values['aggregation'] ?? 0);

        $weeks = [];

        if ($itemids) {
            $weeks = $this->buildWeeklyMatrices($itemids, $aggregation);
        }

        $this->setResponse(new CControllerResponseData([
            'name' => $this->fields_values['name'] ?? 'Item Heatmap',
            'itemids' => $itemids,
            'aggregation' => $aggregation,
            'weeks' => $weeks,
            'user' => [
                'debug_mode' => $this->getDebugMode()
            ]
        ]));
    }

    private function buildWeeklyMatrices(array $itemids, int $aggregation): array {
        $weeks = [];

        $now = time();

        $current_week_start = strtotime('last sunday 00:00:00', $now);
        if ((int) date('w', $now) === 0) {
            $current_week_start = strtotime('today 00:00:00', $now);
        }

        $global_time_from = $current_week_start - ((self::WEEKS_TO_LOAD - 1) * 7 * 86400);
        $global_time_till = $current_week_start + (7 * 86400) - 1;

        $history = \API::History()->get([
            'output' => ['itemid', 'clock', 'value'],
            'history' => 3,
            'itemids' => $itemids,
            'time_from' => $global_time_from,
            'time_till' => $global_time_till,
            'sortfield' => 'clock',
            'sortorder' => 'ASC',
            'limit' => 100000
        ]);

        $bucket_values = [];

        foreach ($history as $row) {
            $clock = (int) $row['clock'];
            $value = (float) $row['value'];

            $week_start = strtotime('last sunday 00:00:00', $clock);
            if ((int) date('w', $clock) === 0) {
                $week_start = strtotime('today 00:00:00', $clock);
            }

            $day = (int) date('w', $clock);
            $hour = (int) date('G', $clock);

            $bucket_values[$week_start][$day][$hour][] = $value;
        }

        for ($i = 0; $i < self::WEEKS_TO_LOAD; $i++) {
            $week_start = $current_week_start - ((self::WEEKS_TO_LOAD - 1 - $i) * 7 * 86400);
            $week_end = $week_start + (7 * 86400) - 1;

            $matrix = [];
            $max_value = 0;

            for ($day = 0; $day < 7; $day++) {
                for ($hour = 0; $hour < 24; $hour++) {
                    $values = $bucket_values[$week_start][$day][$hour] ?? [];

                    if (!$values) {
                        $matrix[$day][$hour] = 0;
                        continue;
                    }

                    switch ($aggregation) {
                        case 1:
                            $result = round(array_sum($values) / count($values), 2);
                            break;

                        case 2:
                            $result = max($values);
                            break;

                        case 3:
                            $result = count(array_filter($values, static fn($v) => $v > 0));
                            break;

                        case 0:
                        default:
                            $result = array_sum($values);
                            break;
                    }

                    $matrix[$day][$hour] = $result;

                    if ($result > $max_value) {
                        $max_value = $result;
                    }
                }
            }

            $weeks[] = [
                'start_ts' => $week_start,
                'end_ts' => $week_end,
                'label' => date('d/m', $week_start) . ' - ' . date('d/m', $week_end),
                'matrix' => $matrix,
                'max_value' => $max_value
            ];
        }

        return $weeks;
    }
}
