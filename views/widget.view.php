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
    ->setAttribute('data-current-week-start', (string) ($data['current_week_start_ts'] ?? 0))
    ->setAttribute('data-oldest-week-start', (string) ($data['oldest_week_start_ts'] ?? 0))
    ->setAttribute('data-primary-item-url', $data['primary_item_url'] ?? '')
    ->setAttribute('data-selected-item-count', (string) ($data['selected_item_count'] ?? 0))
    ->addItem(
        (new CTag('canvas', true))
            ->addClass('item-heatmap-widget__canvas')
    )
    ->addItem(
        (new CDiv())
            ->addClass('item-heatmap-widget__tooltip')
    );

(new CWidgetView($data))
    ->addItem($container)
    ->show();
