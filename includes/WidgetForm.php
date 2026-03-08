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
                (new CWidgetFieldSelect('display_mode', _('Display mode'), [
                    HeatmapDataProvider::DISPLAY_MODE_CONSOLIDATED => _('Consolidated'),
                    HeatmapDataProvider::DISPLAY_MODE_COMPARE => _('Compare items')
                ]))->setDefault(HeatmapDataProvider::DISPLAY_MODE_CONSOLIDATED)
            )
            ->addField(
                (new CWidgetFieldSelect('period_weeks', _('Period window'), [
                    HeatmapDataProvider::PERIOD_4_WEEKS => _('Last 4 weeks'),
                    HeatmapDataProvider::PERIOD_8_WEEKS => _('Last 8 weeks'),
                    HeatmapDataProvider::PERIOD_12_WEEKS => _('Last 12 weeks'),
                    HeatmapDataProvider::PERIOD_24_WEEKS => _('Last 24 weeks'),
                    HeatmapDataProvider::PERIOD_52_WEEKS => _('Last 52 weeks')
                ]))->setDefault(HeatmapDataProvider::PERIOD_12_WEEKS)
            )
            ->addField(
                (new CWidgetFieldSelect('slot_seconds', _('Granularity'), [
                    HeatmapDataProvider::SLOT_30_MINUTES => _('30 minutes'),
                    HeatmapDataProvider::SLOT_1_HOUR => _('1 hour'),
                    HeatmapDataProvider::SLOT_2_HOURS => _('2 hours'),
                    HeatmapDataProvider::SLOT_4_HOURS => _('4 hours'),
                    HeatmapDataProvider::SLOT_6_HOURS => _('6 hours'),
                    HeatmapDataProvider::SLOT_12_HOURS => _('12 hours')
                ]))->setDefault(HeatmapDataProvider::SLOT_1_HOUR)
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
