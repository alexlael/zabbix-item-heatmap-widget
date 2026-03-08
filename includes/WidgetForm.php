<?php

namespace Modules\ItemHeatmapWidget\Includes;

use Zabbix\Widgets\CWidgetForm;
use Zabbix\Widgets\Fields\CWidgetFieldCheckBox;
use Zabbix\Widgets\Fields\CWidgetFieldMultiSelectItem;
use Zabbix\Widgets\Fields\CWidgetFieldSelect;
use Zabbix\Widgets\Fields\CWidgetFieldTextBox;

class WidgetForm extends CWidgetForm {

    public function addFields(): self {
        return $this
            ->addField(
                new CWidgetFieldMultiSelectItem('itemids', _('Items'))
            )
            ->addField(
                (new CWidgetFieldSelect('aggregation', _('Aggregation'), [
                    0 => _('Sum'),
                    1 => _('Average'),
                    2 => _('Maximum'),
                    3 => _('Count non-zero')
                ]))->setDefault(0)
            )
            ->addField(
                (new CWidgetFieldSelect('hour_format', _('Hour format'), [
                    12 => _('12-hour (AM/PM)'),
                    120 => _('12-hour (no AM/PM)'),
                    24 => _('24-hour')
                ]))->setDefault(12)
            )
            ->addField(
                (new CWidgetFieldCheckBox('show_display_title', _('Show display title')))
                    ->setDefault(1)
            )
            ->addField(
                (new CWidgetFieldTextBox('display_title', _('Display title')))
                    ->setDefault('')
            )
            ->addField(
                (new CWidgetFieldCheckBox('show_legend', _('Show legend')))
                    ->setDefault(0)
            )
            ->addField(
                (new CWidgetFieldTextBox('legend_text', _('Legend / context')))
                    ->setDefault('')
            );
    }
}
