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
    ->addField(
        new CWidgetFieldSelectView($data['fields']['hour_format'])
    )
    ->addField(
        new CWidgetFieldCheckBoxView($data['fields']['show_display_title'])
    )
    ->addField(
        new CWidgetFieldTextBoxView($data['fields']['display_title'])
    )
    ->addField(
        new CWidgetFieldCheckBoxView($data['fields']['show_legend'])
    )
    ->addField(
        new CWidgetFieldTextBoxView($data['fields']['legend_text'])
    )
    ->show();
