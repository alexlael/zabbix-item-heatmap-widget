<?php

/**
 * @var CView $this
 * @var array $data
 */

$container = (new CDiv())
    ->addClass('item-heatmap-widget')
    ->setAttribute('data-weeks', json_encode($data['weeks'] ?? []))
    ->setAttribute('data-name', $data['name'] ?? 'Item Heatmap')
    ->addItem(
        (new CTag('canvas', true))
            ->addClass('item-heatmap-widget__canvas')
    );

(new CWidgetView($data))
    ->addItem($container)
    ->show();
