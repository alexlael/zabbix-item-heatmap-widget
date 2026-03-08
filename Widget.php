<?php

namespace Modules\ItemHeatmapWidget;

use Zabbix\Core\CWidget;

class Widget extends CWidget {

    public function getDefaultName(): string {
        return _('Item Heatmap');
    }
}
