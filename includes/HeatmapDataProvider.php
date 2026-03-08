<?php

namespace Modules\ItemHeatmapWidget\Includes;

class HeatmapDataProvider {

    public const AGGREGATION_SUM = 0;
    public const AGGREGATION_AVERAGE = 1;
    public const AGGREGATION_MAXIMUM = 2;
    public const AGGREGATION_COUNT_NON_ZERO = 3;

    public const DISPLAY_MODE_CONSOLIDATED = 0;
    public const DISPLAY_MODE_COMPARE = 1;

    public const SLOT_30_MINUTES = 1800;
    public const SLOT_1_HOUR = 3600;
    public const SLOT_2_HOURS = 7200;
    public const SLOT_4_HOURS = 14400;
    public const SLOT_6_HOURS = 21600;
    public const SLOT_12_HOURS = 43200;

    public const PERIOD_4_WEEKS = 4;
    public const PERIOD_8_WEEKS = 8;
    public const PERIOD_12_WEEKS = 12;
    public const PERIOD_24_WEEKS = 24;
    public const PERIOD_52_WEEKS = 52;

    private const WEEK_SECONDS = 604800;
    private const DAY_SECONDS = 86400;
    private const HISTORY_LIMIT = 100000;
    private const PROBLEM_LIMIT = 500;
    private const CACHE_TTL = 180;
    private const DEFAULT_PERIOD_WEEKS = self::PERIOD_12_WEEKS;
    private const DEFAULT_SLOT_SECONDS = self::SLOT_1_HOUR;
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

    public function getOldestWeekStart(?int $current_week_start = null, int $period_weeks = self::DEFAULT_PERIOD_WEEKS): int {
        $current = $current_week_start ?? $this->getCurrentWeekStart();
        $normalized_period_weeks = $this->normalizePeriodWeeks($period_weeks);

        return $current - (($normalized_period_weeks - 1) * self::WEEK_SECONDS);
    }

    public function normalizeWeekStart(int $timestamp): int {
        return $this->getCurrentWeekStart($timestamp);
    }

    public function normalizeSlotSeconds(int $slot_seconds): int {
        if (in_array($slot_seconds, $this->getSupportedSlotSeconds(), true)) {
            return $slot_seconds;
        }

        return self::DEFAULT_SLOT_SECONDS;
    }

    public function normalizePeriodWeeks(int $period_weeks): int {
        if (in_array($period_weeks, $this->getSupportedPeriodWeeks(), true)) {
            return $period_weeks;
        }

        return self::DEFAULT_PERIOD_WEEKS;
    }

    public function normalizeDisplayMode(int $display_mode): int {
        return $display_mode === self::DISPLAY_MODE_COMPARE
            ? self::DISPLAY_MODE_COMPARE
            : self::DISPLAY_MODE_CONSOLIDATED;
    }

    public function buildWeeklyMatrix(
        array $itemids,
        int $aggregation,
        int $week_start,
        int $slot_seconds = self::DEFAULT_SLOT_SECONDS
    ): array {
        $normalized_itemids = $this->normalizeItemIds($itemids);
        $normalized_week_start = $this->normalizeWeekStart($week_start);
        $normalized_slot_seconds = $this->normalizeSlotSeconds($slot_seconds);
        $cache_key = $this->getCacheKey($normalized_itemids, $aggregation, $normalized_week_start, $normalized_slot_seconds);

        $cached_week = $this->readCache($cache_key);

        if ($cached_week !== null) {
            return $cached_week;
        }

        $week_end = $normalized_week_start + self::WEEK_SECONDS - 1;
        $item_metadata = $this->getItemMetadata($normalized_itemids);
        $itemids_by_type = $this->groupItemIdsByValueType($item_metadata);
        $preferred_source = $this->shouldUseTrends($normalized_week_start, $aggregation, $normalized_slot_seconds)
            ? 'trends'
            : 'history';
        [$bucketed_data, $resolved_source] = $this->getBucketedData(
            $itemids_by_type,
            $normalized_week_start,
            $week_end,
            $aggregation,
            $preferred_source,
            $normalized_slot_seconds
        );
        $problem_buckets = $this->buildProblemBuckets(
            $this->extractHostIds($item_metadata),
            $normalized_week_start,
            $week_end,
            $normalized_slot_seconds
        );

        $week = $this->buildWeekPayload(
            $normalized_week_start,
            $week_end,
            $normalized_slot_seconds,
            $aggregation,
            $resolved_source,
            $item_metadata,
            $bucketed_data,
            $problem_buckets
        );

        $this->writeCache($cache_key, $week);

        return $week;
    }

    public function getCacheKey(array $itemids, int $aggregation, int $week_start, int $slot_seconds = self::DEFAULT_SLOT_SECONDS): string {
        $key_data = [
            'itemids' => $this->normalizeItemIds($itemids),
            'aggregation' => $aggregation,
            'week_start_ts' => $week_start,
            'slot_seconds' => $this->normalizeSlotSeconds($slot_seconds)
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

    public function getSupportedSlotSeconds(): array {
        return [
            self::SLOT_30_MINUTES,
            self::SLOT_1_HOUR,
            self::SLOT_2_HOURS,
            self::SLOT_4_HOURS,
            self::SLOT_6_HOURS,
            self::SLOT_12_HOURS
        ];
    }

    public function getSupportedPeriodWeeks(): array {
        return [
            self::PERIOD_4_WEEKS,
            self::PERIOD_8_WEEKS,
            self::PERIOD_12_WEEKS,
            self::PERIOD_24_WEEKS,
            self::PERIOD_52_WEEKS
        ];
    }

    private function buildWeekPayload(
        int $week_start,
        int $week_end,
        int $slot_seconds,
        int $aggregation,
        string $source,
        array $item_metadata,
        array $bucketed_data,
        array $problem_buckets
    ): array {
        $slot_count = $this->getSlotCount($slot_seconds);
        $matrix = [];
        $bucket_details = [];
        $comparison_panels = [];
        $max_value = 0.0;
        $comparison_max_value = 0.0;

        foreach ($item_metadata as $itemid => $metadata) {
            $comparison_panels[$itemid] = [
                'itemid' => $itemid,
                'name' => $metadata['name'],
                'hostid' => $metadata['hostid'],
                'host_name' => $metadata['host_name'],
                'label' => $metadata['name'],
                'full_label' => $metadata['full_label'],
                'units' => $metadata['units'],
                'latest_value' => $metadata['latest_value'],
                'latest_clock' => $metadata['latest_clock'],
                'matrix' => [],
                'max_value' => 0
            ];
        }

        for ($day = 0; $day < 7; $day++) {
            for ($slot = 0; $slot < $slot_count; $slot++) {
                $bucket = $bucketed_data[$day][$slot] ?? $this->createEmptyBucketEnvelope();
                $combined_value = $this->aggregateBucket($bucket['combined'], $aggregation);
                $problem_info = $problem_buckets[$day][$slot] ?? ['count' => 0, 'names' => []];
                $item_breakdown = [];

                $matrix[$day][$slot] = $combined_value;
                $bucket_details[$day][$slot] = [
                    'value' => $combined_value,
                    'problem_count' => (int) $problem_info['count'],
                    'problem_names' => $problem_info['names'],
                    'items' => []
                ];

                if ($combined_value > $max_value) {
                    $max_value = (float) $combined_value;
                }

                foreach ($item_metadata as $itemid => $metadata) {
                    $item_bucket = $bucket['items'][$itemid] ?? $this->createEmptyBucket();
                    $item_value = $this->aggregateBucket($item_bucket, $aggregation);

                    $comparison_panels[$itemid]['matrix'][$day][$slot] = $item_value;

                    if ($item_value > $comparison_panels[$itemid]['max_value']) {
                        $comparison_panels[$itemid]['max_value'] = (float) $item_value;
                    }

                    if ($item_value > $comparison_max_value) {
                        $comparison_max_value = (float) $item_value;
                    }

                    $item_breakdown[] = [
                        'itemid' => $itemid,
                        'name' => $metadata['name'],
                        'hostid' => $metadata['hostid'],
                        'host_name' => $metadata['host_name'],
                        'label' => $metadata['name'],
                        'full_label' => $metadata['full_label'],
                        'units' => $metadata['units'],
                        'value' => $item_value,
                        'sample_count' => (int) $item_bucket['count'],
                        'non_zero_count' => (int) $item_bucket['non_zero_count'],
                        'latest_value' => $metadata['latest_value'],
                        'latest_clock' => $metadata['latest_clock']
                    ];
                }

                $bucket_details[$day][$slot]['items'] = $item_breakdown;
            }
        }

        $comparison = [];

        foreach ($item_metadata as $itemid => $metadata) {
            $panel = $comparison_panels[$itemid];
            $panel['max_value'] = $this->normalizeNumber((float) $panel['max_value']);
            $comparison[] = $panel;
        }

        return [
            'start_ts' => $week_start,
            'end_ts' => $week_end,
            'label' => date('d/m', $week_start) . ' - ' . date('d/m', $week_end),
            'slot_seconds' => $slot_seconds,
            'slot_count' => $slot_count,
            'aggregation' => $aggregation,
            'matrix' => $matrix,
            'bucket_details' => $bucket_details,
            'items' => array_values($item_metadata),
            'comparison' => $comparison,
            'max_value' => $this->normalizeNumber($max_value),
            'comparison_max_value' => $this->normalizeNumber($comparison_max_value),
            'source' => $source,
            'hostids' => $this->extractHostIds($item_metadata)
        ];
    }

    private function getBucketedData(
        array $itemids_by_type,
        int $time_from,
        int $time_till,
        int $aggregation,
        string $preferred_source,
        int $slot_seconds
    ): array {
        if ($preferred_source === 'trends') {
            $trend_rows = $this->loadFromTrends($this->flattenItemIds($itemids_by_type), $time_from, $time_till);

            if ($trend_rows !== []) {
                return [$this->bucketTrendRows($trend_rows, $slot_seconds), 'trends'];
            }
        }

        $history_rows = $this->loadFromHistory($itemids_by_type, $time_from, $time_till);

        return [$this->bucketHistoryRows($history_rows, $slot_seconds), 'history'];
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

    private function bucketHistoryRows(array $rows, int $slot_seconds): array {
        $bucketed = [];

        foreach ($rows as $row) {
            $clock = (int) $row['clock'];
            $itemid = (int) $row['itemid'];
            $day = (int) date('w', $clock);
            $slot = $this->getSlotIndex($clock, $slot_seconds);
            $value = (float) $row['value'];

            $this->ensureBucket($bucketed, $day, $slot, $itemid);
            $this->updateBucketStats($bucketed[$day][$slot]['combined'], $value);
            $this->updateBucketStats($bucketed[$day][$slot]['items'][$itemid], $value);
        }

        return $bucketed;
    }

    private function bucketTrendRows(array $rows, int $slot_seconds): array {
        $bucketed = [];

        foreach ($rows as $row) {
            $clock = (int) $row['clock'];
            $itemid = (int) $row['itemid'];
            $day = (int) date('w', $clock);
            $slot = $this->getSlotIndex($clock, $slot_seconds);
            $samples = max((int) $row['num'], 0);
            $value_avg = (float) $row['value_avg'];
            $value_max = (float) $row['value_max'];

            $this->ensureBucket($bucketed, $day, $slot, $itemid);
            $this->updateTrendBucketStats($bucketed[$day][$slot]['combined'], $value_avg, $value_max, $samples);
            $this->updateTrendBucketStats($bucketed[$day][$slot]['items'][$itemid], $value_avg, $value_max, $samples);
        }

        return $bucketed;
    }

    private function updateBucketStats(array &$bucket, float $value): void {
        $bucket['sum'] += $value;
        $bucket['count']++;
        $bucket['max'] = $bucket['max'] === null ? $value : max($bucket['max'], $value);

        if ($value > 0) {
            $bucket['non_zero_count']++;
        }
    }

    private function updateTrendBucketStats(array &$bucket, float $value_avg, float $value_max, int $samples): void {
        $bucket['sum'] += $value_avg * $samples;
        $bucket['count'] += $samples;
        $bucket['max'] = $bucket['max'] === null ? $value_max : max($bucket['max'], $value_max);

        if ($value_max > 0 && $samples > 0) {
            $bucket['non_zero_count'] += $samples;
        }
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

    private function getItemMetadata(array $itemids): array {
        if ($itemids === []) {
            return [];
        }

        $items = \API::Item()->get([
            'output' => ['itemid', 'name', 'value_type', 'hostid', 'units', 'lastvalue', 'lastclock'],
            'selectHosts' => ['hostid', 'name', 'host'],
            'itemids' => $itemids,
            'preservekeys' => true
        ]);

        $metadata = [];

        foreach ($itemids as $itemid) {
            if (!array_key_exists($itemid, $items)) {
                continue;
            }

            $item = $items[$itemid];
            $value_type = (int) $item['value_type'];

            if (!in_array($value_type, [self::VALUE_TYPE_FLOAT, self::VALUE_TYPE_UINT], true)) {
                continue;
            }

            $host = $item['hosts'][0] ?? [];
            $host_name = (string) ($host['name'] ?? $host['host'] ?? '');
            $item_name = (string) ($item['name'] ?? ('Item ' . $itemid));

            $metadata[$itemid] = [
                'itemid' => $itemid,
                'name' => $item_name,
                'hostid' => (int) ($item['hostid'] ?? 0),
                'host_name' => $host_name,
                'full_label' => $host_name !== '' ? $host_name . ': ' . $item_name : $item_name,
                'units' => (string) ($item['units'] ?? ''),
                'value_type' => $value_type,
                'latest_value' => (string) ($item['lastvalue'] ?? ''),
                'latest_clock' => (int) ($item['lastclock'] ?? 0)
            ];
        }

        return $metadata;
    }

    private function groupItemIdsByValueType(array $item_metadata): array {
        $itemids_by_type = [
            self::VALUE_TYPE_FLOAT => [],
            self::VALUE_TYPE_UINT => []
        ];

        foreach ($item_metadata as $itemid => $metadata) {
            $value_type = (int) $metadata['value_type'];

            if (!array_key_exists($value_type, $itemids_by_type)) {
                continue;
            }

            $itemids_by_type[$value_type][] = (int) $itemid;
        }

        return $itemids_by_type;
    }

    private function buildProblemBuckets(array $hostids, int $time_from, int $time_till, int $slot_seconds): array {
        if ($hostids === []) {
            return [];
        }

        try {
            $problems = \API::Problem()->get([
                'output' => ['eventid', 'clock', 'name', 'severity'],
                'hostids' => $hostids,
                'time_from' => $time_from,
                'time_till' => $time_till,
                'recent' => true,
                'sortfield' => ['eventid'],
                'sortorder' => 'ASC',
                'limit' => self::PROBLEM_LIMIT
            ]);
        }
        catch (\Throwable $e) {
            return [];
        }

        if (!is_array($problems)) {
            return [];
        }

        $bucketed = [];

        foreach ($problems as $problem) {
            $clock = (int) ($problem['clock'] ?? 0);
            $day = (int) date('w', $clock);
            $slot = $this->getSlotIndex($clock, $slot_seconds);
            $name = trim((string) ($problem['name'] ?? ''));

            if (!array_key_exists($day, $bucketed) || !array_key_exists($slot, $bucketed[$day] ?? [])) {
                $bucketed[$day][$slot] = [
                    'count' => 0,
                    'names' => []
                ];
            }

            $bucketed[$day][$slot]['count']++;

            if ($name !== '' && !in_array($name, $bucketed[$day][$slot]['names'], true) && count($bucketed[$day][$slot]['names']) < 3) {
                $bucketed[$day][$slot]['names'][] = $name;
            }
        }

        return $bucketed;
    }

    private function shouldUseTrends(int $week_start, int $aggregation, int $slot_seconds): bool {
        if ($aggregation === self::AGGREGATION_COUNT_NON_ZERO || $slot_seconds < self::SLOT_1_HOUR) {
            return false;
        }

        $trend_threshold = $this->getCurrentWeekStart() - (self::TREND_SWITCH_WEEKS * self::WEEK_SECONDS);

        return $week_start < $trend_threshold;
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

    private function extractHostIds(array $item_metadata): array {
        $hostids = [];

        foreach ($item_metadata as $metadata) {
            $hostid = (int) ($metadata['hostid'] ?? 0);

            if ($hostid > 0 && !in_array($hostid, $hostids, true)) {
                $hostids[] = $hostid;
            }
        }

        return $hostids;
    }

    private function getSlotCount(int $slot_seconds): int {
        return (int) (self::DAY_SECONDS / $slot_seconds);
    }

    private function getSlotIndex(int $clock, int $slot_seconds): int {
        $seconds_since_midnight = ((int) date('G', $clock) * 3600)
            + ((int) date('i', $clock) * 60)
            + (int) date('s', $clock);
        $slot_count = $this->getSlotCount($slot_seconds);

        return min((int) floor($seconds_since_midnight / $slot_seconds), $slot_count - 1);
    }

    private function ensureBucket(array &$bucketed, int $day, int $slot, int $itemid): void {
        if (!array_key_exists($day, $bucketed) || !array_key_exists($slot, $bucketed[$day] ?? [])) {
            $bucketed[$day][$slot] = $this->createEmptyBucketEnvelope();
        }

        if (!array_key_exists($itemid, $bucketed[$day][$slot]['items'])) {
            $bucketed[$day][$slot]['items'][$itemid] = $this->createEmptyBucket();
        }
    }

    private function createEmptyBucketEnvelope(): array {
        return [
            'combined' => $this->createEmptyBucket(),
            'items' => []
        ];
    }

    private function createEmptyBucket(): array {
        return [
            'sum' => 0.0,
            'count' => 0,
            'max' => null,
            'non_zero_count' => 0
        ];
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
