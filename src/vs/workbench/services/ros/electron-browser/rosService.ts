/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/

'use strict';

import pfs = require('vs/base/node/pfs');
import { TPromise } from 'vs/base/common/winjs.base';
import { IWindowIPCService } from 'vs/workbench/services/window/electron-browser/windowService';
import { IRosWinService, IRosService } from 'vs/platform/ros/common/ros';
import { IWindowsService } from 'vs/platform/windows/common/windows';

export class RosService implements IRosWinService {

	public _serviceBrand: any;

	constructor(
		@IWindowIPCService private windowService: IWindowIPCService,
		@IRosService private rosService: IRosService,
		@IWindowsService private windowsService: IWindowsService
	) {
	}

	// Create and open ros workspace
	public newRosWs(): TPromise<void> {
		const folderPath = this.windowService.getWindow().showSaveDialog({});
		if (folderPath) {
			return pfs.mkdirp(folderPath).then(() =>
				this.rosService.initRosWs(folderPath)
			).then(() =>
				this.windowsService.openWindow([folderPath])
				);
		}
		return null;
	}
}