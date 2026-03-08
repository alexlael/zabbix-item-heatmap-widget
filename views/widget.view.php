<?php

/**
 * @var CView $this
 * @var array $data
 */

$week_json = json_encode($data['week'] ?? [], JSON_UNESCAPED_SLASHES);

$container = (new CDiv())
    ->addClass('item-heatmap-widget')
    ->setAttribute('data-week', $week_json === false ? '{}' : $week_json)
    ->setAttribute('data-name', $data['name'] ?? 'Item Heatmap')
    ->setAttribute('data-display-mode', (string) ($data['display_mode'] ?? 0))
    ->setAttribute('data-period-weeks', (string) ($data['period_weeks'] ?? 12))
    ->setAttribute('data-slot-seconds', (string) ($data['slot_seconds'] ?? 3600))
    ->setAttribute('data-hour-format', (string) ($data['hour_format'] ?? 12))
    ->setAttribute('data-display-title', $data['display_title'] ?? '')
    ->setAttribute('data-show-display-title', (string) ($data['show_display_title'] ?? 0))
    ->setAttribute('data-legend-text', $data['legend_text'] ?? '')
    ->setAttribute('data-show-legend', (string) ($data['show_legend'] ?? 0))
    ->setAttribute('data-current-week-start', (string) ($data['current_week_start_ts'] ?? 0))
    ->setAttribute('data-oldest-week-start', (string) ($data['oldest_week_start_ts'] ?? 0))
    ->setAttribute('data-primary-itemid', (string) ($data['primary_itemid'] ?? 0))
    ->setAttribute('data-primary-item-url', $data['primary_item_url'] ?? '')
    ->setAttribute('data-selected-item-count', (string) ($data['selected_item_count'] ?? 0))
    ->addItem(
        (new CDiv())
            ->addClass('item-heatmap-widget__canvas-wrap')
            ->addItem(
                (new CTag('canvas', true))
                    ->addClass('item-heatmap-widget__canvas')
            )
    )
    ->addItem(
        (new CDiv())
            ->addClass('item-heatmap-widget__tooltip')
    )
    ->addItem(
        (new CDiv())
            ->addClass('item-heatmap-widget__menu')
    );

(new CWidgetView($data))
    ->addItem($container)
    ->show();
