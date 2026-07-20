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
        new CWidgetFieldSelectView($data['fields']['aggregation'])
    )
    ->addField(
        new CWidgetFieldSelectView($data['fields']['display_mode'])
    )
    ->addField(
        new CWidgetFieldSelectView($data['fields']['period_weeks'])
    )
    ->addField(
        new CWidgetFieldSelectView($data['fields']['slot_seconds'])
    )
    ->addField(
        new CWidgetFieldSelectView($data['fields']['hour_format'])
    )
    ->addField(
        new CWidgetFieldSelectView($data['fields']['color_scale_mode'])
    )
    ->addField(
        new CWidgetFieldTextBoxView($data['fields']['color_scale_low'])
    )
    ->addField(
        new CWidgetFieldTextBoxView($data['fields']['color_scale_high'])
    )
    ->addField(
        new CWidgetFieldCheckBoxView($data['fields']['show_legend'])
    )
    ->addField(
        new CWidgetFieldTextBoxView($data['fields']['legend_text'])
    )
    ->show();

(new CScriptTag(<<<'JS'
(() => {
    const showLegend = document.getElementById('show_legend');
    const legendText = document.getElementById('legend_text');

    if (!showLegend || !legendText) {
        return;
    }

    const legendRow = legendText.closest('.form-field') || legendText.parentElement;
    const updateLegendVisibility = () => {
        if (legendRow) {
            legendRow.style.display = showLegend.checked ? '' : 'none';
        }
    };

    showLegend.addEventListener('change', updateLegendVisibility);
    updateLegendVisibility();
})();
JS
))->show();
