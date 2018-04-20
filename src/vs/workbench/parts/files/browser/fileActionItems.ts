/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as lifecycle from 'vs/base/common/lifecycle';
import * as errors from 'vs/base/common/errors';
import { IAction, IActionRunner } from 'vs/base/common/actions';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as dom from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { SelectBox } from 'vs/base/browser/ui/selectBox/selectBox';
import { IActionItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { EventEmitter } from 'vs/base/common/eventEmitter';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IDebugService } from 'vs/workbench/parts/debug/common/debug';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IRosService } from 'vs/platform/ros/common/ros';
import { IRosConfiguration } from 'vs/workbench/parts/ros/common/ros';
import { RosNodeView } from 'vs/workbench/parts/files/browser/views/rosNodeView';
const $ = dom.$;

export class RunTaskActionItem extends EventEmitter implements IActionItem {

	public actionRunner: IActionRunner;
	private container: HTMLElement;
	private start: HTMLElement;
	private selectBox: SelectBox;
	private toDispose: lifecycle.IDisposable[];

	private rosNodeView: RosNodeView;

	constructor(
		private context: any,
		private action: IAction,
		rosNodeView: RosNodeView,
		@IDebugService private debugService: IDebugService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService private configurationService: IConfigurationService,
		@ICommandService private commandService: ICommandService,
		@IRosService private rosService: IRosService
	) {
		super();
		this.toDispose = [];
		this.selectBox = new SelectBox([], -1);
		this.toDispose.push(attachSelectBoxStyler(this.selectBox, themeService, {
			selectBackground: SIDE_BAR_BACKGROUND
		}));
		this.rosNodeView = rosNodeView;
		this.registerListeners();
	}

	private setViewRootPath(taskName: string): void {
		switch (taskName) {
			case 'Debug':
			case 'Release':
			case 'Debug (catkin)':
			case 'Release (catkin)':
				this.rosNodeView.setRootPath('devel/lib');
				break;
			case 'Debug (isolated)':
			case 'Release (isolated)':
				this.rosNodeView.setRootPath('devel_isolated');
				break;
			case 'Debug (remote)':
			case 'Release (remote)':
			case 'Debug (remote catkin)':
			case 'Release (remote catkin)':
				this.rosNodeView.setRootPath('el/lib');
				break;
			case 'Debug (remote isolated)':
			case 'Release (remote isolated)':
				this.rosNodeView.setRootPath('el_isolated');
				break;
		}
	}

	private setDebugConfigurationName(taskName: string): void {
		switch (taskName) {
			case 'Debug':
			case 'Release':
			case 'Debug (isolated)':
			case 'Release (isolated)':
			case 'Debug (catkin)':
			case 'Release (catkin)':
				this.debugService.getViewModel().setSelectedConfigurationName('C++');
				break;
			case 'Debug (remote)':
			case 'Release (remote)':
			case 'Debug (remote isolated)':
			case 'Release (remote isolated)':
			case 'Debug (remote catkin)':
			case 'Release (remote catkin)':
				this.debugService.getViewModel().setSelectedConfigurationName('C++ (remote)');
				break;
		}
	}

	private registerListeners(): void {
		this.toDispose.push(this.configurationService.onDidUpdateConfiguration(e => {
			this.updateOptions();
		}));
		this.toDispose.push(this.selectBox.onDidSelect(taskName => {
			this.rosService.setBuildTask(taskName).then(() => {
				this.setViewRootPath(taskName);
				this.setDebugConfigurationName(taskName);
			});
		}));
	}

	public render(container: HTMLElement): void {
		this.container = container;
		dom.addClass(container, 'run-task-action-item');
		this.start = dom.append(container, $('.icon'));
		this.start.title = this.action.label;
		this.start.tabIndex = 0;

		this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.CLICK, () => {
			this.start.blur();
			this.actionRunner.run(this.action, this.context).done(null, errors.onUnexpectedError);
		}));

		this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_DOWN, (e: MouseEvent) => {
			if (this.action.enabled && e.button === 0) {
				dom.addClass(this.start, 'active');
			}
		}));
		this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_UP, () => {
			dom.removeClass(this.start, 'active');
		}));
		this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_OUT, () => {
			dom.removeClass(this.start, 'active');
		}));

		this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			const event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				this.actionRunner.run(this.action, this.context).done(null, errors.onUnexpectedError);
			}
			if (event.equals(KeyCode.RightArrow)) {
				this.selectBox.focus();
				event.stopPropagation();
			}
		}));

		const selectBoxContainer = $('.configuration');
		this.selectBox.render(dom.append(container, selectBoxContainer));
		this.toDispose.push(dom.addDisposableListener(selectBoxContainer, dom.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			const event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.LeftArrow)) {
				this.start.focus();
				event.stopPropagation();
			}
		}));

		this.updateOptions();
	}

	public setActionContext(context: any): void {
		this.context = context;
	}

	public isEnabled(): boolean {
		return true;
	}

	public focus(fromRight?: boolean): void {
		if (fromRight) {
			this.selectBox.focus();
		} else {
			this.start.focus();
		}
	}

	public blur(): void {
		this.container.blur();
	}

	public dispose(): void {
		this.toDispose = lifecycle.dispose(this.toDispose);
	}

	private updateOptions(): void {
		const settings = this.configurationService.getConfiguration<IRosConfiguration>();
		const buildTool = settings.ros.buildTool;
		this.rosService.getBuildTaskNames(buildTool === 'catkin build').then((tasks) => {
			let selected = -1;
			const options: string[] = [];
			for (let i = 0; i < tasks.length; i++) {
				options.push(tasks[i].name);
				if (tasks[i].isBuildCommand) {
					selected = i;
					this.setViewRootPath(tasks[i].name);
					this.setDebugConfigurationName(tasks[i].name);
				}
			}
			this.selectBox.setOptions(options, selected);
		});
	}
}