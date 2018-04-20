/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import nls = require('vs/nls');
import errors = require('vs/base/common/errors');
import { IAction } from 'vs/base/common/actions';
import { FileLabel } from 'vs/workbench/browser/labels';
import { ITree, IAccessibilityProvider, IRenderer, ContextMenuEvent, IFilter } from 'vs/base/parts/tree/browser/tree';
import { ClickBehavior, DefaultController } from 'vs/base/parts/tree/browser/treeDefaults';
import { ContributableActionProvider } from 'vs/workbench/browser/actionBarRegistry';
import { FileStat, NewStatPlaceholder } from 'vs/workbench/parts/files/common/explorerViewModel';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IWorkspaceContextService, IWorkspace } from 'vs/platform/workspace/common/workspace';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

export interface IFileTemplateData {
	label: FileLabel;
	container: HTMLElement;
}

// Explorer Renderer
export class FileRenderer implements IRenderer {

	private static ITEM_HEIGHT = 22;
	private static FILE_TEMPLATE_ID = 'file';

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) {
	}

	public getHeight(tree: ITree, element: any): number {
		return FileRenderer.ITEM_HEIGHT;
	}

	public getTemplateId(tree: ITree, element: any): string {
		return FileRenderer.FILE_TEMPLATE_ID;
	}

	public disposeTemplate(tree: ITree, templateId: string, templateData: IFileTemplateData): void {
		templateData.label.dispose();
	}

	public renderTemplate(tree: ITree, templateId: string, container: HTMLElement): IFileTemplateData {
		const label = this.instantiationService.createInstance(FileLabel, container, void 0);

		return { label, container };
	}

	public renderElement(tree: ITree, stat: FileStat, templateId: string, templateData: IFileTemplateData): void {
		templateData.label.element.style.display = 'block';
		const extraClasses = ['explorer-item', stat.isDirectory ? 'rospackage-name-folder-icon' : 'rosnode-name-file-icon'];
		templateData.label.setFile(stat.resource, { hidePath: true, isFolder: stat.isDirectory, extraClasses });
	}
}

// Explorer Controller
export class FileController extends DefaultController {
	private workspace: IWorkspace;

	constructor(
		private actionProvider: ActionProvider,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@ITelemetryService private telemetryService: ITelemetryService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService
	) {
		super({ clickBehavior: ClickBehavior.ON_MOUSE_UP /* do not change to not break DND */ });

		this.workspace = contextService.getWorkspace();
	}

	protected onLeftClick(tree: ITree, stat: FileStat, event: IMouseEvent, origin: string = 'mouse'): boolean {
		const payload = { origin: origin };
		const isDoubleClick = (origin === 'mouse' && event.detail === 2);

		// Handle Highlight Mode
		if (tree.getHighlight()) {

			// Cancel Event
			event.preventDefault();
			event.stopPropagation();

			tree.clearHighlight(payload);

			return false;
		}

		// Handle root
		if (this.workspace && stat.resource.toString() === this.workspace.resource.toString()) {
			tree.clearFocus(payload);
			tree.clearSelection(payload);

			return false;
		}

		// Cancel Event
		const isMouseDown = event && event.browserEvent && event.browserEvent.type === 'mousedown';
		if (!isMouseDown) {
			event.preventDefault(); // we cannot preventDefault onMouseDown because this would break DND otherwise
		}
		event.stopPropagation();

		// Set DOM focus
		tree.DOMFocus();

		// Expand / Collapse
		tree.toggleExpansion(stat);

		// Allow to unselect
		if (event.shiftKey && !(stat instanceof NewStatPlaceholder)) {
			const selection = tree.getSelection();
			if (selection && selection.length > 0 && selection[0] === stat) {
				tree.clearSelection(payload);
			}
		}

		// Select, Focus and open files
		else if (!(stat instanceof NewStatPlaceholder)) {
			const preserveFocus = !isDoubleClick;
			tree.setFocus(stat, payload);

			if (isDoubleClick) {
				event.preventDefault(); // focus moves to editor, we need to prevent default
			}

			tree.setSelection([stat], payload);

			if (!stat.isDirectory) {
				this.openEditor(stat, preserveFocus, event && (event.ctrlKey || event.metaKey), isDoubleClick);
			}
		}

		return true;
	}

	private openEditor(stat: FileStat, preserveFocus: boolean, sideBySide: boolean, pinned = false): void {
		if (stat && !stat.isDirectory) {
			this.telemetryService.publicLog('workbenchActionExecuted', { id: 'workbench.files.openFile', from: 'explorer' });

			this.editorService.openEditor({ resource: stat.resource, options: { preserveFocus, pinned } }, sideBySide).done(null, errors.onUnexpectedError);
		}
	}

	public onContextMenu(tree: ITree, stat: FileStat, event: ContextMenuEvent): boolean {
		if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === 'input') {
			return false;
		}

		event.preventDefault();
		event.stopPropagation();

		tree.setFocus(stat);

		if (!this.actionProvider.hasSecondaryActions(tree, stat)) {
			return true;
		}

		const anchor = { x: event.posx + 1, y: event.posy };
		this.contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => this.actionProvider.getSecondaryActions(tree, stat),
			onHide: (wasCancelled?: boolean) => {
				if (wasCancelled) {
					tree.DOMFocus();
				}
			}
		});

		return true;
	}
}

export class ActionProvider extends ContributableActionProvider {

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super();
	}

	public hasSecondaryActions(tree: ITree, element: any): boolean {
		return false;
	}

	public getSecondaryActions(tree: ITree, stat: FileStat): TPromise<IAction[]> {
		let actions: IAction[] = [];
		// context menu
		// if (!stat.isDirectory) {
		// 	actions.push(this.instantiationService.createInstance(StartAction, StartAction.ID, nls.localize('debugNode', "Debug Node")));
		// 	actions.push(this.instantiationService.createInstance(RunAction, RunAction.ID, nls.localize('runNode', "Run Node")));
		// }
		return TPromise.as(actions);
	}
}

// Explorer Accessibility Provider
export class FileAccessibilityProvider implements IAccessibilityProvider {

	public getAriaLabel(tree: ITree, stat: FileStat): string {
		return nls.localize('nodeExplorerViewerAriaLabel', "{0}, Nodes Explorer", stat.name);
	}
}

// Explorer Filter
export class FileFilter implements IFilter {

	public isVisible(tree: ITree, stat: FileStat): boolean {
		if (stat.isDirectory) {
			if (stat.name === 'pkgconfig' || stat.name === 'share' || /^python/.test(stat.name)) {
				return false;
			}
		} else {
			if (/\./.test(stat.name)) {
				return false;
			}
		}

		return true;
	}
}