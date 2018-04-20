/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/

'use strict';

import nls = require('vs/nls');
import { TPromise } from 'vs/base/common/winjs.base';
import { Builder, $ } from 'vs/base/browser/builder';
import URI from 'vs/base/common/uri';
import errors = require('vs/base/common/errors');
import { Action, IActionRunner, IAction } from 'vs/base/common/actions';
import { prepareActions } from 'vs/workbench/browser/actionBarRegistry';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { ListDataSource, ListRenderer, ListController, ListAccessibilityProvider } from 'vs/workbench/parts/ros/browser/views/rosListViewer';
import * as DOM from 'vs/base/browser/dom';
import { CollapsibleViewletView } from 'vs/workbench/browser/viewlet';
import { FileStat } from 'vs/workbench/parts/files/common/explorerViewModel';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IMessageService } from 'vs/platform/message/common/message';
import { RefreshViewRosListAction, RecordRosTopicListAction } from 'vs/workbench/parts/ros/browser/rosActions';

export class RosListView extends CollapsibleViewletView {

	private rosListViewer: ITree;
	private title: string;
	private command: string;
	private args: string[];
	private dbClickArgs: string;
	private shouldRefresh: boolean;

	constructor(
		actionRunner: IActionRunner,
		title: string,
		command: string,
		args: string[],
		dbClickArgs: string,
		@IMessageService messageService: IMessageService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService protected instantiationService: IInstantiationService
	) {
		super(actionRunner, false, nls.localize('rosListSection', "ROS List Section"), messageService, keybindingService, contextMenuService, undefined);

		this.title = title;
		this.command = command;
		this.args = args;
		this.dbClickArgs = dbClickArgs;
	}

	public renderHeader(container: HTMLElement): void {
		const titleDiv = $('div.title').appendTo(container);
		$('span').text(this.title).appendTo(titleDiv);

		super.renderHeader(container);
	}

	public renderBody(container: HTMLElement): void {
		this.treeContainer = super.renderViewTree(container);
		DOM.addClass(this.treeContainer, 'ros-list-view');

		this.tree = this.createViewer($(this.treeContainer));

		if (this.toolBar) {
			this.toolBar.setActions(prepareActions(this.getActions()), [])();
		}
	}

	public getActions(): IAction[] {
		const actions: Action[] = [];

		actions.push(this.instantiationService.createInstance(RefreshViewRosListAction, this, 'ros-action refresh-ros'));

		return actions;
	}

	public create(): TPromise<void> {

		// Load and Fill Viewer
		return this.doRefresh();
	}

	public focusBody(): void {

		// Make sure the current selected element is revealed
		if (this.rosListViewer) {
			const selection = this.rosListViewer.getSelection();
			if (selection.length > 0) {
				this.reveal(selection[0], 0.5).done(null, errors.onUnexpectedError);
			}

			// Pass Focus to Viewer
			this.rosListViewer.DOMFocus();
		}
	}

	public setVisible(visible: boolean): TPromise<void> {
		return super.setVisible(visible).then(() => {

			// Show
			if (visible) {

				// If a refresh was requested and we are now visible, run it
				let refreshPromise = TPromise.as<void>(null);
				if (this.shouldRefresh) {
					refreshPromise = this.doRefresh();
					this.shouldRefresh = false; // Reset flag
				}

				// Otherwise restore last used file: By Explorer selection
				return refreshPromise.then(() => {
					// this.openFocusedElement();
				});
			}
			return null;
		});
	}

	private getInput(): FileStat {
		return this.rosListViewer ? (<FileStat>this.rosListViewer.getInput()) : null;
	}

	public createViewer(container: Builder): ITree {
		const dataSource = this.instantiationService.createInstance(ListDataSource, this.command, this.args);
		const renderer = this.instantiationService.createInstance(ListRenderer);
		const controller = this.instantiationService.createInstance(ListController, this.command, this.dbClickArgs);
		const accessibilityProvider = this.instantiationService.createInstance(ListAccessibilityProvider);

		this.rosListViewer = new Tree(container.getHTMLElement(), {
			dataSource,
			renderer,
			controller,
			accessibilityProvider
		}, {
				autoExpandSingleChildren: true,
				ariaLabel: nls.localize('treeAriaLabel', "ROS List Viewer")
			});

		return this.rosListViewer;
	}

	public getOptimalWidth(): number {
		const parentNode = this.rosListViewer.getHTMLElement();
		const childNodes = [].slice.call(parentNode.querySelectorAll('.roslist-item > a'));

		return DOM.getLargestChildWidth(parentNode, childNodes);
	}

	/**
	 * Refresh the contents of the explorer to get up to date data from the disk about the file structure.
	 */
	public refresh(): TPromise<void> {
		if (!this.rosListViewer || this.rosListViewer.getHighlight()) {
			return TPromise.as(null);
		}

		// Focus
		this.rosListViewer.DOMFocus();

		return this.doRefresh();
	}

	private doRefresh(): TPromise<void> {
		const root = this.getInput();
		const targetsToResolve: URI[] = [];
		let targetsToExpand: URI[] = [];

		// First time refresh: Receive target through active editor input or selection and also include settings from previous session
		if (!root) {
			if (targetsToExpand.length) {
				targetsToResolve.push(...targetsToExpand);
			}
		}
		return this.rosListViewer.setInput({ id: '0', layer: 0, content: 'root' }).then(() => {

			// Make sure to expand all folders that where expanded in the previous session
			if (targetsToExpand) {
				return this.rosListViewer.expandAll(targetsToExpand.map(expand => this.getInput().find(expand)));
			}

			return TPromise.as(null);
		});
	}

	public dispose(): void {
		if (this.toolBar) {
			this.toolBar.dispose();
		}

		super.dispose();
	}
}

export class RosTopicListView extends RosListView {

	constructor(
		actionRunner: IActionRunner,
		title: string,
		command: string,
		args: string[],
		dbClickArgs: string,
		@IMessageService messageService: IMessageService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService protected instantiationService: IInstantiationService
	) {
		super(actionRunner, title, command, args, dbClickArgs, messageService, keybindingService, contextMenuService, instantiationService);
	}

	public getActions(): IAction[] {
		const actions: Action[] = [];

		actions.push(this.instantiationService.createInstance(RecordRosTopicListAction, this, 'ros-action record-ros'));
		actions.push(this.instantiationService.createInstance(RefreshViewRosListAction, this, 'ros-action refresh-ros'));

		return actions;
	}
}