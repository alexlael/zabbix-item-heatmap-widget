<?php

namespace Modules\ItemHeatmapWidget\Includes;

use Zabbix\Widgets\CWidgetForm;
use Zabbix\Widgets\Fields\CWidgetFieldMultiSelectItem;
use Zabbix\Widgets\Fields\CWidgetFieldSelect;

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
            );
    }
}
