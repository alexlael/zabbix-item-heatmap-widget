<?php

/**
 * @var CView $this
 * @var array $data
 */

(new CWidgetFormView($data))
    ->addField(
        (new CWidgetFieldMultiSelectItemView($data['fields']['itemids']))
            ->setPopupParameter('numeric', true)
    )
    ->addField(
        new CWidgetFieldMultiSelectItemView($data['fields']['log_itemids'])
    )
    ->addField(
        new CWidgetField