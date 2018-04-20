/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/
'use strict';

import nls = require('vs/nls');
import { TPromise } from 'vs/base/common/winjs.base';
import { Builder, $ } from 'vs/base/browser/builder';
import URI from 'vs/base/common/uri';
import { ThrottledDelayer } from 'vs/base/common/async';
import errors = require('vs/base/common/errors');
import paths = require('vs/base/common/paths');
import { Action, IActionRunner, IAction } from 'vs/base/common/actions';
import { prepareActions } from 'vs/workbench/browser/actionBarRegistry';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IResolveFileOptions, FileChangeType, FileChangesEvent, IFileChange, IFileService } from 'vs/platform/files/common/files';
import { RefreshViewExplorerAction, CleanRosNodeAction } from 'vs/workbench/parts/files/browser/fileActions';
import { FileDataSource } from 'vs/workbench/parts/files/browser/views/explorerViewer';
import { FileRenderer, FileController, ActionProvider, FileAccessibilityProvider, FileFilter } from 'vs/workbench/parts/files/browser/views/rosNodeViewer';
import * as DOM from 'vs/base/browser/dom';
import { CollapseAction, CollapsibleViewletView } from 'vs/workbench/browser/viewlet';
import { FileStat } from 'vs/workbench/parts/files/common/explorerViewModel';
import { IListService } from 'vs/platform/list/browser/listService';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IWorkspaceContextService, IWorkspace } from 'vs/platform/workspace/common/workspace';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IMessageService, Severity } from 'vs/platform/message/common/message';
import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ResourceContextKey } from 'vs/workbench/common/resourceContextKey';
import { IWorkbenchThemeService, IFileIconTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';

export class RosNodeView extends CollapsibleViewletView {

	private static EXPLORER_FILE_CHANGES_REACT_DELAY = 500; // delay in ms to react to file changes to give our internal events a chance to react first
	private static EXPLORER_FILE_CHANGES_REFRESH_DELAY = 100; // delay in ms to refresh the explorer from disk file changes

	private workspace: IWorkspace;

	private rosNodeViewer: ITree;
	private filter: FileFilter;

	private explorerRefreshDelayer: ThrottledDelayer<void>;

	private resourceContext: ResourceContextKey;
	private folderContext: IContextKey<boolean>;

	private shouldRefresh: boolean;

	private autoReveal: boolean;

	private settings: any;

	private rootPath: string;
	private changeRoot: boolean;

	constructor(
		actionRunner: IActionRunner,
		settings: any,
		headerSize: number,
		@IMessageService messageService: IMessageService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IProgressService private progressService: IProgressService,
		@IListService private listService: IListService,
		@IFileService private fileService: IFileService,
		@IPartService private partService: IPartService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IWorkbenchThemeService private themeService: IWorkbenchThemeService
	) {
		super(actionRunner, false, nls.localize('rosNodeSection', "ROS Node Section"), messageService, keybindingService, contextMenuService, headerSize);

		this.workspace = contextService.getWorkspace();

		this.settings = settings;
		this.actionRunner = actionRunner;
		this.autoReveal = true;
		this.rootPath = 'devel/lib';
		this.changeRoot = false;

		this.explorerRefreshDelayer = new ThrottledDelayer<void>(RosNodeView.EXPLORER_FILE_CHANGES_REFRESH_DELAY);

		this.resourceContext = instantiationService.createInstance(ResourceContextKey);
		this.folderContext = new RawContextKey<boolean>('explorerResourceIsFolder', undefined).bindTo(contextKeyService);
	}

	public renderHeader(container: HTMLElement): void {
		const titleDiv = $('div.title').appendTo(container);
		$('span').text(nls.localize('node', "Node")).appendTo(titleDiv);

		super.renderHeader(container);
	}

	public renderBody(container: HTMLElement): void {
		this.treeContainer = super.renderViewTree(container);
		DOM.addClass(this.treeContainer, 'explorer-folders-view');
		DOM.addClass(this.treeContainer, 'show-file-icons');

		this.tree = this.createViewer($(this.treeContainer));

		if (this.toolBar) {
			this.toolBar.setActions(prepareActions(this.getActions()), [])();
		}

		const onFileIconThemeChange = (fileIconTheme: IFileIconTheme) => {
			DOM.toggleClass(this.treeContainer, 'align-icons-and-twisties', fileIconTheme.hasFileIcons && !fileIconTheme.hasFolderIcons);
		};

		this.themeService.onDidFileIconThemeChange(onFileIconThemeChange);
		onFileIconThemeChange(this.themeService.getFileIconTheme());
	}

	public getActions(): IAction[] {
		const actions: Action[] = [];

		actions.push(this.instantiationService.createInstance(CleanRosNodeAction, this, 'explorer-action clean-rosnode'));
		actions.push(this.instantiationService.createInstance(RefreshViewExplorerAction, this, 'explorer-action refresh-explorer'));
		actions.push(this.instantiationService.createInstance(CollapseAction, this.getViewer(), true, 'explorer-action collapse-explorer'));

		// Set Order
		for (let i = 0; i < actions.length; i++) {
			const action = actions[i];
			action.order = 10 * (i + 1);
		}

		return actions;
	}

	public create(): TPromise<void> {

		// Load and Fill Viewer
		return this.doRefresh();
	}

	public focusBody(): void {

		// Make sure the current selected element is revealed
		if (this.rosNodeViewer) {
			if (this.autoReveal) {
				const selection = this.rosNodeViewer.getSelection();
				if (selection.length > 0) {
					this.reveal(selection[0], 0.5).done(null, errors.onUnexpectedError);
				}
			}

			// Pass Focus to Viewer
			this.rosNodeViewer.DOMFocus();
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

				if (!this.autoReveal) {
					return refreshPromise; // do not react to setVisible call if autoReveal === false
				}

				// Return now if the workbench has not yet been created - in this case the workbench takes care of restoring last used editors
				if (!this.partService.isCreated()) {
					return TPromise.as(null);
				}

				// Otherwise restore last used file: By Explorer selection
				return refreshPromise;
			}
			return undefined;
		});
	}

	public getRootPath(): string {
		return this.rootPath;
	}

	public setRootPath(rootPath: string): TPromise<void> {
		if (this.rootPath === rootPath) {
			return null;
		}
		this.rootPath = rootPath;
		this.changeRoot = true;
		return this.refresh();
	}

	private get root(): FileStat {
		return this.rosNodeViewer ? (<FileStat>this.rosNodeViewer.getInput()) : null;
	}

	public createViewer(container: Builder): ITree {
		const dataSource = this.instantiationService.createInstance(FileDataSource);
		const actionProvider = this.instantiationService.createInstance(ActionProvider);
		const renderer = this.instantiationService.createInstance(FileRenderer);
		const controller = this.instantiationService.createInstance(FileController, actionProvider);
		this.filter = this.instantiationService.createInstance(FileFilter);
		const accessibilityProvider = this.instantiationService.createInstance(FileAccessibilityProvider);

		this.rosNodeViewer = new Tree(container.getHTMLElement(), {
			dataSource,
			renderer,
			controller,
			filter: this.filter,
			accessibilityProvider
		}, {
				autoExpandSingleChildren: true,
				ariaLabel: nls.localize('treeAriaLabel', "Nodes Explorer"),
				twistiePixels: 12,
				showTwistie: false,
				keyboardSupport: false
			});

		// Theme styler
		this.toDispose.push(attachListStyler(this.rosNodeViewer, this.themeService));

		// Update Viewer based on File Change Events
		this.toDispose.push(this.fileService.onFileChanges(e => this.onFileChanges(e)));

		// Update resource context based on focused element
		this.toDispose.push(this.rosNodeViewer.addListener('focus', (e: { focus: FileStat }) => {
			this.resourceContext.set(e.focus && e.focus.resource);
			this.folderContext.set(e.focus && e.focus.isDirectory);
		}));

		// Open when selecting via keyboard
		this.toDispose.push(this.rosNodeViewer.addListener('selection', event => {
			if (event && event.payload && event.payload.origin === 'keyboard') {
				const element = this.tree.getSelection();

				if (Array.isArray(element) && element[0] instanceof FileStat) {
					if (element[0].isDirectory) {
						this.rosNodeViewer.toggleExpansion(element[0]);
					}
				}
			}
		}));

		return this.rosNodeViewer;
	}

	public getOptimalWidth(): number {
		const parentNode = this.rosNodeViewer.getHTMLElement();
		const childNodes = [].slice.call(parentNode.querySelectorAll('.explorer-item > a'));

		return DOM.getLargestChildWidth(parentNode, childNodes);
	}

	private onFileChanges(e: FileChangesEvent): void {

		// Check if an explorer refresh is necessary (delayed to give internal events a chance to react first)
		// Note: there is no guarantee when the internal events are fired vs real ones. Code has to deal with the fact that one might
		// be fired first over the other or not at all.
		setTimeout(() => {
			if (!this.shouldRefresh && this.shouldRefreshFromEvent(e)) {
				this.refreshFromEvent();
			}
		}, RosNodeView.EXPLORER_FILE_CHANGES_REACT_DELAY);
	}

	private shouldRefreshFromEvent(e: FileChangesEvent): boolean {

		// Filter to the ones we care
		e = this.filterToAddRemovedOnWorkspacePath(e, (event, segments) => {
			if (segments[0] !== '.git') {
				return true; // we like all things outside .git
			}

			return segments.length === 1; // we only care about the .git folder itself
		});

		// We only ever refresh from files/folders that got added or deleted
		if (e.gotAdded() || e.gotDeleted()) {
			const added = e.getAdded();
			const deleted = e.getDeleted();

			if (!this.root) {
				return false;
			}

			// Check added: Refresh if added file/folder is not part of resolved root and parent is part of it
			const ignoredPaths: { [fsPath: string]: boolean } = <{ [fsPath: string]: boolean }>{};
			for (let i = 0; i < added.length; i++) {
				const change = added[i];
				if (!this.contextService.isInsideWorkspace(change.resource)) {
					continue; // out of workspace file
				}

				// Find parent
				const parent = paths.dirname(change.resource.fsPath);

				// Continue if parent was already determined as to be ignored
				if (ignoredPaths[parent]) {
					continue;
				}

				// Compute if parent is visible and added file not yet part of it
				const parentStat = this.root.find(URI.file(parent));
				if (parentStat && parentStat.isDirectoryResolved && !this.root.find(change.resource)) {
					return true;
				}

				// Keep track of path that can be ignored for faster lookup
				if (!parentStat || !parentStat.isDirectoryResolved) {
					ignoredPaths[parent] = true;
				}
			}

			// Check deleted: Refresh if deleted file/folder part of resolved root
			for (let j = 0; j < deleted.length; j++) {
				const del = deleted[j];
				if (!this.contextService.isInsideWorkspace(del.resource)) {
					continue; // out of workspace file
				}

				if (this.root.find(del.resource)) {
					return true;
				}
			}
		}

		return false;
	}

	private filterToAddRemovedOnWorkspacePath(e: FileChangesEvent, fn: (change: IFileChange, workspacePathSegments: string[]) => boolean): FileChangesEvent {
		return new FileChangesEvent(e.changes.filter(change => {
			if (change.type === FileChangeType.UPDATED) {
				return false; // we only want added / removed
			}

			const workspacePath = this.contextService.toWorkspaceRelativePath(change.resource);
			if (!workspacePath) {
				return false; // not inside workspace
			}

			const segments = workspacePath.split(/\//);

			return fn(change, segments);
		}));
	}

	private refreshFromEvent(): void {
		if (this.isVisible) {
			this.explorerRefreshDelayer.trigger(() => {
				if (!this.rosNodeViewer.getHighlight()) {
					return this.doRefresh();
				}

				return TPromise.as(null);
			}).done(null, errors.onUnexpectedError);
		} else {
			this.shouldRefresh = true;
		}
	}

	/**
	 * Refresh the contents of the explorer to get up to date data from the disk about the file structure.
	 */
	public refresh(): TPromise<void> {
		if (!this.rosNodeViewer || this.rosNodeViewer.getHighlight()) {
			return TPromise.as(null);
		}

		// Focus
		this.rosNodeViewer.DOMFocus();

		return this.doRefresh();
	}

	private doRefresh(): TPromise<void> {
		const root = this.changeRoot ? null : this.root;
		const targetsToResolve: URI[] = [];
		let targetsToExpand: URI[] = [];

		this.changeRoot = false;
		// First time refresh: Receive target through active editor input or selection and also include settings from previous session
		if (!root) {
			if (targetsToExpand.length) {
				targetsToResolve.push(...targetsToExpand);
			}
		}

		// Subsequent refresh: Receive targets through expanded folders in tree
		else {
			this.getResolvedDirectories(root, targetsToResolve);
		}

		// Load Root Stat with given target path configured
		const options: IResolveFileOptions = { resolveTo: targetsToResolve };
		const absRootPath: URI = URI.file(paths.join(this.workspace.resource.fsPath, this.rootPath));
		const promise = this.fileService.resolveFile(absRootPath, options).then(stat => {
			let explorerPromise: TPromise<void>;

			// Convert to model
			const modelStat = FileStat.create(stat, options.resolveTo);

			// First time refresh: The stat becomes the input of the viewer
			if (!root) {
				explorerPromise = this.rosNodeViewer.setInput(modelStat).then(() => {

					// Make sure to expand all folders that where expanded in the previous session
					if (targetsToExpand) {
						return this.rosNodeViewer.expandAll(targetsToExpand.map(expand => this.root.find(expand)));
					}

					return TPromise.as(null);
				});
			}

			// Subsequent refresh: Merge stat into our local model and refresh tree
			else {
				FileStat.mergeLocalWithDisk(modelStat, root);

				explorerPromise = this.rosNodeViewer.refresh(root);
			}

			return explorerPromise;
		}, (e: any) => TPromise.wrapError(e));

		this.progressService.showWhile(promise, this.partService.isCreated() ? 800 : 3200 /* less ugly initial startup */);

		return promise;
	}

	/**
	 * Given a stat, fills an array of path that make all folders below the stat that are resolved directories.
	 */
	private getResolvedDirectories(stat: FileStat, resolvedDirectories: URI[]): void {
		if (stat.isDirectoryResolved) {
			if (stat.resource.toString() !== this.workspace.resource.toString()) {

				// Drop those path which are parents of the current one
				for (let i = resolvedDirectories.length - 1; i >= 0; i--) {
					const resource = resolvedDirectories[i];
					if (stat.resource.toString().indexOf(resource.toString()) === 0) {
						resolvedDirectories.splice(i);
					}
				}

				// Add to the list of path to resolve
				resolvedDirectories.push(stat.resource);
			}

			// Recurse into children
			for (let i = 0; i < stat.children.length; i++) {
				const child = stat.children[i];
				this.getResolvedDirectories(child, resolvedDirectories);
			}
		}
	}

	/**
	 * Selects and reveal the file element provided by the given resource if its found in the explorer. Will try to
	 * resolve the path from the disk in case the explorer is not yet expanded to the file yet.
	 */
	public select(resource: URI, reveal: boolean = this.autoReveal): TPromise<void> {

		// Require valid path
		if (!resource || resource.toString() === this.workspace.resource.toString()) {
			return TPromise.as(null);
		}

		// If path already selected, just reveal and return
		const selection = this.hasSelection(resource);
		if (selection) {
			return reveal ? this.reveal(selection, 0.5) : TPromise.as(null);
		}

		// First try to get the stat object from the input to avoid a roundtrip
		const root = this.root;
		if (!root) {
			return TPromise.as(null);
		}

		const fileStat = root.find(resource);
		if (fileStat) {
			return this.doSelect(fileStat, reveal);
		}

		// Stat needs to be resolved first and then revealed
		const options: IResolveFileOptions = { resolveTo: [resource] };
		return this.fileService.resolveFile(this.workspace.resource, options).then(stat => {

			// Convert to model
			const modelStat = FileStat.create(stat, options.resolveTo);

			// Update Input with disk Stat
			FileStat.mergeLocalWithDisk(modelStat, root);

			// Select and Reveal
			return this.rosNodeViewer.refresh(root).then(() => this.doSelect(root.find(resource), reveal));

		}, (e: any) => this.messageService.show(Severity.Error, e));
	}

	private hasSelection(resource: URI): FileStat {
		const currentSelection: FileStat[] = this.rosNodeViewer.getSelection();

		for (let i = 0; i < currentSelection.length; i++) {
			if (currentSelection[i].resource.toString() === resource.toString()) {
				return currentSelection[i];
			}
		}

		return null;
	}

	private doSelect(fileStat: FileStat, reveal: boolean): TPromise<void> {
		if (!fileStat) {
			return TPromise.as(null);
		}

		// Special case: we are asked to reveal and select an element that is not visible
		// In this case we take the parent element so that we are at least close to it.
		if (!this.filter.isVisible(this.tree, fileStat)) {
			fileStat = fileStat.parent;
			if (!fileStat) {
				return TPromise.as(null);
			}
		}

		// Reveal depending on flag
		let revealPromise: TPromise<void>;
		if (reveal) {
			revealPromise = this.reveal(fileStat, 0.5);
		} else {
			revealPromise = TPromise.as(null);
		}

		return revealPromise.then(() => {
			if (!fileStat.isDirectory) {
				this.rosNodeViewer.setSelection([fileStat]); // Since folders can not be opened, only select files
			}

			this.rosNodeViewer.setFocus(fileStat);
		});
	}

	public dispose(): void {
		if (this.toolBar) {
			this.toolBar.dispose();
		}

		super.dispose();
	}
}