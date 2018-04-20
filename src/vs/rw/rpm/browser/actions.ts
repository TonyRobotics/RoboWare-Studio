/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Wang Tong
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import { ITerminalService } from 'vs/workbench/parts/terminal/common/terminal';
import { Registry } from 'vs/platform/platform';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actionRegistry';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class TerminalAction extends Action {
	private static ID = 'roboware.rpm.action.termianl';
	private static LABEL = localize('runRpmTerminal', "Run RPM Terminal");
	private static ALIAS = 'Rpm: Show ROS Packages';
	private static CATEGORY = localize('rpm', "ROS Packages Manager");
	private static SHELL = {
		name: 'ros package',
		executable: '/bin/bash'
	};

	public static registry() {
		Registry
			.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions)
			.registerWorkbenchAction(
				new SyncActionDescriptor(
					TerminalAction,
					TerminalAction.ID,
					TerminalAction.LABEL),
				TerminalAction.ALIAS,
				TerminalAction.CATEGORY);
	}

	public static createInstance(service: IInstantiationService): TerminalAction {
		return service.createInstance(TerminalAction, TerminalAction.ID, TerminalAction.LABEL);
	}

	constructor(
		id: string,
		label: string,
		@ITerminalService private terminalService: ITerminalService
	) {
		super(id, label);
	}

	public run(command: string): TPromise<void> {
		var terminal = this.terminalService.getActiveInstance();
		if (!terminal) {
			terminal = this.terminalService.createInstance(TerminalAction.SHELL);
		}
		terminal.sendText(command, true);
		this.terminalService.setActiveInstance(terminal);
		return this.terminalService.showPanel(true);
	}
}