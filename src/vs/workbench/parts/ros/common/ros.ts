/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/

'use strict';

/**
 * Ros viewlet id.
 */
export const VIEWLET_ID = 'workbench.view.ros';

export interface IRosConfiguration {
	ros: {
		buildTool: string;
	};
}
