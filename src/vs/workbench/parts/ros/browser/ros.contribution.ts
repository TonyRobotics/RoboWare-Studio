/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/ros.contribution';

import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor, ToggleViewletAction } from 'vs/workbench/browser/viewlet';
import nls = require('vs/nls');
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { Registry } from 'vs/platform/platform';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actionRegistry';
import { VIEWLET_ID } from 'vs/workbench/parts/ros/common/ros';
import { IKeybindings } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from 'vs/platform/configuration/common/configurationRegistry';

// Viewlet Action
export class OpenRosViewletAction extends ToggleViewletAction {
	public static ID = VIEWLET_ID;
	public static LABEL = nls.localize('showRosViewlet', "Show ROS");

	constructor(
		id: string,
		label: string,
		@IViewletService viewletService: IViewletService,
		@IWorkbenchEditorService editorService: IWorkbenchEditorService
	) {
		super(id, label, VIEWLET_ID, viewletService, editorService);
	}
}

// Register Viewlet
Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).registerViewlet(new ViewletDescriptor(
	'vs/workbench/parts/ros/browser/rosViewlet',
	'RosViewlet',
	VIEWLET_ID,
	nls.localize('ros', "ROS"),
	'ros',
	50
));

const openViewletKb: IKeybindings = {
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_R
};

// Register Action to Open Viewlet
const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(
	new SyncActionDescriptor(OpenRosViewletAction, OpenRosViewletAction.ID, OpenRosViewletAction.LABEL, openViewletKb),
	'View: Show ROS',
	nls.localize('view', "View")
);

// Configuration
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

configurationRegistry.registerConfiguration({
	id: 'ros',
	order: 14,
	title: nls.localize('rosConfigurationTitle', "ROS"),
	type: 'object',
	properties: {
		'ros.buildTool': {
			'type': 'string',
			'enum': ['catkin build', 'catkin_make'],
			'default': 'catkin_make',
			'description': nls.localize({ comment: ['Choose the tools to build ROS Workspace.'], key: 'buildTool' }, "Choose the tools to build ROS Workspace. Accepted values:  '{0}', '{1}'.", 'catkin build', 'catkin_make')
		}
	}
});
