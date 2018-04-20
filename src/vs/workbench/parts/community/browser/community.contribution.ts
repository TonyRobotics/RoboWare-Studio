/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Wang Tong
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/community.contribution';
import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/platform';
import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor, ToggleViewletAction } from 'vs/workbench/browser/viewlet';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actionRegistry';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { VIEWLET_ID } from 'vs/workbench/parts/community/browser/config';
import { TerminalAction } from 'vs/workbench/parts/community/browser/actions';
// import { IKeybindings } from 'vs/platform/keybinding/common/keybinding';
// import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';

Registry
	.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions)
	.registerWorkbenchAction(
		new SyncActionDescriptor(
			TerminalAction,
			TerminalAction.ID,
			TerminalAction.LABEL),
		'Community',
		localize('community', "Community"));

Registry
	.as<ViewletRegistry>(ViewletExtensions.Viewlets)
	.registerViewlet(
		new ViewletDescriptor(
			'vs/workbench/parts/community/browser/viewlet',
			'RPMViewlet',
			VIEWLET_ID,
			localize('community', "Community"),
			'community',
			50));
