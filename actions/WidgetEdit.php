<?php

namespace Modules\ItemHeatmapWidget\Actions;

use CControllerDashboardWidgetEdit;
use CControllerResponseData;

class WidgetEdit extends CControllerDashboardWidgetEdit {

    protected function doAction(): void {
        $this->setResponse(new CControllerResponseData([
            'name' => $this->getInput('name', 'Item Heatmap'),
            'user' => [
                'debug_mode' => $this->getDebugMode()
            ]
        ]));
    }
}
