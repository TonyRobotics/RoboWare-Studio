/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Wang Tong
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import { ITerminalService } from 'vs/workbench/parts/terminal/common/terminal';

export class TerminalAction extends Action {
	public static ID = 'workbench.extensions.termianl.community';
	public static LABEL = localize('runRpmTerminal', "Run RPM Terminal");

	constructor(
		id: string,
		label: string,
		@ITerminalService private terminalService: ITerminalService
	) {
		super(id, label);
	}

	public run(command: string): TPromise<any> {
		var terminal = this.terminalService.getActiveInstance();
		if (!terminal) {
			terminal = this.terminalService.createInstance('bash');
		}
		terminal.sendText(command, true);
		this.terminalService.setActiveInstance(terminal);
		return this.terminalService.showPanel(true);
	}
}