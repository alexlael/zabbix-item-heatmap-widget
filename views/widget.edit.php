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
        new CWidgetFieldSelectView($data['fields']['aggregation'])
    )
    ->show();
