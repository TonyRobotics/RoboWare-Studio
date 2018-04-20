/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/rosactions';
import { TPromise } from 'vs/base/common/winjs.base';
import nls = require('vs/nls');
import os = require('os');
import child_process = require('child_process');
import paths = require('vs/base/common/paths');
import URI from 'vs/base/common/uri';
import { Action } from 'vs/base/common/actions';
import { RosListView, RosTopicListView } from 'vs/workbench/parts/ros/browser/views/rosListView';
import { ITerminalService } from 'vs/workbench/parts/terminal/common/terminal';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IRosService } from 'vs/platform/ros/common/ros';
import { IDebugService } from 'vs/workbench/parts/debug/common/debug';
import { IQuickOpenService } from 'vs/platform/quickOpen/common/quickOpen';
import { IMessageService, Severity } from 'vs/platform/message/common/message';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';

// Refresh RosList Viewer
export class RefreshViewRosListAction extends Action {

	constructor(rosListView: RosListView, clazz: string) {
		super('workbench.action.ros.refreshRosList', nls.localize('refresh', "Refresh"), clazz, true, (context: any) => rosListView.refresh());
	}
}

// Run rosbag record
export class RecordRosTopicListAction extends Action {

	private rosTopicListView: RosTopicListView;

	constructor(rosTopicListView: RosTopicListView, clazz: string,
		@ITerminalService private terminalService: ITerminalService
	) {
		super('workbench.action.ros.recordRosTopic', nls.localize('recordRosTopic', "Record ROS Topic"), clazz, true);

		this.rosTopicListView = rosTopicListView;
	}

	public run(): TPromise<any> {
		const selection = this.rosTopicListView.getViewer().getSelection();
		const terminal = this.terminalService.createInstance({ name: 'rosbag record', executable: 'bash' });
		terminal.sendText(`rosbag record ${selection && selection.length > 0 ? selection.map(val => val.content).join(' ') : '-a'}`, true);
		this.terminalService.setActiveInstance(terminal);
		return this.terminalService.showPanel(true);
	}
}

/* Open .bashrc */
export class OpenBashrcAction extends Action {

	public static ID = 'workbench.action.ros.openBashrc';
	public static LABEL = nls.localize('openBashrc', "Open ~/.bashrc");

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return this.editorService.openEditor({
			resource: URI.file(paths.join(os.homedir(), '.bashrc')),
			options: { forceOpen: true }
		}, false);
	}
}

/* Open Remote .bashrc */
export class OpenRemoteBashrcAction extends Action {

	public static ID = 'workbench.action.ros.openRemoteBashrc';
	public static LABEL = nls.localize('openRemoteBashrc', "Open Remote ~/.bashrc");

	constructor(
		id: string,
		label: string,
		@IRosService private rosService: IRosService,
		@IMessageService private messageService: IMessageService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return this.rosService.getRemoteArgsCache().then((remoteArgs) => {
			if (remoteArgs) {
				const path = paths.join(this.contextService.getWorkspace().resource.fsPath, '.vscode', '.bashrc');
				return new TPromise<void>((c, e) => {
					const execProc = child_process.exec(`scp -r ${remoteArgs.user}@${remoteArgs.host}:/home/${remoteArgs.user}/.bashrc ${path}`, (err, stdout, stderr) => {
						if (err) {
							return e(err);
						}
					});
					execProc.on('exit', c);
					execProc.on('error', e);
				}).then(() => {
					this.editorService.openEditor({
						resource: URI.file(path),
						options: { forceOpen: true }
					}, false);
				});
			} else {
				return this.messageService.show(Severity.Error, nls.localize('remoteArgsNotConfig', "Remote Arguments not configured!"));
			}
		});
	}
}

/* Run RosCore */
export class RunRosCoreAction extends Action {

	public static ID = 'workbench.action.ros.runRosCore';
	public static LABEL = nls.localize('runRosCore', "Run roscore");

	constructor(
		id: string,
		label: string,
		@ITerminalService private terminalService: ITerminalService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		this.terminalService.setActiveInstance(this.terminalService.createInstance({ name: 'roscore', executable: 'roscore' }));
		return this.terminalService.showPanel(true);
	}
}

/* Run RViz */
export class RunRosRvizAction extends Action {

	public static ID = 'workbench.action.ros.runRosRviz';
	public static LABEL = nls.localize('runRosRviz', "Run RViz");

	constructor(
		id: string,
		label: string,
		@ITerminalService private terminalService: ITerminalService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		this.terminalService.setActiveInstance(this.terminalService.createInstance({ name: 'RViz', executable: 'rviz' }));
		return this.terminalService.showPanel(true);
	}
}

/* Run rqt */
export class RunRosRqtAction extends Action {

	public static ID = 'workbench.action.ros.runRosRqt';
	public static LABEL = nls.localize('runRosRqt', "Run rqt");

	constructor(
		id: string,
		label: string,
		@ITerminalService private terminalService: ITerminalService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		this.terminalService.setActiveInstance(this.terminalService.createInstance({ name: 'rqt', executable: 'rqt' }));
		return this.terminalService.showPanel(true);
	}
}

/* Run rqt_reconfigure */
export class RunRosReconfigureAction extends Action {

	public static ID = 'workbench.action.ros.runRosReconfigure';
	public static LABEL = nls.localize('runRosReconfigure', "Run rqt_reconfigure");

	constructor(
		id: string,
		label: string,
		@ITerminalService private terminalService: ITerminalService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		this.terminalService.setActiveInstance(this.terminalService.createInstance({ name: 'rqt_reconfigure', executable: 'rosrun', args: ['rqt_reconfigure', 'rqt_reconfigure'] }));
		return this.terminalService.showPanel(true);
	}
}

/* Run rqt_graph */
export class RunRosGraphAction extends Action {

	public static ID = 'workbench.action.ros.runRosGraph';
	public static LABEL = nls.localize('runRosGraph', "Run rqt_graph");

	constructor(
		id: string,
		label: string,
		@ITerminalService private terminalService: ITerminalService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		this.terminalService.setActiveInstance(this.terminalService.createInstance({ name: 'rqt_graph', executable: 'rqt_graph' }));
		return this.terminalService.showPanel(true);
	}
}

/* Run Remote RosCore */
export class RunRemoteRosCoreAction extends Action {

	public static ID = 'workbench.action.ros.runRemoteRosCore';
	public static LABEL = nls.localize('runRemoteRosCore', "Run Remote roscore");

	constructor(
		id: string,
		label: string,
		@IRosService private rosService: IRosService,
		@IMessageService private messageService: IMessageService,
		@ITerminalService private terminalService: ITerminalService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return this.rosService.getRemoteArgsCache().then((remoteArgs) => {
			if (remoteArgs) {
				const terminal = this.terminalService.createInstance({ name: 'Remote roscore', executable: 'bash', args: ['-c', `ssh ${remoteArgs.user}@${remoteArgs.host}`] });
				terminal.sendText('roscore', true);
				this.terminalService.setActiveInstance(terminal);
				return this.terminalService.showPanel(true);
			} else {
				return this.messageService.show(Severity.Error, nls.localize('remoteArgsNotConfig', "Remote Arguments not configured!"));
			}
		});
	}
}

/* Configure Launch Args */
export class ConfigLaunchArgsAction extends Action {

	public static ID = 'workbench.action.ros.configLaunchArgs';
	public static LABEL = nls.localize('configLaunchArgs', "Configure Launch Args");

	constructor(
		id: string,
		label: string,
		@IRosService private rosService: IRosService,
		@IDebugService private debugService: IDebugService,
		@IQuickOpenService private quickOpenService: IQuickOpenService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		const configurationName = this.debugService.getViewModel().selectedConfigurationName;
		return this.rosService.getDebugArgs(configurationName).then(args => {
			this.quickOpenService.input({ value: args, prompt: nls.localize('inputArgsPrompt', 'Enter debug args here.') }).then(value => {
				if (value) {
					this.rosService.setDebugArgs(configurationName, value).then(() => {
						this.rosService.addArgsToCache(value);
					});
				}
			});
		});
	}
}

/* Select Launch Args */
export class SelectLaunchArgsAction extends Action {

	public static ID = 'workbench.action.ros.selectLaunchArgs';
	public static LABEL = nls.localize('selectLaunchArgs', "Select Launch Args");

	constructor(
		id: string,
		label: string,
		@IRosService private rosService: IRosService,
		@IDebugService private debugService: IDebugService,
		@IQuickOpenService private quickOpenService: IQuickOpenService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		const configurationName = this.debugService.getViewModel().selectedConfigurationName;
		this.rosService.getArgsCache().then((args: string[]) => {
			const placeHolder = nls.localize('selectLaunchArgs', "Select Launch Args");
			this.quickOpenService.pick(args, { placeHolder }).then(pick => {
				if (pick) {
					this.rosService.setDebugArgs(configurationName, pick);
				}
			});
		});
		return null;
	}
}