<?php

namespace Modules\ItemHeatmapWidget\Includes;

class HeatmapDataProvider {

    public const AGGREGATION_SUM = 0;
    public const AGGREGATION_AVERAGE = 1;
    public const AGGREGATION_MAXIMUM = 2;
    public const AGGREGATION_COUNT_NON_ZERO = 3;

    private const WEEK_SECONDS = 604800;
    private const HISTORY_LIMIT = 100000;
    private const CACHE_TTL = 180;
    private const MAX_WEEKS_BACK = 12;
    private const TREND_SWITCH_WEEKS = 4;
    private const VALUE_TYPE_FLOAT = 0;
    private const VALUE_TYPE_UINT = 3;

    public function getCurrentWeekStart(?int $now = null): int {
        $timestamp = $now ?? time();

        $week_start = strtotime('last sunday 00:00:00', $timestamp);

        if ((int) date('w', $timestamp) === 0) {
            $week_start = strtotime('today 00:00:00', $timestamp);
        }

        return (int) $week_start;
    }

    public function getOldestWeekStart(?int $current_week_start = null): int {
        $current = $current_week_start ?? $this->getCurrentWeekStart();

        return $current - ((self::MAX_WEEKS_BACK - 1) * self::WEEK_SECONDS);
    }

    public function normalizeWeekStart(int $timestamp): int {
        return $this->getCurrentWeekStart($timestamp);
    }

    public function buildWeeklyMatrix(array $itemids, int $aggregation, int $week_start): array {
        $normalized_itemids = $this->normalizeItemIds($itemids);
        $normalized_week_start = $this->normalizeWeekStart($week_start);
        $cache_key = $this->getCacheKey($normalized_itemids, $aggregation, $normalized_week_start);

        $cached_week = $this->readCache($cache_key);

        if ($cached_week !== null) {
            return $cached_week;
        }

        $week_end = $normalized_week_start + self::WEEK_SECONDS - 1;
        $itemids_by_type = $this->getItemIdsByValueType($normalized_itemids);
        $preferred_source = $this->shouldUseTrends($normalized_week_start, $aggregation) ? 'trends' : 'history';
        [$bucketed_data, $resolved_source] = $this->getBucketedData(
            $itemids_by_type,
            $normalized_week_start,
            $week_end,
            $aggregation,
            $preferred_source
        );

        $matrix = [];
        $max_value = 0.0;

        for ($day = 0; $day < 7; $day++) {
            for ($hour = 0; $hour < 24; $hour++) {
                $stats = $bucketed_data[$day][$hour] ?? $this->createEmptyBucket();
                $result = $this->aggregateBucket($stats, $aggregation);

                $matrix[$day][$hour] = $result;

                if ($result > $max_value) {
                    $max_value = (float) $result;
                }
            }
        }

        $week = [
            'start_ts' => $normalized_week_start,
            'end_ts' => $week_end,
            'label' => date('d/m', $normalized_week_start) . ' - ' . date('d/m', $week_end),
            'matrix' => $matrix,
            'max_value' => $this->normalizeNumber($max_value),
            'source' => $resolved_source
        ];

        $this->writeCache($cache_key, $week);

        return $week;
    }

    private function getBucketedData(
        array $itemids_by_type,
        int $time_from,
        int $time_till,
        int $aggregation,
        string $preferred_source
    ): array {
        if ($preferred_source === 'trends') {
            $trend_rows = $this->loadFromTrends($this->flattenItemIds($itemids_by_type), $time_from, $time_till);

            if ($trend_rows !== []) {
                return [$this->bucketTrendRows($trend_rows), 'trends'];
            }
        }

        $history_rows = $this->loadFromHistory($itemids_by_type, $time_from, $time_till);

        return [$this->bucketHistoryRows($history_rows), 'history'];
    }

    private function loadFromHistory(array $itemids_by_type, int $time_from, int $time_till): array {
        $rows = [];

        foreach ([self::VALUE_TYPE_FLOAT, self::VALUE_TYPE_UINT] as $value_type) {
            $typed_itemids = $itemids_by_type[$value_type] ?? [];

            if ($typed_itemids === []) {
                continue;
            }

            $rows = array_merge($rows, \API::History()->get([
                'output' => ['itemid', 'clock', 'value'],
                'history' => $value_type,
                'itemids' => $typed_itemids,
                'time_from' => $time_from,
                'time_till' => $time_till,
                'sortfield' => 'clock',
                'sortorder' => 'ASC',
                'limit' => self::HISTORY_LIMIT
            ]));
        }

        return $rows;
    }

    private function loadFromTrends(array $itemids, int $time_from, int $time_till): array {
        if ($itemids === []) {
            return [];
        }

        try {
            return \API::Trend()->get([
                'output' => ['itemid', 'clock', 'num', 'value_avg', 'value_max'],
                'itemids' => $itemids,
                'time_from' => $time_from,
                'time_till' => $time_till,
                'sortfield' => 'clock',
                'sortorder' => 'ASC',
                'limit' => self::HISTORY_LIMIT
            ]);
        }
        catch (\Throwable $e) {
            return [];
        }
    }

    private function bucketHistoryRows(array $rows): array {
        $bucketed = [];

        foreach ($rows as $row) {
            $clock = (int) $row['clock'];
            $day = (int) date('w', $clock);
            $hour = (int) date('G', $clock);
            $value = (float) $row['value'];

            if (!array_key_exists($day, $bucketed) || !array_key_exists($hour, $bucketed[$day] ?? [])) {
                $bucketed[$day][$hour] = $this->createEmptyBucket();
            }

            $bucketed[$day][$hour]['sum'] += $value;
            $bucketed[$day][$hour]['count']++;
            $bucketed[$day][$hour]['max'] = $bucketed[$day][$hour]['max'] === null
                ? $value
                : max($bucketed[$day][$hour]['max'], $value);

            if ($value > 0) {
                $bucketed[$day][$hour]['non_zero_count']++;
            }
        }

        return $bucketed;
    }

    private function bucketTrendRows(array $rows): array {
        $bucketed = [];

        foreach ($rows as $row) {
            $clock = (int) $row['clock'];
            $day = (int) date('w', $clock);
            $hour = (int) date('G', $clock);
            $samples = max((int) $row['num'], 0);
            $value_avg = (float) $row['value_avg'];
            $value_max = (float) $row['value_max'];

            if (!array_key_exists($day, $bucketed) || !array_key_exists($hour, $bucketed[$day] ?? [])) {
                $bucketed[$day][$hour] = $this->createEmptyBucket();
            }

            $bucketed[$day][$hour]['sum'] += $value_avg * $samples;
            $bucketed[$day][$hour]['count'] += $samples;
            $bucketed[$day][$hour]['max'] = $bucketed[$day][$hour]['max'] === null
                ? $value_max
                : max($bucketed[$day][$hour]['max'], $value_max);
        }

        return $bucketed;
    }

    private function aggregateBucket(array $stats, int $aggregation) {
        if ($stats['count'] === 0) {
            return 0;
        }

        switch ($aggregation) {
            case self::AGGREGATION_AVERAGE:
                return $this->normalizeNumber($stats['sum'] / $stats['count']);

            case self::AGGREGATION_MAXIMUM:
                return $this->normalizeNumber($stats['max'] ?? 0);

            case self::AGGREGATION_COUNT_NON_ZERO:
                return (int) $stats['non_zero_count'];

            case self::AGGREGATION_SUM:
            default:
                return $this->normalizeNumber($stats['sum']);
        }
    }

    private function createEmptyBucket(): array {
        return [
            'sum' => 0.0,
            'count' => 0,
            'max' => null,
            'non_zero_count' => 0
        ];
    }

    private function shouldUseTrends(int $week_start, int $aggregation): bool {
        if ($aggregation === self::AGGREGATION_COUNT_NON_ZERO) {
            return false;
        }

        $trend_threshold = $this->getCurrentWeekStart() - (self::TREND_SWITCH_WEEKS * self::WEEK_SECONDS);

        return $week_start < $trend_threshold;
    }

    private function getItemIdsByValueType(array $itemids): array {
        if ($itemids === []) {
            return [
                self::VALUE_TYPE_FLOAT => [],
                self::VALUE_TYPE_UINT => []
            ];
        }

        $items = \API::Item()->get([
            'output' => ['itemid', 'value_type'],
            'itemids' => $itemids,
            'preservekeys' => true
        ]);

        $itemids_by_type = [
            self::VALUE_TYPE_FLOAT => [],
            self::VALUE_TYPE_UINT => []
        ];

        foreach ($items as $item) {
            $value_type = (int) $item['value_type'];

            if (!array_key_exists($value_type, $itemids_by_type)) {
                continue;
            }

            $itemids_by_type[$value_type][] = (int) $item['itemid'];
        }

        return $itemids_by_type;
    }

    private function flattenItemIds(array $itemids_by_type): array {
        $flattened = [];

        foreach ($itemids_by_type as $typed_itemids) {
            foreach ($typed_itemids as $itemid) {
                $flattened[] = (int) $itemid;
            }
        }

        return $flattened;
    }

    private function normalizeItemIds(array $itemids): array {
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

    public function getCacheKey(array $itemids, int $aggregation, int $week_start): string {
        $key_data = [
            'itemids' => $this->normalizeItemIds($itemids),
            'aggregation' => $aggregation,
            'week_start_ts' => $week_start
        ];

        return sha1(json_encode($key_data));
    }

    public function readCache(string $cache_key): ?array {
        $cache_file = $this->getCacheFilePath($cache_key);

        if (!is_file($cache_file)) {
            return null;
        }

        if ((time() - filemtime($cache_file)) > self::CACHE_TTL) {
            @unlink($cache_file);
            return null;
        }

        $payload = @file_get_contents($cache_file);

        if ($payload === false) {
            return null;
        }

        $data = json_decode($payload, true);

        return is_array($data) ? $data : null;
    }

    public function writeCache(string $cache_key, array $data): void {
        $cache_dir = $this->getCacheDirectory();

        if (!is_dir($cache_dir) && !@mkdir($cache_dir, 0775, true) && !is_dir($cache_dir)) {
            return;
        }

        $encoded = json_encode($data);

        if ($encoded === false) {
            return;
        }

        @file_put_contents($this->getCacheFilePath($cache_key), $encoded, LOCK_EX);
    }

    private function getCacheDirectory(): string {
        return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'zabbix-item-heatmap-widget-cache';
    }

    private function getCacheFilePath(string $cache_key): string {
        return $this->getCacheDirectory() . DIRECTORY_SEPARATOR . $cache_key . '.json';
    }

    private function normalizeNumber(float $value) {
        if (abs($value - round($value)) < 0.00001) {
            return (int) round($value);
        }

        return round($value, 2);
    }
}
