/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import nls = require('vs/nls');
import * as errors from 'vs/base/common/errors';
import env = require('vs/base/common/platform');
import DOM = require('vs/base/browser/dom');
import { TPromise } from 'vs/base/common/winjs.base';
import { IActionRunner, IAction } from 'vs/base/common/actions';
import { Button } from 'vs/base/browser/ui/button/button';
import { $ } from 'vs/base/browser/builder';
import { IActionItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { CollapsibleView } from 'vs/base/browser/ui/splitview/splitview';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { OpenFolderAction, OpenFileFolderAction } from 'vs/workbench/browser/actions/fileActions';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { NewWorkspaceAction } from 'vs/workbench/parts/files/browser/fileActions';

export class EmptyView extends CollapsibleView {
	private openFolderButton: Button;
	private newFolderButton: Button;

	constructor(
		private actionRunner: IActionRunner,
		@IThemeService private themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super({
			minimumSize: 2 * 22,
			ariaHeaderLabel: nls.localize('explorerSection', "Files Explorer Section")
		});
	}

	public renderHeader(container: HTMLElement): void {
		let titleDiv = $('div.title').appendTo(container);
		$('span').text(nls.localize('noWorkspace', "No Folder Opened")).appendTo(titleDiv);
	}

	protected renderBody(container: HTMLElement): void {
		DOM.addClass(container, 'explorer-empty-view');

		let titleDiv = $('div.section').appendTo(container);
		$('p').text(nls.localize('noWorkspaceHelp', "You have not yet opened a workspace.")).appendTo(titleDiv);

		let section = $('div.section').appendTo(container);

		this.openFolderButton = new Button(section);
		attachButtonStyler(this.openFolderButton, this.themeService);
		this.openFolderButton.label = nls.localize('openFolder', "Open Workspace");
		this.openFolderButton.addListener('click', () => {
			const actionClass = env.isMacintosh ? OpenFileFolderAction : OpenFolderAction;
			const action = this.instantiationService.createInstance<string, string, IAction>(actionClass, actionClass.ID, actionClass.LABEL);
			this.actionRunner.run(action).done(() => {
				action.dispose();
			}, err => {
				action.dispose();
				errors.onUnexpectedError(err);
			});
		});

		let titleDiv2 = $('div.section').appendTo(container);
		$('p').text(nls.localize('newWorkspaceHelp', "Or you can create a new workspace.")).appendTo(titleDiv2);

		let section2 = $('div.section').appendTo(container);

		this.newFolderButton = new Button(section2);
		attachButtonStyler(this.newFolderButton, this.themeService);
		this.newFolderButton.label = nls.localize('newWorkspace', "New Workspace");
		this.newFolderButton.addListener('click', () => {
			const action = this.instantiationService.createInstance<string, string, IAction>(NewWorkspaceAction, NewWorkspaceAction.ID, NewWorkspaceAction.LABEL);
			this.actionRunner.run(action).done(() => {
				action.dispose();
			}, err => {
				action.dispose();
				errors.onUnexpectedError(err);
			});
		});
	}

	protected layoutBody(size: number): void {
		// no-op
	}

	public create(): TPromise<void> {
		return TPromise.as(null);
	}

	public setVisible(visible: boolean): TPromise<void> {
		return TPromise.as(null);
	}

	public focusBody(): void {
		if (this.openFolderButton) {
			this.openFolderButton.getElement().focus();
		}
	}

	protected reveal(element: any, relativeTop?: number): TPromise<void> {
		return TPromise.as(null);
	}

	public getActions(): IAction[] {
		return [];
	}

	public getSecondaryActions(): IAction[] {
		return [];
	}

	public getActionItem(action: IAction): IActionItem {
		return null;
	}

	public shutdown(): void {
		// Subclass to implement
	}
}