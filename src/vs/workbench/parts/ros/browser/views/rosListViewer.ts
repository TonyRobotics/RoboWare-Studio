/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import nls = require('vs/nls');
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IDataSource, ITree, IAccessibilityProvider } from 'vs/base/parts/tree/browser/tree';
import { IRosService } from 'vs/platform/ros/common/ros';
import { ILegacyTemplateData, LegacyRenderer, DefaultController } from 'vs/base/parts/tree/browser/treeDefaults';
import { ITerminalService } from 'vs/workbench/parts/terminal/common/terminal';

export interface ListStat {
	id: string;
	layer: number;
	content: string;
}

export class ListDataSource implements IDataSource {

	private command: string;
	private args: string[];

	constructor(
		command: string,
		args: string[],
		@IRosService private rosService: IRosService
	) {
		this.command = command;
		this.args = args;
	}

	public getId(tree: ITree, element: ListStat): string {
		return element.id;
	}

	public hasChildren(tree: ITree, element: ListStat): boolean {
		return element.layer >= 0 && this.args.length > element.layer;
	}

	public getChildren(tree: ITree, element: ListStat): TPromise<ListStat[]> {
		if (element.layer === 0) {
			return this.rosService.getCmdResultList(`${this.command} ${this.args[0]}`).then(
				(array) => array.map((x, i) => ({ id: `${element.id},${i}`, layer: 1, content: x })),
				(err) => [{ id: `${element.id},0`, layer: -1, content: nls.localize('roscoreError', "Unable to communicate with roscore!") }]
			);
		} else if (element.layer === 1) {	// list item
			return this.rosService.getCmdResultList(`${this.command} ${this.args[1]} ${element.content}`).then(
				(array) => array.map((x, i) => ({ id: `${element.id},${i}`, layer: 2, content: x.replace(/^ +/g, rs => rs.replace(/ /g, '_')) }))
			);
		}
		return TPromise.as(null);
	}

	public getParent(tree: ITree, element: ListStat): TPromise<ListStat> {
		return TPromise.as(null);
	}
}

export class ListRenderer extends LegacyRenderer {

	public renderElement(tree: ITree, element: ListStat, templateId: string, templateData: ILegacyTemplateData): void {
		return super.renderElement(tree, element.content, templateId, templateData);
	}
}

export class ListController extends DefaultController {

	private command: string;
	private args: string;

	constructor(
		command: string,
		args: string,
		@ITerminalService private terminalService: ITerminalService
	) {
		super();
		this.command = command;
		this.args = args;
	}

	protected onLeftClick(tree: ITree, element: ListStat, event: IMouseEvent, origin: string = 'mouse'): boolean {

		if (element.layer < 0) {
			return true;
		}
		if (element.layer === 1 && event.ctrlKey) {
			const selection = tree.getSelection();
			const idx = selection.indexOf(element);
			if (idx < 0) {
				selection.push(element);
			} else {
				selection.splice(idx, 1);
			}
			tree.setSelection(selection);
			return true;
		}
		if (this.args && element.layer === 1) {
			const isDoubleClick = (origin === 'mouse' && event.detail === 2);

			if (isDoubleClick) {
				this.terminalService.setActiveInstance(this.terminalService.createInstance({ name: element.content, executable: this.command, args: [this.args, element.content] }));
				this.terminalService.showPanel(true);
			}
		}
		return super.onLeftClick(tree, element, event, origin);
	}
}

// RosList Accessibility Provider
export class ListAccessibilityProvider implements IAccessibilityProvider {

	public getAriaLabel(tree: ITree, element: ListStat): string {
		return nls.localize('rosListViewerAriaLabel', "{0}, ROS List Viewer", element.content);
	}
}
