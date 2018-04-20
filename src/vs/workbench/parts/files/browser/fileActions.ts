/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/fileactions';
import { TPromise } from 'vs/base/common/winjs.base';
import nls = require('vs/nls');
import { isWindows, isLinux, isMacintosh } from 'vs/base/common/platform';
import { sequence, ITask } from 'vs/base/common/async';
import paths = require('vs/base/common/paths');
import URI from 'vs/base/common/uri';
import errors = require('vs/base/common/errors');
import { toErrorMessage } from 'vs/base/common/errorMessage';
import strings = require('vs/base/common/strings');
import { EventType as CommonEventType } from 'vs/base/common/events';
import severity from 'vs/base/common/severity';
import diagnostics = require('vs/base/common/diagnostics');
import { Action, IAction } from 'vs/base/common/actions';
import { MessageType, IInputValidator } from 'vs/base/browser/ui/inputbox/inputBox';
import { ITree, IHighlightEvent, IActionProvider } from 'vs/base/parts/tree/browser/tree';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { VIEWLET_ID } from 'vs/workbench/parts/files/common/files';
import labels = require('vs/base/common/labels');
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IFileService, IFileStat, isEqual, isEqualOrParent } from 'vs/platform/files/common/files';
import { toResource, IEditorIdentifier, EditorInput } from 'vs/workbench/common/editor';
import { FileStat, StatType, NewStatPlaceholder } from 'vs/workbench/parts/files/common/explorerViewModel';
import { ExplorerView } from 'vs/workbench/parts/files/browser/views/explorerView';
import { ExplorerViewlet } from 'vs/workbench/parts/files/browser/explorerViewlet';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { CollapseAction } from 'vs/workbench/browser/viewlet';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { IQuickOpenService, IFilePickOpenEntry, IPickOpenEntry } from 'vs/platform/quickOpen/common/quickOpen';
import { IHistoryService } from 'vs/workbench/services/history/common/history';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { Position, IResourceInput, IEditorInput, IUntitledResourceInput } from 'vs/platform/editor/common/editor';
import { IInstantiationService, IConstructorSignature2, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IMessageService, IMessageWithAction, IConfirmation, Severity, CancelAction } from 'vs/platform/message/common/message';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { getCodeEditor } from 'vs/editor/common/services/codeEditorService';
import { IEditorViewState } from 'vs/editor/common/editorCommon';
import { IBackupFileService } from 'vs/workbench/services/backup/common/backup';
import { IWindowsService, IWindowService } from 'vs/platform/windows/common/windows';
import { withFocussedFilesExplorer, revealInOSCommand, revealInExplorerCommand, copyPathCommand } from 'vs/workbench/parts/files/browser/fileCommands';
import { ITelemetryData } from 'vs/platform/telemetry/common/telemetry';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { ITerminalService } from 'vs/workbench/parts/terminal/common/terminal';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IRosService, IRosWinService } from 'vs/platform/ros/common/ros';
import { ICmakeService } from 'vs/platform/ros/common/cmake';
import { RosNodeView } from 'vs/workbench/parts/files/browser/views/rosNodeView';
import os = require('os');
import child_process = require('child_process');

export interface IEditableData {
	action: IAction;
	validator: IInputValidator;
}

export interface IFileViewletState {
	actionProvider: IActionProvider;
	getEditableData(stat: IFileStat): IEditableData;
	setEditable(stat: IFileStat, editableData: IEditableData): void;
	clearEditable(stat: IFileStat): void;
}

export class BaseFileAction extends Action {
	private _element: FileStat;

	constructor(
		id: string,
		label: string,
		@IFileService private _fileService: IFileService,
		@IMessageService private _messageService: IMessageService,
		@ITextFileService private _textFileService: ITextFileService
	) {
		super(id, label);

		this.enabled = false;
	}

	public get messageService() {
		return this._messageService;
	}

	public get fileService() {
		return this._fileService;
	}

	public get textFileService() {
		return this._textFileService;
	}

	public get element() {
		return this._element;
	}

	public set element(element: FileStat) {
		this._element = element;
	}

	_isEnabled(): boolean {
		return true;
	}

	_updateEnablement(): void {
		this.enabled = !!(this._fileService && this._isEnabled());
	}

	protected onError(error: any): void {
		this._messageService.show(Severity.Error, error);
	}

	protected onWarning(warning: any): void {
		this._messageService.show(Severity.Warning, warning);
	}

	protected onErrorWithRetry(error: any, retry: () => TPromise<any>, extraAction?: Action): void {
		const actions = [
			new Action(this.id, nls.localize('retry', "Retry"), null, true, () => retry()),
			CancelAction
		];

		if (extraAction) {
			actions.unshift(extraAction);
		}

		const errorWithRetry: IMessageWithAction = {
			actions,
			message: toErrorMessage(error, false)
		};

		this._messageService.show(Severity.Error, errorWithRetry);
	}

	protected isRosRootSrcFolder(stat: FileStat): boolean {
		return (stat.name === 'src' && stat.hasChild('CMakeLists.txt', false, StatType.FILE) && !stat.hasChild('package.xml', false, StatType.FILE));
	}

	protected isRosPackageFolder(stat: FileStat): boolean {
		// return (stat && stat.hasChild('CMakeLists.txt', false, StatType.FILE) && stat.hasChild('package.xml', false, StatType.FILE));
		return (stat && stat.isDirectory && stat.parent && this.isRosRootSrcFolder(stat.parent));	// 检查父目录是不是根src目录
	}
}

export class TriggerRenameFileAction extends BaseFileAction {

	public static ID = 'renameFile';

	private tree: ITree;
	private renameAction: BaseRenameAction;

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(TriggerRenameFileAction.ID, nls.localize('rename', "Rename"), fileService, messageService, textFileService);

		this.tree = tree;
		this.element = element;
		this.renameAction = instantiationService.createInstance(RenameFileAction, element);
		this._updateEnablement();
	}

	public validateFileName(parent: IFileStat, name: string): string {
		return this.renameAction.validateFileName(this.element.parent, name);
	}

	public run(context?: any): TPromise<any> {
		if (!context) {
			return TPromise.wrapError('No context provided to BaseEnableFileRenameAction.');
		}

		const viewletState = <IFileViewletState>context.viewletState;
		if (!viewletState) {
			return TPromise.wrapError('Invalid viewlet state provided to BaseEnableFileRenameAction.');
		}

		const stat = <IFileStat>context.stat;
		if (!stat) {
			return TPromise.wrapError('Invalid stat provided to BaseEnableFileRenameAction.');
		}

		viewletState.setEditable(stat, {
			action: this.renameAction,
			validator: (value) => {
				const message = this.validateFileName(this.element.parent, value);

				if (!message) {
					return null;
				}

				return {
					content: message,
					formatContent: true,
					type: MessageType.ERROR
				};
			}
		});

		this.tree.refresh(stat, false).then(() => {
			this.tree.setHighlight(stat);

			const unbind = this.tree.addListener(CommonEventType.HIGHLIGHT, (e: IHighlightEvent) => {
				if (!e.highlight) {
					viewletState.clearEditable(stat);
					this.tree.refresh(stat).done(null, errors.onUnexpectedError);
					unbind.dispose();
				}
			});
		}).done(null, errors.onUnexpectedError);

		return undefined;
	}
}

export abstract class BaseRenameAction extends BaseFileAction {

	constructor(
		id: string,
		label: string,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService
	) {
		super(id, label, fileService, messageService, textFileService);

		this.element = element;
	}

	public run(context?: any): TPromise<any> {
		if (!context) {
			return TPromise.wrapError('No context provided to BaseRenameFileAction.');
		}

		let name = <string>context.value;
		if (!name) {
			return TPromise.wrapError('No new name provided to BaseRenameFileAction.');
		}

		// Automatically trim whitespaces and trailing dots to produce nice file names
		name = getWellFormedFileName(name);
		const existingName = getWellFormedFileName(this.element.name);

		// Return early if name is invalid or didn't change
		if (name === existingName || this.validateFileName(this.element.parent, name)) {
			return TPromise.as(null);
		}

		// Call function and Emit Event through viewer
		const promise = this.runAction(name).then(null, (error: any) => {
			this.onError(error);
		});

		return promise;
	}

	public validateFileName(parent: IFileStat, name: string): string {
		let source = this.element.name;
		let target = name;

		if (!isLinux) { // allow rename of same file also when case differs (e.g. Game.js => game.js)
			source = source.toLowerCase();
			target = target.toLowerCase();
		}

		if (getWellFormedFileName(source) === getWellFormedFileName(target)) {
			return null;
		}

		return validateFileName(parent, name, false);
	}

	public abstract runAction(newName: string): TPromise<any>;
}

class RenameFileAction extends BaseRenameAction {

	public static ID = 'workbench.files.action.renameFile';

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IBackupFileService private backupFileService: IBackupFileService,
		@ICmakeService private cmakeService: ICmakeService
	) {
		super(RenameFileAction.ID, nls.localize('rename', "Rename"), element, fileService, messageService, textFileService);

		this._updateEnablement();
	}

	public runAction(newName: string): TPromise<any> {

		const oldName = this.element.name;
		const oldPath = this.element.resource.fsPath;
		const dirty = this.textFileService.getDirty().filter(d => isEqualOrParent(d.fsPath, this.element.resource.fsPath, !isLinux /* ignorecase */));
		const dirtyRenamed: URI[] = [];
		return TPromise.join(dirty.map(d => {

			const targetPath = paths.join(this.element.parent.resource.fsPath, newName);
			let renamed: URI;

			// If the dirty file itself got moved, just reparent it to the target folder
			if (isEqual(this.element.resource.fsPath, d.fsPath)) {
				renamed = URI.file(targetPath);
			}

			// Otherwise, a parent of the dirty resource got moved, so we have to reparent more complicated. Example:
			else {
				renamed = URI.file(paths.join(targetPath, d.fsPath.substr(this.element.resource.fsPath.length + 1)));
			}

			dirtyRenamed.push(renamed);

			const model = this.textFileService.models.get(d);

			return this.backupFileService.backupResource(renamed, model.getValue(), model.getVersionId());
		}))

			// 2. soft revert all dirty since we have backed up their contents
			.then(() => this.textFileService.revertAll(dirty, { soft: true /* do not attempt to load content from disk */ }))

			// 3.) run the rename operation
			.then(() => this.fileService.rename(this.element.resource, newName).then(null, (error: Error) => {
				return TPromise.join(dirtyRenamed.map(d => this.backupFileService.discardResourceBackup(d))).then(() => {
					this.onErrorWithRetry(error, () => this.runAction(newName));
				});
			}))

			// 3.5. 修改CmakeLists.txt
			.then(() => {
				if (!this.element.isDirectory && this.element.parent) {	// 从CMakeLists.txt中重命名文件名
					if (this.isRosPackageFolder(this.element.parent.parent)) {
						if (this.element.parent.name === 'src' && /\.cpp$/.test(oldName)) {
							const pkgPath = this.element.parent.parent.resource.fsPath;
							const relative = paths.relative(pkgPath, oldPath);
							const newRelative = paths.relative(pkgPath, this.element.resource.fsPath);
							this.cmakeService.renamePathName(pkgPath, relative, newRelative);
						} else if ((this.element.parent.name === 'msg' && /\.msg$/.test(oldName)) ||
							(this.element.parent.name === 'srv' && /\.srv$/.test(oldName)) ||
							(this.element.parent.name === 'action' && /\.action$/.test(oldName))) {
							const pkgPath = this.element.parent.parent.resource.fsPath;
							this.cmakeService.renamePathName(pkgPath, oldName, newName);
						}
					} else if (this.element.parent.parent && this.isRosPackageFolder(this.element.parent.parent.parent)) {
						if (this.element.parent.parent.name === 'include' && /\.h$/.test(oldName)) {
							const pkgPath = this.element.parent.parent.parent.resource.fsPath;
							const relative = paths.relative(pkgPath, oldPath);
							const newRelative = paths.relative(pkgPath, this.element.resource.fsPath);
							this.cmakeService.renamePathName(pkgPath, relative, newRelative);
						}
					}
				}
			})

			// 4.) resolve those that were dirty to load their previous dirty contents from disk
			.then(() => {
				return TPromise.join(dirtyRenamed.map(t => this.textFileService.models.loadOrCreate(t)));
			});
	}
}

/* Base New File/Folder Action */
export class BaseNewAction extends BaseFileAction {
	private presetFolder: FileStat;
	private tree: ITree;
	private isFile: boolean;
	private renameAction: BaseRenameAction;

	constructor(
		id: string,
		label: string,
		tree: ITree,
		isFile: boolean,
		editableAction: BaseRenameAction,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService
	) {
		super(id, label, fileService, messageService, textFileService);

		if (element) {
			this.presetFolder = element.isDirectory ? element : element.parent;
		}

		this.tree = tree;
		this.isFile = isFile;
		this.renameAction = editableAction;
	}

	public run(context?: any): TPromise<any> {
		if (!context) {
			return TPromise.wrapError('No context provided to BaseNewAction.');
		}

		const viewletState = <IFileViewletState>context.viewletState;
		if (!viewletState) {
			return TPromise.wrapError('Invalid viewlet state provided to BaseNewAction.');
		}

		let folder: FileStat = this.presetFolder;
		if (!folder) {
			const focus = <FileStat>this.tree.getFocus();
			if (focus) {
				folder = focus.isDirectory ? focus : focus.parent;
			} else {
				folder = this.tree.getInput();
			}
		}

		if (!folder) {
			return TPromise.wrapError('Invalid parent folder to create.');
		}

		return this.tree.reveal(folder, 0.5).then(() => {
			return this.tree.expand(folder).then(() => {
				const stat = NewStatPlaceholder.addNewStatPlaceholder(folder, !this.isFile);

				this.renameAction.element = stat;

				viewletState.setEditable(stat, {
					action: this.renameAction,
					validator: (value) => {
						const message = this.renameAction.validateFileName(folder, value);

						if (!message) {
							return null;
						}

						return {
							content: message,
							formatContent: true,
							type: MessageType.ERROR
						};
					}
				});

				return this.tree.refresh(folder).then(() => {
					return this.tree.expand(folder).then(() => {
						return this.tree.reveal(stat, 0.5).then(() => {
							this.tree.setHighlight(stat);

							const unbind = this.tree.addListener(CommonEventType.HIGHLIGHT, (e: IHighlightEvent) => {
								if (!e.highlight) {
									stat.destroy();
									this.tree.refresh(folder).done(null, errors.onUnexpectedError);
									unbind.dispose();
								}
							});
						});
					});
				});
			});
		});
	}
}

/* New File */
export class NewFileAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('explorer.newFile', nls.localize('newFile', "New File"), tree, true, instantiationService.createInstance(CreateFileAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-file';
		this._updateEnablement();
	}
}

/* New Folder */
export class NewFolderAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('explorer.newFolder', nls.localize('newFolder', "New Folder"), tree, false, instantiationService.createInstance(CreateFolderAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-folder';
		this._updateEnablement();
	}
}

export abstract class BaseGlobalNewAction extends Action {
	private toDispose: Action;

	constructor(
		id: string,
		label: string,
		@IViewletService private viewletService: IViewletService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IMessageService private messageService: IMessageService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return this.viewletService.openViewlet(VIEWLET_ID, true).then((viewlet) => {
			return TPromise.timeout(100).then(() => { // use a timeout to prevent the explorer from revealing the active file
				viewlet.focus();

				const explorer = <ExplorerViewlet>viewlet;
				const explorerView = explorer.getExplorerView();

				// Not having a folder opened
				if (!explorerView) {
					return this.messageService.show(Severity.Info, nls.localize('openFolderFirst', "Open a folder first to create files or folders within."));
				}

				if (!explorerView.isExpanded()) {
					explorerView.expand();
				}

				const action = this.toDispose = this.instantiationService.createInstance(this.getAction(), explorerView.getViewer(), null);

				return explorer.getActionRunner().run(action);
			});
		});
	}

	protected abstract getAction(): IConstructorSignature2<ITree, IFileStat, Action>;

	public dispose(): void {
		super.dispose();

		if (this.toDispose) {
			this.toDispose.dispose();
			this.toDispose = null;
		}
	}
}

/* Create new file from anywhere: Open untitled */
export class GlobalNewUntitledFileAction extends Action {
	public static ID = 'workbench.action.files.newUntitledFile';
	public static LABEL = nls.localize('newUntitledFile', "New Untitled File");

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return this.editorService.openEditor({ options: { pinned: true } } as IUntitledResourceInput); // untitled are always pinned
	}
}

/* Create new file from anywhere */
export class GlobalNewFileAction extends BaseGlobalNewAction {
	public static ID = 'explorer.newFile';
	public static LABEL = nls.localize('newFile', "New File");

	protected getAction(): IConstructorSignature2<ITree, IFileStat, Action> {
		return NewFileAction;
	}
}

/* Create new folder from anywhere */
export class GlobalNewFolderAction extends BaseGlobalNewAction {
	public static ID = 'explorer.newFolder';
	public static LABEL = nls.localize('newFolder', "New Folder");

	protected getAction(): IConstructorSignature2<ITree, IFileStat, Action> {
		return NewFolderAction;
	}
}

/* Create New File/Folder (only used internally by explorerViewer) */
export abstract class BaseCreateAction extends BaseRenameAction {

	public validateFileName(parent: IFileStat, name: string): string {
		if (this.element instanceof NewStatPlaceholder) {
			return validateFileName(parent, name, false);
		}

		return super.validateFileName(parent, name);
	}
}

/* Create New File (only used internally by explorerViewer) */
export class CreateFileAction extends BaseCreateAction {

	public static ID = 'workbench.files.action.createFileFromExplorer';
	public static LABEL = nls.localize('createNewFile', "New File");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService
	) {
		super(CreateFileAction.ID, CreateFileAction.LABEL, element, fileService, messageService, textFileService);

		this._updateEnablement();
	}

	public runAction(fileName: string): TPromise<any> {
		return this.fileService.createFile(URI.file(paths.join(this.element.parent.resource.fsPath, fileName))).then(stat => {
			return this.editorService.openEditor({ resource: stat.resource, options: { pinned: true } });
		}, (error) => {
			this.onErrorWithRetry(error, () => this.runAction(fileName));
		});
	}
}

/* Create New Folder (only used internally by explorerViewer) */
export class CreateFolderAction extends BaseCreateAction {

	public static ID = 'workbench.files.action.createFolderFromExplorer';
	public static LABEL = nls.localize('createNewFolder', "New Folder");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService
	) {
		super(CreateFolderAction.ID, CreateFolderAction.LABEL, null, fileService, messageService, textFileService);

		this._updateEnablement();
	}

	public runAction(fileName: string): TPromise<any> {
		return this.fileService.createFolder(URI.file(paths.join(this.element.parent.resource.fsPath, fileName))).then(null, (error) => {
			this.onErrorWithRetry(error, () => this.runAction(fileName));
		});
	}
}

export class BaseDeleteFileAction extends BaseFileAction {
	private tree: ITree;
	private useTrash: boolean;
	private skipConfirm: boolean;

	constructor(
		id: string,
		label: string,
		tree: ITree,
		element: FileStat,
		useTrash: boolean,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@ICmakeService private cmakeService: ICmakeService,
		@IRosService private rosService: IRosService
	) {
		super(id, label, fileService, messageService, textFileService);

		this.tree = tree;
		this.element = element;
		this.useTrash = useTrash && !paths.isUNC(element.resource.fsPath); // on UNC shares there is no trash

		this._updateEnablement();
	}

	public run(context?: any): TPromise<any> {

		// Remove highlight
		if (this.tree) {
			this.tree.clearHighlight();
		}

		// Read context
		if (context) {
			if (context.event) {
				const bypassTrash = (isMacintosh && context.event.altKey) || (!isMacintosh && context.event.shiftKey);
				if (bypassTrash) {
					this.useTrash = false;
				}
			} else if (typeof context.useTrash === 'boolean') {
				this.useTrash = context.useTrash;
			}
		}

		let primaryButton: string;
		if (this.useTrash) {
			primaryButton = isWindows ? nls.localize('deleteButtonLabelRecycleBin', "&&Move to Recycle Bin") : nls.localize({ key: 'deleteButtonLabelTrash', comment: ['&& denotes a mnemonic'] }, "&&Move to Trash");
		} else {
			primaryButton = nls.localize({ key: 'deleteButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Delete");
		}

		// Handle dirty
		let revertPromise: TPromise<any> = TPromise.as(null);
		const dirty = this.textFileService.getDirty().filter(d => isEqualOrParent(d.fsPath, this.element.resource.fsPath, !isLinux /* ignorecase */));
		if (dirty.length) {
			let message: string;
			if (this.element.isDirectory) {
				if (dirty.length === 1) {
					message = nls.localize('dirtyMessageFolderOneDelete', "You are deleting a folder with unsaved changes in 1 file. Do you want to continue?");
				} else {
					message = nls.localize('dirtyMessageFolderDelete', "You are deleting a folder with unsaved changes in {0} files. Do you want to continue?", dirty.length);
				}
			} else {
				message = nls.localize('dirtyMessageFileDelete', "You are deleting a file with unsaved changes. Do you want to continue?");
			}

			const res = this.messageService.confirm({
				message,
				type: 'warning',
				detail: nls.localize('dirtyWarning', "Your changes will be lost if you don't save them."),
				primaryButton
			});

			if (!res) {
				return TPromise.as(null);
			}

			this.skipConfirm = true; // since we already asked for confirmation
			revertPromise = this.textFileService.revertAll(dirty);
		}

		// Check if file is dirty in editor and save it to avoid data loss
		return revertPromise.then(() => {

			// Ask for Confirm
			if (!this.skipConfirm) {
				let confirm: IConfirmation;
				if (this.useTrash) {
					confirm = {
						message: this.element.isDirectory ? nls.localize('confirmMoveTrashMessageFolder', "Are you sure you want to delete '{0}' and its contents?", this.element.name) : nls.localize('confirmMoveTrashMessageFile', "Are you sure you want to delete '{0}'?", this.element.name),
						detail: isWindows ? nls.localize('undoBin', "You can restore from the recycle bin.") : nls.localize('undoTrash', "You can restore from the trash."),
						primaryButton
					};
				} else {
					confirm = {
						message: this.element.isDirectory ? nls.localize('confirmDeleteMessageFolder', "Are you sure you want to permanently delete '{0}' and its contents?", this.element.name) : nls.localize('confirmDeleteMessageFile', "Are you sure you want to permanently delete '{0}'?", this.element.name),
						detail: nls.localize('irreversible', "This action is irreversible!"),
						primaryButton
					};
				}

				if (!this.messageService.confirm(confirm)) {
					return TPromise.as(null);
				}
			}

			// Call function
			const servicePromise = this.fileService.del(this.element.resource, this.useTrash).then(() => {
				if (this.element.parent) {
					this.tree.setFocus(this.element.parent); // move focus to parent

					if (!this.element.isDirectory) {	// 从CMakeLists.txt中删除文件名
						if (this.isRosPackageFolder(this.element.parent.parent)) {
							if (this.element.parent.name === 'src' && /\.cpp$/.test(this.element.name)) {
								const pkgPath = this.element.parent.parent.resource.fsPath;
								const relative = paths.relative(pkgPath, this.element.resource.fsPath);
								this.cmakeService.delPathName(pkgPath, relative);
							} else if ((this.element.parent.name === 'msg' && /\.msg$/.test(this.element.name)) ||
								(this.element.parent.name === 'srv' && /\.srv$/.test(this.element.name)) ||
								(this.element.parent.name === 'action' && /\.action$/.test(this.element.name))) {
								const pkgPath = this.element.parent.parent.resource.fsPath;
								this.cmakeService.delPathName(pkgPath, this.element.name);
							}
						} else if (this.element.parent.parent && this.isRosPackageFolder(this.element.parent.parent.parent)) {
							if (this.element.parent.parent.name === 'include' && /\.h$/.test(this.element.name)) {
								const pkgPath = this.element.parent.parent.parent.resource.fsPath;
								const relative = paths.relative(pkgPath, this.element.resource.fsPath);
								this.cmakeService.delPathName(pkgPath, relative);
							}
						}
					} else if (this.isRosPackageFolder(this.element)) {	// 删除活动包状态
						this.rosService.delActivePkgNameFromCache(this.element.name).then(() =>
							this.rosService.getActivePkgNameCache().then((activePkgName) =>
								this.rosService.setActivePkgNameArgs(activePkgName)
							)
						);
					}
				}
			}, (error: any) => {

				// Allow to retry
				let extraAction: Action;
				if (this.useTrash) {
					extraAction = new Action('permanentDelete', nls.localize('permDelete', "Delete Permanently"), null, true, () => { this.useTrash = false; this.skipConfirm = true; return this.run(); });
				}

				this.onErrorWithRetry(error, () => this.run(), extraAction);

				// Focus back to tree
				this.tree.DOMFocus();
			});

			return servicePromise;
		});
	}
}

/* Move File/Folder to trash */
export class MoveFileToTrashAction extends BaseDeleteFileAction {
	public static ID = 'moveFileToTrash';

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@ICmakeService cmakeService: ICmakeService,
		@IRosService rosService: IRosService
	) {
		super(MoveFileToTrashAction.ID, nls.localize('delete', "Delete"), tree, element, true, fileService, messageService, textFileService, cmakeService, rosService);
	}
}

/* Import File */
export class ImportFileAction extends BaseFileAction {

	public static ID = 'workbench.files.action.importFile';
	private tree: ITree;

	constructor(
		tree: ITree,
		element: FileStat,
		clazz: string,
		@IFileService fileService: IFileService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService
	) {
		super(ImportFileAction.ID, nls.localize('importFiles', "Import Files"), fileService, messageService, textFileService);

		this.tree = tree;
		this.element = element;

		if (clazz) {
			this.class = clazz;
		}

		this._updateEnablement();
	}

	public getViewer(): ITree {
		return this.tree;
	}

	public run(context?: any): TPromise<any> {
		const importPromise = TPromise.as(null).then(() => {
			const input = context.input;
			if (input.files && input.files.length > 0) {

				// Find parent for import
				let targetElement: FileStat;
				if (this.element) {
					targetElement = this.element;
				} else {
					targetElement = this.tree.getFocus() || this.tree.getInput();
				}

				if (!targetElement.isDirectory) {
					targetElement = targetElement.parent;
				}

				// Create real files array
				const filesArray: File[] = [];
				for (let i = 0; i < input.files.length; i++) {
					const file = input.files[i];
					filesArray.push(file);
				}

				// Resolve target to check for name collisions and ask user
				return this.fileService.resolveFile(targetElement.resource).then((targetStat: IFileStat) => {

					// Check for name collisions
					const targetNames: { [name: string]: IFileStat } = {};
					targetStat.children.forEach((child) => {
						targetNames[isLinux ? child.name : child.name.toLowerCase()] = child;
					});

					let overwrite = true;
					if (filesArray.some((file) => {
						return !!targetNames[isLinux ? file.name : file.name.toLowerCase()];
					})) {
						const confirm: IConfirmation = {
							message: nls.localize('confirmOverwrite', "A file or folder with the same name already exists in the destination folder. Do you want to replace it?"),
							detail: nls.localize('irreversible', "This action is irreversible!"),
							primaryButton: nls.localize({ key: 'replaceButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Replace")
						};

						overwrite = this.messageService.confirm(confirm);
					}

					if (!overwrite) {
						return undefined;
					}

					// Run import in sequence
					const importPromisesFactory: ITask<TPromise<void>>[] = [];
					filesArray.forEach(file => {
						importPromisesFactory.push(() => {
							const sourceFile = URI.file(file.path);
							const targetFile = URI.file(paths.join(targetElement.resource.fsPath, paths.basename(file.path)));

							// if the target exists and is dirty, make sure to revert it. otherwise the dirty contents
							// of the target file would replace the contents of the imported file. since we already
							// confirmed the overwrite before, this is OK.
							let revertPromise = TPromise.as<any>(null);
							if (this.textFileService.isDirty(targetFile)) {
								revertPromise = this.textFileService.revertAll([targetFile], { soft: true });
							}

							return revertPromise.then(() => {
								return this.fileService.importFile(sourceFile, targetElement.resource).then(res => {

									// if we only import one file, just open it directly
									if (filesArray.length === 1) {
										this.editorService.openEditor({ resource: res.stat.resource, options: { pinned: true } }).done(null, errors.onUnexpectedError);
									}
								}, (error: any) => {
									this.messageService.show(Severity.Error, error);
								});
							});
						});
					});

					return sequence(importPromisesFactory);
				});
			}
			return undefined;
		});

		return importPromise.then(() => {
			this.tree.clearHighlight();
		}, (error: any) => {
			this.onError(error);
			this.tree.clearHighlight();
		});
	}
}

// Copy File/Folder
let fileToCopy: FileStat;
export class CopyFileAction extends BaseFileAction {

	public static ID = 'filesExplorer.copy';

	private tree: ITree;
	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService
	) {
		super(CopyFileAction.ID, nls.localize('copyFile', "Copy"), fileService, messageService, textFileService);

		this.tree = tree;
		this.element = element;
		this._updateEnablement();
	}

	public run(): TPromise<any> {

		// Remember as file/folder to copy
		fileToCopy = this.element;

		// Remove highlight
		if (this.tree) {
			this.tree.clearHighlight();
		}

		this.tree.DOMFocus();

		return TPromise.as(null);
	}
}

// Paste File/Folder
export class PasteFileAction extends BaseFileAction {

	public static ID = 'filesExplorer.paste';

	private tree: ITree;

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super(PasteFileAction.ID, nls.localize('pasteFile', "Paste"), fileService, messageService, textFileService);

		this.tree = tree;
		this.element = element || this.tree.getInput();
		this._updateEnablement();
	}

	_isEnabled(): boolean {

		// Need at least a file to copy
		if (!fileToCopy) {
			return false;
		}

		// Check if file was deleted or moved meanwhile
		const root: FileStat = this.tree.getInput();
		const exists = root.find(fileToCopy.resource);
		if (!exists) {
			fileToCopy = null;
			return false;
		}

		// Check if target is ancestor of pasted folder
		if (!isEqual(this.element.resource.fsPath, fileToCopy.resource.fsPath) && isEqualOrParent(this.element.resource.fsPath, fileToCopy.resource.fsPath, !isLinux /* ignorecase */)) {
			return false;
		}

		return true;
	}

	public run(): TPromise<any> {

		// Find target
		let target: FileStat;
		if (this.element.resource.toString() === fileToCopy.resource.toString()) {
			target = this.element.parent;
		} else {
			target = this.element.isDirectory ? this.element : this.element.parent;
		}

		// Reuse duplicate action
		const pasteAction = this.instantiationService.createInstance(DuplicateFileAction, this.tree, fileToCopy, target);

		return pasteAction.run().then(() => {
			this.tree.DOMFocus();
		});
	}
}

export const pasteIntoFocusedFilesExplorerViewItem = (accessor: ServicesAccessor) => {
	const instantiationService = accessor.get(IInstantiationService);

	withFocussedFilesExplorer(accessor).then(res => {
		if (res) {
			const pasteAction = instantiationService.createInstance(PasteFileAction, res.tree, res.tree.getFocus());
			if (pasteAction._isEnabled()) {
				pasteAction.run().done(null, errors.onUnexpectedError);
			}
		}
	});
};

// Duplicate File/Folder
export class DuplicateFileAction extends BaseFileAction {
	private tree: ITree;
	private target: IFileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		target: FileStat,
		@IFileService fileService: IFileService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService
	) {
		super('workbench.files.action.duplicateFile', nls.localize('duplicateFile', "Duplicate"), fileService, messageService, textFileService);

		this.tree = tree;
		this.element = element;
		this.target = (target && target.isDirectory) ? target : element.parent;
		this._updateEnablement();
	}

	public run(): TPromise<any> {

		// Remove highlight
		if (this.tree) {
			this.tree.clearHighlight();
		}

		// Copy File
		const result = this.fileService.copyFile(this.element.resource, this.findTarget()).then(stat => {
			if (!stat.isDirectory) {
				return this.editorService.openEditor({ resource: stat.resource, options: { pinned: true } });
			}
			return undefined;
		}, (error: any) => {
			this.onError(error);
		});

		return result;
	}

	public onError(error: any): void {
		this.messageService.show(Severity.Error, error);
	}

	private findTarget(): URI {
		const root: FileStat = this.tree.getInput();
		let name = this.element.name;

		let candidate = URI.file(paths.join(this.target.resource.fsPath, name));
		while (true) {
			if (!root.find(candidate)) {
				break;
			}

			name = this.toCopyName(name, this.element.isDirectory);
			candidate = URI.file(paths.join(this.target.resource.fsPath, name));
		}

		return candidate;
	}

	private toCopyName(name: string, isFolder: boolean): string {

		// file.1.txt=>file.2.txt
		if (!isFolder && name.match(/(.*\.)(\d+)(\..*)$/)) {
			return name.replace(/(.*\.)(\d+)(\..*)$/, (match, g1?, g2?, g3?) => { return g1 + (parseInt(g2) + 1) + g3; });
		}

		// file.txt=>file.1.txt
		const lastIndexOfDot = name.lastIndexOf('.');
		if (!isFolder && lastIndexOfDot >= 0) {
			return strings.format('{0}.1{1}', name.substr(0, lastIndexOfDot), name.substr(lastIndexOfDot));
		}

		// folder.1=>folder.2
		if (isFolder && name.match(/(\d+)$/)) {
			return name.replace(/(\d+)$/, (match: string, ...groups: any[]) => { return String(parseInt(groups[0]) + 1); });
		}

		// file/folder=>file.1/folder.1
		return strings.format('{0}.1', name);
	}
}

// Open to the side
export class OpenToSideAction extends Action {

	public static ID = 'explorer.openToSide';
	public static LABEL = nls.localize('openToSide', "Open to the Side");

	private tree: ITree;
	private resource: URI;
	private preserveFocus: boolean;

	constructor(
		tree: ITree,
		resource: URI,
		preserveFocus: boolean,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService
	) {
		super(OpenToSideAction.ID, OpenToSideAction.LABEL);

		this.tree = tree;
		this.preserveFocus = preserveFocus;
		this.resource = resource;

		this.updateEnablement();
	}

	private updateEnablement(): void {
		const activeEditor = this.editorService.getActiveEditor();
		this.enabled = (!activeEditor || activeEditor.position !== Position.THREE);
	}

	public run(): TPromise<any> {

		// Remove highlight
		this.tree.clearHighlight();

		// Set side input
		return this.editorService.openEditor({
			resource: this.resource,
			options: {
				preserveFocus: this.preserveFocus
			}
		}, true);
	}
}

let globalResourceToCompare: URI;
export class SelectResourceForCompareAction extends Action {
	private resource: URI;
	private tree: ITree;

	constructor(resource: URI, tree: ITree) {
		super('workbench.files.action.selectForCompare', nls.localize('compareSource', "Select for Compare"));

		this.tree = tree;
		this.resource = resource;
		this.enabled = true;
	}

	public run(): TPromise<any> {

		// Remember as source file to compare
		globalResourceToCompare = this.resource;

		// Remove highlight
		if (this.tree) {
			this.tree.clearHighlight();
			this.tree.DOMFocus();
		}

		return TPromise.as(null);
	}
}

// Global Compare with
export class GlobalCompareResourcesAction extends Action {

	public static ID = 'workbench.files.action.compareFileWith';
	public static LABEL = nls.localize('globalCompareFile', "Compare Active File With...");

	constructor(
		id: string,
		label: string,
		@IQuickOpenService private quickOpenService: IQuickOpenService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IHistoryService private historyService: IHistoryService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IMessageService private messageService: IMessageService,
		@IEnvironmentService private environmentService: IEnvironmentService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		const activeResource = toResource(this.editorService.getActiveEditorInput(), { filter: ['file', 'untitled'] });
		if (activeResource) {

			// Keep as resource to compare
			globalResourceToCompare = activeResource;

			// Pick another entry from history
			interface IHistoryPickEntry extends IFilePickOpenEntry {
				input: IEditorInput | IResourceInput;
			}

			const history = this.historyService.getHistory();
			const picks: IHistoryPickEntry[] = history.map(input => {
				let resource: URI;
				let label: string;
				let description: string;

				if (input instanceof EditorInput) {
					resource = toResource(input, { filter: ['file', 'untitled'] });
				} else {
					resource = (input as IResourceInput).resource;
				}

				if (!resource) {
					return void 0; // only support to compare with files and untitled
				}

				label = paths.basename(resource.fsPath);
				description = resource.scheme === 'file' ? labels.getPathLabel(paths.dirname(resource.fsPath), this.contextService, this.environmentService) : void 0;

				return <IHistoryPickEntry>{ input, resource, label, description };
			}).filter(p => !!p);

			return this.quickOpenService.pick(picks, { placeHolder: nls.localize('pickHistory', "Select a previously opened file to compare with"), autoFocus: { autoFocusFirstEntry: true }, matchOnDescription: true }).then(pick => {
				if (pick) {
					const compareAction = this.instantiationService.createInstance(CompareResourcesAction, pick.resource, null);
					if (compareAction._isEnabled()) {
						compareAction.run().done(() => compareAction.dispose());
					} else {
						this.messageService.show(Severity.Info, nls.localize('unableToFileToCompare', "The selected file can not be compared with '{0}'.", paths.basename(globalResourceToCompare.fsPath)));
					}
				}
			});
		} else {
			this.messageService.show(Severity.Info, nls.localize('openFileToCompare', "Open a file first to compare it with another file."));
		}

		return TPromise.as(true);
	}
}

// Compare with Resource
export class CompareResourcesAction extends Action {
	private tree: ITree;
	private resource: URI;

	constructor(
		resource: URI,
		tree: ITree,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService
	) {
		super('workbench.files.action.compareFiles', CompareResourcesAction.computeLabel());

		this.tree = tree;
		this.resource = resource;
	}

	private static computeLabel(): string {
		if (globalResourceToCompare) {
			return nls.localize('compareWith', "Compare with '{0}'", paths.basename(globalResourceToCompare.fsPath));
		}

		return nls.localize('compareFiles', "Compare Files");
	}

	public getLabel(): string {
		return CompareResourcesAction.computeLabel();
	}

	_isEnabled(): boolean {

		// Need at least a resource to compare
		if (!globalResourceToCompare) {
			return false;
		}

		// Check if file was deleted or moved meanwhile (explorer only)
		if (this.tree) {
			const root: FileStat = this.tree.getInput();
			if (root instanceof FileStat) {
				const exists = root.find(globalResourceToCompare);
				if (!exists) {
					globalResourceToCompare = null;
					return false;
				}
			}
		}

		// Check if target is identical to source
		if (this.resource.toString() === globalResourceToCompare.toString()) {
			return false;
		}

		return true;
	}

	public run(): TPromise<any> {

		// Remove highlight
		if (this.tree) {
			this.tree.clearHighlight();
		}

		return this.editorService.openEditor({
			leftResource: globalResourceToCompare,
			rightResource: this.resource
		});
	}
}

// Refresh Explorer Viewer
export class RefreshViewExplorerAction extends Action {

	constructor(explorerView: ExplorerView | RosNodeView, clazz: string) {
		super('workbench.files.action.refreshFilesExplorer', nls.localize('refresh', "Refresh"), clazz, true, (context: any) => explorerView.refresh());
	}
}

export abstract class BaseActionWithErrorReporting extends Action {
	constructor(
		id: string,
		label: string,
		private messageService: IMessageService
	) {
		super(id, label);
	}

	public run(context?: any): TPromise<boolean> {
		return this.doRun(context).then(() => true, (error) => {
			this.messageService.show(Severity.Error, toErrorMessage(error, false));
		});
	}

	protected abstract doRun(context?: any): TPromise<boolean>;
}

export abstract class BaseSaveFileAction extends BaseActionWithErrorReporting {
	private resource: URI;

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@ITextFileService private textFileService: ITextFileService,
		@IEditorGroupService private editorGroupService: IEditorGroupService,
		@IUntitledEditorService private untitledEditorService: IUntitledEditorService,
		@IMessageService messageService: IMessageService,
		@IRosService private rosService: IRosService
	) {
		super(id, label, messageService);

		this.enabled = true;
	}

	public abstract isSaveAs(): boolean;

	public setResource(resource: URI): void {
		this.resource = resource;
	}

	protected doRun(context: any): TPromise<boolean> {
		let source: URI;
		if (this.resource) {
			source = this.resource;
		} else {
			source = toResource(this.editorService.getActiveEditorInput(), { supportSideBySide: true, filter: ['file', 'untitled'] });
		}

		if (source) {

			// Save As (or Save untitled with associated path)
			if (this.isSaveAs() || source.scheme === 'untitled') {
				let encodingOfSource: string;
				if (source.scheme === 'untitled') {
					encodingOfSource = this.untitledEditorService.get(source).getEncoding();
				} else if (source.scheme === 'file') {
					const textModel = this.textFileService.models.get(source);
					encodingOfSource = textModel && textModel.getEncoding(); // text model can be null e.g. if this is a binary file!
				}

				let viewStateOfSource: IEditorViewState;
				const activeEditor = this.editorService.getActiveEditor();
				const editor = getCodeEditor(activeEditor);
				if (editor) {
					const activeResource = toResource(activeEditor.input, { supportSideBySide: true, filter: ['file', 'untitled'] });
					if (activeResource && activeResource.toString() === source.toString()) {
						viewStateOfSource = editor.saveViewState();
					}
				}

				// Special case: an untitled file with associated path gets saved directly unless "saveAs" is true
				let savePromise: TPromise<URI>;
				if (!this.isSaveAs() && source.scheme === 'untitled' && this.untitledEditorService.hasAssociatedFilePath(source)) {
					savePromise = this.textFileService.save(source).then((result) => {
						if (result) {
							return URI.file(source.fsPath);
						}

						return null;
					});
				}

				// Otherwise, really "Save As..."
				else {
					savePromise = this.textFileService.saveAs(source);
				}

				return savePromise.then((target) => {
					if (!target || target.toString() === source.toString()) {
						return undefined; // save canceled or same resource used
					}

					const replaceWith: IResourceInput = {
						resource: target,
						encoding: encodingOfSource,
						options: {
							pinned: true,
							viewState: viewStateOfSource
						}
					};

					return this.editorService.replaceEditors([{
						toReplace: { resource: source },
						replaceWith
					}]).then(() => true);
				});
			}

			// Pin the active editor if we are saving it
			if (!this.resource) {
				const editor = this.editorService.getActiveEditor();
				if (editor) {
					this.editorGroupService.pinEditor(editor.position, editor.input);
				}
			}

			// Just save
			return this.textFileService.save(source, { force: true /* force a change to the file to trigger external watchers if any */ }).then((result) => {
				if (result && /\/\.vscode\/.bashrc$/.test(source.fsPath)) {
					this.rosService.getRemoteArgsCache().then((remoteArgs) => {
						if (remoteArgs) {
							return new TPromise<void>((c, e) => {
								const execProc = child_process.exec(`scp -r ${source.fsPath} ${remoteArgs.user}@${remoteArgs.host}:/home/${remoteArgs.user}/.bashrc`, (err, stdout, stderr) => {
									if (err) {
										return e(err);
									}
								});
								execProc.on('exit', c);
								execProc.on('error', e);
							});
						}
						return null;
					});
				}
				return result;
			});
		}

		return TPromise.as(false);
	}
}

export class SaveFileAction extends BaseSaveFileAction {

	public static ID = 'workbench.action.files.save';
	public static LABEL = nls.localize('save', "Save");

	public isSaveAs(): boolean {
		return false;
	}
}

export class SaveFileAsAction extends BaseSaveFileAction {

	public static ID = 'workbench.action.files.saveAs';
	public static LABEL = nls.localize('saveAs', "Save As...");

	public isSaveAs(): boolean {
		return true;
	}
}

export abstract class BaseSaveAllAction extends BaseActionWithErrorReporting {
	private toDispose: IDisposable[];
	private lastIsDirty: boolean;

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService protected editorService: IWorkbenchEditorService,
		@IEditorGroupService private editorGroupService: IEditorGroupService,
		@ITextFileService private textFileService: ITextFileService,
		@IUntitledEditorService private untitledEditorService: IUntitledEditorService,
		@IMessageService messageService: IMessageService
	) {
		super(id, label, messageService);

		this.toDispose = [];
		this.lastIsDirty = this.textFileService.isDirty();
		this.enabled = this.lastIsDirty;

		this.registerListeners();
	}

	protected abstract getSaveAllArguments(context?: any): any;
	protected abstract includeUntitled(): boolean;

	private registerListeners(): void {

		// listen to files being changed locally
		this.toDispose.push(this.textFileService.models.onModelsDirty(e => this.updateEnablement(true)));
		this.toDispose.push(this.textFileService.models.onModelsSaved(e => this.updateEnablement(false)));
		this.toDispose.push(this.textFileService.models.onModelsReverted(e => this.updateEnablement(false)));
		this.toDispose.push(this.textFileService.models.onModelsSaveError(e => this.updateEnablement(true)));

		if (this.includeUntitled()) {
			this.toDispose.push(this.untitledEditorService.onDidChangeDirty(resource => this.updateEnablement(this.untitledEditorService.isDirty(resource))));
		}
	}

	private updateEnablement(isDirty: boolean): void {
		if (this.lastIsDirty !== isDirty) {
			this.enabled = this.textFileService.isDirty();
			this.lastIsDirty = this.enabled;
		}
	}

	protected doRun(context: any): TPromise<boolean> {
		const stacks = this.editorGroupService.getStacksModel();

		// Store some properties per untitled file to restore later after save is completed
		const mapUntitledToProperties: { [resource: string]: { encoding: string; indexInGroups: number[]; activeInGroups: boolean[] } } = Object.create(null);
		this.textFileService.getDirty()
			.filter(r => r.scheme === 'untitled')			// All untitled resources
			.map(r => this.untitledEditorService.get(r))	// Mapped to their inputs
			.filter(input => !!input)								// If possible :)
			.forEach(input => {
				mapUntitledToProperties[input.getResource().toString()] = {
					encoding: input.getEncoding(),
					indexInGroups: stacks.groups.map(g => g.indexOf(input)),
					activeInGroups: stacks.groups.map(g => g.isActive(input))
				};
			});

		// Save all
		return this.textFileService.saveAll(this.getSaveAllArguments(context)).then(results => {

			// Reopen saved untitled editors
			const untitledToReopen: { input: IResourceInput, position: Position }[] = [];

			results.results.forEach(result => {
				if (!result.success || result.source.scheme !== 'untitled') {
					return;
				}

				const untitledProps = mapUntitledToProperties[result.source.toString()];
				if (!untitledProps) {
					return;
				}

				// For each position where the untitled file was opened
				untitledProps.indexInGroups.forEach((indexInGroup, index) => {
					if (indexInGroup >= 0) {
						untitledToReopen.push({
							input: {
								resource: result.target,
								encoding: untitledProps.encoding,
								options: {
									pinned: true,
									index: indexInGroup,
									preserveFocus: true,
									inactive: !untitledProps.activeInGroups[index]
								}
							},
							position: index
						});
					}
				});
			});

			if (untitledToReopen.length) {
				return this.editorService.openEditors(untitledToReopen).then(() => true);
			}
			return undefined;
		});
	}

	public dispose(): void {
		this.toDispose = dispose(this.toDispose);

		super.dispose();
	}
}

export class SaveAllAction extends BaseSaveAllAction {

	public static ID = 'workbench.action.files.saveAll';
	public static LABEL = nls.localize('saveAll', "Save All");

	public get class(): string {
		return 'explorer-action save-all';
	}

	protected getSaveAllArguments(): boolean {
		return this.includeUntitled();
	}

	protected includeUntitled(): boolean {
		return true;
	}
}

export class SaveAllInGroupAction extends BaseSaveAllAction {

	public static ID = 'workbench.files.action.saveAllInGroup';
	public static LABEL = nls.localize('saveAllInGroup', "Save All in Group");

	public get class(): string {
		return 'explorer-action save-all';
	}

	protected getSaveAllArguments(editorIdentifier: IEditorIdentifier): any {
		if (!editorIdentifier) {
			return this.includeUntitled();
		}

		const editorGroup = editorIdentifier.group;
		const resourcesToSave: URI[] = [];
		editorGroup.getEditors().forEach(editor => {
			const resource = toResource(editor, { supportSideBySide: true, filter: ['file', 'untitled'] });
			if (resource) {
				resourcesToSave.push(resource);
			}
		});

		return resourcesToSave;
	}

	protected includeUntitled(): boolean {
		return true;
	}
}

export class SaveFilesAction extends BaseSaveAllAction {

	public static ID = 'workbench.action.files.saveFiles';
	public static LABEL = nls.localize('saveFiles', "Save Dirty Files");

	protected getSaveAllArguments(): boolean {
		return this.includeUntitled();
	}

	protected includeUntitled(): boolean {
		return false;
	}
}

export class RevertFileAction extends Action {

	public static ID = 'workbench.action.files.revert';
	public static LABEL = nls.localize('revert', "Revert File");

	private resource: URI;

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@ITextFileService private textFileService: ITextFileService
	) {
		super(id, label);

		this.enabled = true;
	}

	public setResource(resource: URI): void {
		this.resource = resource;
	}

	public run(): TPromise<any> {
		let resource: URI;
		if (this.resource) {
			resource = this.resource;
		} else {
			resource = toResource(this.editorService.getActiveEditorInput(), { supportSideBySide: true, filter: 'file' });
		}

		if (resource && resource.scheme !== 'untitled') {
			return this.textFileService.revert(resource, true /* force */);
		}

		return TPromise.as(true);
	}
}

export class FocusOpenEditorsView extends Action {

	public static ID = 'workbench.files.action.focusOpenEditorsView';
	public static LABEL = nls.localize({ key: 'focusOpenEditors', comment: ['Open is an adjective'] }, "Focus on Open Editors View");

	constructor(
		id: string,
		label: string,
		@IViewletService private viewletService: IViewletService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return this.viewletService.openViewlet(VIEWLET_ID, true).then((viewlet: ExplorerViewlet) => {
			const openEditorsView = viewlet.getOpenEditorsView();
			if (openEditorsView) {
				openEditorsView.expand();
				openEditorsView.getViewer().DOMFocus();
			}
		});
	}
}

export class FocusFilesExplorer extends Action {

	public static ID = 'workbench.files.action.focusFilesExplorer';
	public static LABEL = nls.localize('focusFilesExplorer', "Focus on Files Explorer");

	constructor(
		id: string,
		label: string,
		@IViewletService private viewletService: IViewletService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return this.viewletService.openViewlet(VIEWLET_ID, true).then((viewlet: ExplorerViewlet) => {
			const view = viewlet.getExplorerView();
			if (view) {
				view.expand();
				view.getViewer().DOMFocus();
			}
		});
	}
}

export class ShowActiveFileInExplorer extends Action {

	public static ID = 'workbench.files.action.showActiveFileInExplorer';
	public static LABEL = nls.localize('showInExplorer', "Reveal Active File in Side Bar");

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IMessageService private messageService: IMessageService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		const fileResource = toResource(this.editorService.getActiveEditorInput(), { supportSideBySide: true, filter: 'file' });
		if (fileResource) {
			this.instantiationService.invokeFunction.apply(this.instantiationService, [revealInExplorerCommand, fileResource]);
		} else {
			this.messageService.show(severity.Info, nls.localize('openFileToShow', "Open a file first to show it in the explorer"));
		}

		return TPromise.as(true);
	}
}

export class CollapseExplorerView extends Action {

	public static ID = 'workbench.files.action.collapseExplorerFolders';
	public static LABEL = nls.localize('collapseExplorerFolders', "Collapse Folders in Explorer");

	constructor(
		id: string,
		label: string,
		@IViewletService private viewletService: IViewletService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return this.viewletService.openViewlet(VIEWLET_ID, true).then((viewlet: ExplorerViewlet) => {
			const explorerView = viewlet.getExplorerView();
			if (explorerView) {
				const viewer = explorerView.getViewer();
				if (viewer) {
					const action = new CollapseAction(viewer, true, null);
					action.run().done();
					action.dispose();
				}
			}
		});
	}
}

export class RefreshExplorerView extends Action {

	public static ID = 'workbench.files.action.refreshFilesExplorer';
	public static LABEL = nls.localize('refreshExplorer', "Refresh Explorer");

	constructor(
		id: string,
		label: string,
		@IViewletService private viewletService: IViewletService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return this.viewletService.openViewlet(VIEWLET_ID, true).then((viewlet: ExplorerViewlet) => {
			const explorerView = viewlet.getExplorerView();
			if (explorerView) {
				explorerView.refresh();
			}
		});
	}
}

export class OpenFileAction extends Action {

	static ID = 'workbench.action.files.openFile';
	static LABEL = nls.localize('openFile', "Open File...");

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IWindowService private windowService: IWindowService
	) {
		super(id, label);
	}

	run(event?: any, data?: ITelemetryData): TPromise<any> {
		const fileResource = toResource(this.editorService.getActiveEditorInput(), { supportSideBySide: true, filter: 'file' });

		return this.windowService.openFilePicker(false, fileResource ? paths.dirname(fileResource.fsPath) : void 0, data);
	}
}

export class ShowOpenedFileInNewWindow extends Action {

	public static ID = 'workbench.action.files.showOpenedFileInNewWindow';
	public static LABEL = nls.localize('openFileInNewWindow', "Open Active File in New Window");

	constructor(
		id: string,
		label: string,
		@IWindowsService private windowsService: IWindowsService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IMessageService private messageService: IMessageService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		const fileResource = toResource(this.editorService.getActiveEditorInput(), { supportSideBySide: true, filter: 'file' });
		if (fileResource) {
			this.windowsService.openWindow([fileResource.fsPath], { forceNewWindow: true });
		} else {
			this.messageService.show(severity.Info, nls.localize('openFileToShowInNewWindow', "Open a file first to open in new window"));
		}

		return TPromise.as(true);
	}
}

export class RevealInOSAction extends Action {

	public static LABEL = isWindows ? nls.localize('revealInWindows', "Reveal in Explorer") : isMacintosh ? nls.localize('revealInMac', "Reveal in Finder") : nls.localize('openContainer', "Open Containing Folder");

	constructor(
		private resource: URI,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super('revealFileInOS', RevealInOSAction.LABEL);

		this.order = 45;
	}

	public run(): TPromise<any> {
		this.instantiationService.invokeFunction.apply(this.instantiationService, [revealInOSCommand, this.resource]);

		return TPromise.as(true);
	}
}

export class GlobalRevealInOSAction extends Action {

	public static ID = 'workbench.action.files.revealActiveFileInWindows';
	public static LABEL = isWindows ? nls.localize('revealActiveFileInWindows', "Reveal Active File in Windows Explorer") : (isMacintosh ? nls.localize('revealActiveFileInMac', "Reveal Active File in Finder") : nls.localize('openActiveFileContainer', "Open Containing Folder of Active File"));

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IMessageService private messageService: IMessageService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		this.instantiationService.invokeFunction.apply(this.instantiationService, [revealInOSCommand]);

		return TPromise.as(true);
	}
}

export class CopyPathAction extends Action {

	public static LABEL = nls.localize('copyPath', "Copy Path");

	constructor(
		private resource: URI,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super('copyFilePath', CopyPathAction.LABEL);

		this.order = 140;
	}

	public run(): TPromise<any> {
		this.instantiationService.invokeFunction.apply(this.instantiationService, [copyPathCommand, this.resource]);

		return TPromise.as(true);
	}
}

export class GlobalCopyPathAction extends Action {

	public static ID = 'workbench.action.files.copyPathOfActiveFile';
	public static LABEL = nls.localize('copyPathOfActive', "Copy Path of Active File");

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IEditorGroupService private editorGroupService: IEditorGroupService,
		@IMessageService private messageService: IMessageService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		this.instantiationService.invokeFunction.apply(this.instantiationService, [copyPathCommand]);

		return TPromise.as(true);
	}
}

/* Run Build Task */
export class RunBuildTaskAction extends Action {

	public static ID = 'workbench.files.action.runBuildTask';
	public static LABEL = nls.localize('runBuildTask', "Run Selected Build Task");

	constructor(
		id: string, label: string,
		@ICommandService private commandService: ICommandService
	) {
		super(id, label, 'explorer-viewlet run-build-task');
	}

	public run(): TPromise<any> {
		return this.commandService.executeCommand('workbench.action.tasks.build');
	}
}

/* Config Task */
export class ConfigureTaskAction extends Action {

	public static ID = 'workbench.files.action.configureTask';
	public static LABEL = nls.localize('configureTask', "Open tasks.json");

	constructor(
		id: string, label: string,
		@ICommandService private commandService: ICommandService
	) {
		super(id, label, 'explorer-viewlet configure-task');
	}

	public run(): TPromise<any> {
		return this.commandService.executeCommand('workbench.action.tasks.configureTaskRunner');
	}
}

/* Config Remote Task */
export class ConfigureRemoteTaskAction extends Action {

	public static ID = 'workbench.files.action.configureRemoteTask';
	public static LABEL = nls.localize('configureRemoteTask', "Configure Remote Arguments");

	constructor(
		id: string, label: string,
		@IRosService private rosService: IRosService,
		@IQuickOpenService private quickOpenService: IQuickOpenService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService
	) {
		super(id, label, 'explorer-viewlet configure-remote-task');
	}

	public run(): TPromise<any> {
		return this.quickOpenService.input({ prompt: nls.localize('inputAddress', 'Enter Address or IP of the remote host') }).then(host => {
			if (!host) {
				return null;
			}
			return TPromise.timeout(50).then(() => this.quickOpenService.input({ prompt: nls.localize('inputUser', 'Enter user name of the remote host') }).then(user => {
				if (!user) {
					return null;
				}
				return TPromise.timeout(50).then(() => this.quickOpenService.input({ value: paths.join(os.homedir(), '.ssh', 'id_rsa'), prompt: nls.localize('inputKeyfile', 'Enter absolute path of the local host private key') }).then(keyfile => {
					if (!keyfile) {
						return null;
					}
					return TPromise.timeout(50).then(() => this.quickOpenService.input({ value: `/home/${user}/${this.contextService.getWorkspace().name}`, prompt: nls.localize('inputCwd', 'Enter remote path of the ros workspace') }).then(cwd => {
						if (!cwd) {
							return null;
						}
						this.rosService.setRemoteTasksArgs(host, user, keyfile, cwd);
						this.rosService.setRemoteLaunchArgs(host, user, keyfile, cwd);
						this.rosService.setRemoteArgsToCache(host, user, keyfile, cwd);	// Put parameters in the file cache
						return null;
					}));
				}));
			}));
		});
	}
}

/* New ROS Workspace */
export class NewWorkspaceAction extends BaseActionWithErrorReporting {

	public static ID = 'workbench.action.files.newWorkspace';
	public static LABEL = nls.localize('newWorkspace', "New Workspace...");

	constructor(
		id: string,
		label: string,
		@IRosWinService private rosService: IRosWinService,
		@IMessageService messageService: IMessageService
	) {
		super(id, label, messageService);

		this.enabled = true;
	}

	protected doRun(context: any): TPromise<boolean> {
		this.rosService.newRosWs();
		return TPromise.as(true);
	}
}

/* Create New ROS Package (only used internally by explorerViewer) */
export class CreateRosPkgAction extends BaseCreateAction {

	public static ID = 'workbench.files.action.createRosPkgFromExplorer';
	public static LABEL = nls.localize('addRosPkg', "Add ROS Package");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IRosService private rosService: IRosService
	) {
		super(CreateRosPkgAction.ID, CreateRosPkgAction.LABEL, null, fileService, messageService, textFileService);

		this._updateEnablement();
	}

	public validateFileName(parent: IFileStat, name: string): string {
		if (!/^[a-z][a-z0-9_ ]*$/.test(name)) {	// Verify the ROS package name
			return nls.localize('rosPackageNameError', "ROS package name should start with a lower case letter and only contain lower case letters, digits, and underscores.");
		}

		return super.validateFileName(parent, name);
	}

	public runAction(fileName: string): TPromise<any> {
		return this.rosService.addRosPkg(fileName).then(null, (error) => {
			this.onErrorWithRetry(error, () => this.runAction(fileName));
		});
	}
}

/* Add ROS Package */
export class AddRosPkgAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('workbench.action.files.addRosPkg', nls.localize('addRosPkg', "Add ROS Package"), tree, false, instantiationService.createInstance(CreateRosPkgAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-folder';
		this._updateEnablement();
	}
}

/* Activate ROS Package */
export class ActivateRosPkgAction extends Action {

	private tree: ITree;
	protected element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@IRosService protected rosService: IRosService
	) {
		super('workbench.action.files.activateRosPkg', nls.localize('activateRosPkg', "Activate ROS Package"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {
		return this.rosService.addActivePkgNameToCache(this.element.name).then(() =>
			this.rosService.getActivePkgNameCache().then((activePkgName) =>
				this.rosService.setActivePkgNameArgs(activePkgName).then(() =>
					this.tree.refresh(this.element.parent)
				)
			)
		);
	}
}

/* Disactivate ROS Package */
export class DisactivateRosPkgAction extends Action {

	private tree: ITree;
	protected element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@IRosService protected rosService: IRosService
	) {
		super('workbench.action.files.disactivateRosPkg', nls.localize('disactivateRosPkg', "Disactivate ROS Package"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {
		return this.rosService.delActivePkgNameFromCache(this.element.name).then(() =>
			this.rosService.getActivePkgNameCache().then((activePkgName) =>
				this.rosService.setActivePkgNameArgs(activePkgName).then(() =>
					this.tree.refresh(this.element.parent)
				)
			)
		);
	}
}

/* Activate All ROS Package */
export class ActivateAllRosPkgAction extends Action {

	private tree: ITree;
	protected element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@IRosService protected rosService: IRosService
	) {
		super('workbench.action.files.activateAllRosPkg', nls.localize('activateAllRosPkg', "Activate All ROS Package"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {
		return this.rosService.cleanActivePkgNameFromCache().then(() =>
			this.rosService.setActivePkgNameArgs(null).then(() =>
				this.tree.refresh(this.element.parent)
			)
		);
	}
}

/* Add Folder */
export abstract class AddFolderAction extends Action {

	protected tree: ITree;
	protected element: FileStat;
	private folderName: string;

	constructor(
		id: string,
		label: string,
		tree: ITree,
		element: FileStat,
		folderName: string,
		@IFileService protected fileService: IFileService
	) {
		super(id, label);

		this.tree = tree;
		this.element = element;
		this.folderName = folderName;
	}

	public run(): TPromise<any> {
		return this.fileService.createFolder(URI.file(paths.join(this.element.resource.fsPath, this.folderName))).then(() =>
			this.tree.expand(this.element)
		);
	}
}

/* Add Include Folder */
export class AddIncludeFolderAction extends AddFolderAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IRosService private rosService: IRosService
	) {
		super('workbench.action.files.addIncludeFolder', nls.localize('addIncludeFolder', "Add Include Folder"), tree, element, 'include', fileService);
	}

	public run(): TPromise<any> {
		return super.run().then(() =>
			this.fileService.createFolder(URI.file(paths.join(this.element.resource.fsPath, 'include', this.element.name)))
		).then(() =>
			this.rosService.initRosWsYcmConf()
			);
	}
}

/* Add Src Folder */
export class AddSrcFolderAction extends AddFolderAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService
	) {
		super('workbench.action.files.addSrcFolder', nls.localize('addSrcFolder', "Add Src Folder"), tree, element, 'src', fileService);
	}
}

/* Add Msg Folder */
export class AddMsgFolderAction extends AddFolderAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService
	) {
		super('workbench.action.files.addMsgFolder', nls.localize('addMsgFolder', "Add Msg Folder"), tree, element, 'msg', fileService);
	}
}

/* Add Srv Folder */
export class AddSrvFolderAction extends AddFolderAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService
	) {
		super('workbench.action.files.addSrvFolder', nls.localize('addSrvFolder', "Add Srv Folder"), tree, element, 'srv', fileService);
	}
}

/* Add Action Folder */
export class AddActionFolderAction extends AddFolderAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService
	) {
		super('workbench.action.files.addActionFolder', nls.localize('addActionFolder', "Add Action Folder"), tree, element, 'action', fileService);
	}
}

/* Add Launch Folder */
export class AddLaunchFolderAction extends AddFolderAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService
	) {
		super('workbench.action.files.addLaunchFolder', nls.localize('addLaunchFolder', "Add Launch Folder"), tree, element, 'launch', fileService);
	}
}

/* Add Cfg Folder */
export class AddCfgFolderAction extends AddFolderAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService
	) {
		super('workbench.action.files.addCfgFolder', nls.localize('addCfgFolder', "Add Cfg Folder"), tree, element, 'cfg', fileService);
	}
}

/* Add C++ ROS Node */
export class AddCppNodeAction extends Action {

	private tree: ITree;
	protected element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@IQuickOpenService private quickOpenService: IQuickOpenService,
		@IRosService private rosService: IRosService,
		@ICmakeService private cmakeService: ICmakeService
	) {
		super('workbench.action.files.addCppNode', nls.localize('addCppRosNode', "Add C++ ROS Node"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {
		return this.quickOpenService.input({ prompt: nls.localize('inputNodeName', 'Enter the name of ROS Node') }).then(name => {
			if (!name) {
				return null;
			}
			return this.rosService.addCppNode(this.element.resource.fsPath, name).then(() =>
				this.cmakeService.addToFindPkg(this.element.resource.fsPath, 'roscpp')
			).then(() =>
				this.cmakeService.addToIncludeDir(this.element.resource.fsPath, 'include ${catkin_INCLUDE_DIRS}')
				).then(() =>
					this.cmakeService.addToNewLibOrExe(this.element.resource.fsPath, { name: `${name}_pub`, isLib: false }, `src/${name}_pub.cpp`)
				).then(() =>
					this.cmakeService.addToNewLibOrExe(this.element.resource.fsPath, { name: `${name}_sub`, isLib: false }, `src/${name}_sub.cpp`)
				);
		});
	}
}

/* Add Python ROS Node */
export class AddPythonNodeAction extends Action {

	private tree: ITree;
	protected element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@IQuickOpenService private quickOpenService: IQuickOpenService,
		@IRosService private rosService: IRosService
	) {
		super('workbench.action.files.addPythonNode', nls.localize('addPythonRosNode', "Add Python ROS Node"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {
		return this.quickOpenService.input({ prompt: nls.localize('inputNodeName', 'Enter the name of ROS Node') }).then(name => {
			if (!name) {
				return null;
			}
			return this.rosService.addPythonNode(this.element.resource.fsPath, name);
		});
	}
}

/* Add C++ Class */
export class AddCppClassAction extends Action {

	private tree: ITree;
	protected element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@IQuickOpenService private quickOpenService: IQuickOpenService,
		@IRosService private rosService: IRosService,
		@ICmakeService private cmakeService: ICmakeService
	) {
		super('workbench.action.files.addCppClass', nls.localize('addCppClass', "Add C++ Class"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {
		return this.quickOpenService.input({ prompt: nls.localize('inputCppClassName', 'Enter the name of C++ Class') }).then(name => {
			if (!name) {
				return null;
			}
			return this.cmakeService.getLibOrExeList(this.element.resource.fsPath).then((list) => {
				let picks: IPickOpenEntry[] = [];
				for (let i = 0; i < list.length; i++) {
					picks.push({ id: `${list[i].isLib ? 'lib' : 'exe'}-${i}`, label: list[i].name, description: list[i].isLib ? nls.localize('libFile', 'Library File') : nls.localize('exeFile', 'Executable File'), alwaysShow: true });
				}
				picks.push({ id: 'new-lib', label: nls.localize('addToLib', 'Add to new Library'), alwaysShow: true });
				picks.push({ id: 'new-exe', label: nls.localize('addToExe', 'Add to new Executable'), alwaysShow: true });

				const placeHolder = nls.localize('selectLibOrExe', "Select Library Or Executable");
				return this.quickOpenService.pick(picks, { placeHolder, ignoreFocusLost: true }).then(pick => {
					if (pick) {
						return this.rosService.addCppClass(this.element.resource.fsPath, this.element.name, name).then(() =>
							this.cmakeService.addToFindPkg(this.element.resource.fsPath, 'roscpp')
						).then(() =>
							this.cmakeService.addToIncludeDir(this.element.resource.fsPath, 'include ${catkin_INCLUDE_DIRS}')
							).then(() => {
								if (/^new/.test(pick.id)) {
									return this.cmakeService.addToNewLibOrExe(this.element.resource.fsPath, { name: name, isLib: /lib$/.test(pick.id) }, paths.join('src', `${name}.cpp`)).then(() =>
										this.cmakeService.addToLibOrExe(this.element.resource.fsPath, { name: name, isLib: /lib$/.test(pick.id) }, paths.join('include', this.element.name, `${name}.h`))
									);
								} else {
									return this.cmakeService.addToLibOrExe(this.element.resource.fsPath, { name: pick.label, isLib: /^lib/.test(pick.id) }, paths.join('src', `${name}.cpp`)).then(() =>
										this.cmakeService.addToLibOrExe(this.element.resource.fsPath, { name: pick.label, isLib: /^lib/.test(pick.id) }, paths.join('include', this.element.name, `${name}.h`))
									);
								}
							});
					}
					return null;
				});
			});
		});
	}
}

/* Edit ROS Package Dependencies */
export class EditRosPkgDepAction extends Action {

	private tree: ITree;
	protected element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@IQuickOpenService private quickOpenService: IQuickOpenService,
		@ICmakeService private cmakeService: ICmakeService
	) {
		super('workbench.action.files.editRosPkgDep', nls.localize('editRosPkgDep', "Edit ROS Package Dependencies"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {
		return this.cmakeService.getFindPkg(this.element.resource.fsPath).then((list) =>
			this.quickOpenService.input({ value: list.join(' '), prompt: nls.localize('editRosPkgDepList', 'Edit catkin ROS Package Dependencies list, Separated by space.') }).then(newValue => {
				if (!newValue) {
					return null;
				}
				const newList = newValue.trim().split(/\s+/);
				this.cmakeService.setBuildDepXml(this.element.resource.fsPath, list, newList);
				return this.cmakeService.setFindPkg(this.element.resource.fsPath, newList);
			})
		);
	}
}

/* Create New File, Auto Validate FileExt */
export abstract class CreateValidateExtAction extends BaseCreateAction {

	protected fileExt: string;

	constructor(
		id: string,
		label: string,
		element: FileStat,
		fileExt: string,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService
	) {
		super(id, label, element, fileService, messageService, textFileService);

		this.fileExt = fileExt;
		this._updateEnablement();
	}

	public validateFileName(parent: IFileStat, name: string): string {
		const regExp = new RegExp(`\\.${this.fileExt}`);
		if (!regExp.test(name)) {	// Automatically add the ext name.
			return super.validateFileName(parent, `${name}.${this.fileExt}`);
		}

		return super.validateFileName(parent, name);
	}

	public runAction(fileName: string): TPromise<any> {
		const regExp = new RegExp(`\\.${this.fileExt}`);
		if (!regExp.test(fileName)) {	// Automatically add the ext name.
			fileName = `${fileName}.${this.fileExt}`;
		}
		return this.doRunAction(fileName);
	}

	public abstract doRunAction(newName: string): TPromise<any>;
}

/* Create New Source File (only used internally by explorerViewer) */
export abstract class CreateSourceFileAction extends CreateValidateExtAction {

	protected pkgPath: string;

	constructor(
		id: string,
		label: string,
		element: FileStat,
		fileExt: string,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@ICmakeService protected cmakeService: ICmakeService,
		@IQuickOpenService private quickOpenService: IQuickOpenService
	) {
		super(id, label, element, fileExt, fileService, messageService, textFileService);

		this._updateEnablement();
	}

	public doRunAction(fileName: string): TPromise<any> {
		return this.cmakeService.getLibOrExeList(this.pkgPath).then((list) => {
			let picks: IPickOpenEntry[] = [];
			for (let i = 0; i < list.length; i++) {
				picks.push({ id: `${list[i].isLib ? 'lib' : 'exe'}-${i}`, label: list[i].name, description: list[i].isLib ? nls.localize('libFile', 'Library File') : nls.localize('exeFile', 'Executable File'), alwaysShow: true });
			}
			picks.push({ id: 'new-lib', label: nls.localize('addToLib', 'Add to new Library'), alwaysShow: true });
			picks.push({ id: 'new-exe', label: nls.localize('addToExe', 'Add to new Executable'), alwaysShow: true });

			const placeHolder = nls.localize('selectLibOrExe', "Select Library Or Executable");
			return this.quickOpenService.pick(picks, { placeHolder, ignoreFocusLost: true }).then(pick => {
				if (pick) {
					const newFilePath = paths.join(this.element.parent.resource.fsPath, fileName);
					const newRelative = paths.relative(this.pkgPath, newFilePath);
					if (/^new/.test(pick.id)) {
						return this.cmakeService.addToNewLibOrExe(this.pkgPath, { name: fileName.replace(`.${this.fileExt}`, ''), isLib: /lib$/.test(pick.id) }, newRelative).then(() =>
							this.fileService.createFile(URI.file(newFilePath))
						);
					} else {
						return this.cmakeService.addToLibOrExe(this.pkgPath, { name: pick.label, isLib: /^lib/.test(pick.id) }, newRelative).then(() =>
							this.fileService.createFile(URI.file(newFilePath))
						);
					}
				}
				return null;
			});
		});
	}
}

/* Create New Header File (only used internally by explorerViewer) */
export class CreateHeaderFileAction extends CreateSourceFileAction {

	public static ID = 'workbench.files.action.createHeaderFileFromExplorer';
	public static LABEL = nls.localize('addHeaderFile', "Add Header File");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@ICmakeService cmakeService: ICmakeService,
		@IQuickOpenService quickOpenService: IQuickOpenService
	) {
		super(CreateHeaderFileAction.ID, CreateHeaderFileAction.LABEL, element, 'h', fileService, messageService, textFileService, cmakeService, quickOpenService);
	}

	public runAction(fileName: string): TPromise<any> {
		this.pkgPath = this.element.parent.parent.parent.resource.fsPath;
		return this.cmakeService.addToIncludeDir(this.pkgPath, this.element.parent.parent.name).then(() =>
			super.runAction(fileName)
		);
	}
}

/* Add Header File */
export class AddHeaderFileAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('workbench.action.files.addHeaderFile', nls.localize('addHeaderFile', "Add Header File"), tree, true, instantiationService.createInstance(CreateHeaderFileAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-file';
		this._updateEnablement();
	}
}

/* Create New CPP File (only used internally by explorerViewer) */
export class CreateCppFileAction extends CreateSourceFileAction {

	public static ID = 'workbench.files.action.createCppFileFromExplorer';
	public static LABEL = nls.localize('addCppFile', "Add CPP File");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@ICmakeService cmakeService: ICmakeService,
		@IQuickOpenService quickOpenService: IQuickOpenService
	) {
		super(CreateCppFileAction.ID, CreateCppFileAction.LABEL, element, 'cpp', fileService, messageService, textFileService, cmakeService, quickOpenService);
	}

	public runAction(fileName: string): TPromise<any> {
		this.pkgPath = this.element.parent.parent.resource.fsPath;
		return this.cmakeService.addToFindPkg(this.pkgPath, 'roscpp').then(() =>
			this.cmakeService.addToIncludeDir(this.pkgPath, 'include ${catkin_INCLUDE_DIRS}')
		).then(() =>
			super.runAction(fileName)
			);
	}
}

/* Add CPP File */
export class AddCppFileAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('workbench.action.files.addCppFile', nls.localize('addCppFile', "Add CPP File"), tree, true, instantiationService.createInstance(CreateCppFileAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-file';
		this._updateEnablement();
	}
}

/* Create New Py File (only used internally by explorerViewer) */
export class CreatePyFileAction extends CreateValidateExtAction {

	public static ID = 'workbench.files.action.createPyFileFromExplorer';
	public static LABEL = nls.localize('addPyFile', "Add Py File");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService
	) {
		super(CreatePyFileAction.ID, CreatePyFileAction.LABEL, element, 'py', fileService, messageService, textFileService);
	}

	public doRunAction(fileName: string): TPromise<any> {
		return this.fileService.createFile(URI.file(paths.join(this.element.parent.resource.fsPath, fileName)));
	}
}

/* Add Py File */
export class AddPyFileAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('workbench.action.files.addPyFile', nls.localize('addPyFile', "Add Py File"), tree, true, instantiationService.createInstance(CreatePyFileAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-file';
		this._updateEnablement();
	}
}

/* Create New Msg File (only used internally by explorerViewer) */
export class CreateMsgFileAction extends CreateValidateExtAction {

	public static ID = 'workbench.files.action.createMsgFileFromExplorer';
	public static LABEL = nls.localize('addMsgFile', "Add Msg File");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@ICmakeService private cmakeService: ICmakeService
	) {
		super(CreateMsgFileAction.ID, CreateMsgFileAction.LABEL, element, 'msg', fileService, messageService, textFileService);
	}

	public doRunAction(fileName: string): TPromise<any> {
		const pkgPath: string = this.element.parent.parent.resource.fsPath;
		return this.cmakeService.addToMsgFiles(pkgPath, fileName).then(() =>
			this.cmakeService.addToMsgDepXml(pkgPath)
		).then(() =>
			this.fileService.createFile(URI.file(paths.join(this.element.parent.resource.fsPath, fileName)))
			);
	}
}

/* Add Msg File */
export class AddMsgFileAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('workbench.action.files.addMsgFile', nls.localize('addMsgFile', "Add Msg File"), tree, true, instantiationService.createInstance(CreateMsgFileAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-file';
		this._updateEnablement();
	}
}

/* Create New Srv File (only used internally by explorerViewer) */
export class CreateSrvFileAction extends CreateValidateExtAction {

	public static ID = 'workbench.files.action.createSrvFileFromExplorer';
	public static LABEL = nls.localize('addSrvFile', "Add Srv File");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@ICmakeService private cmakeService: ICmakeService
	) {
		super(CreateSrvFileAction.ID, CreateSrvFileAction.LABEL, element, 'srv', fileService, messageService, textFileService);
	}

	public doRunAction(fileName: string): TPromise<any> {
		const pkgPath: string = this.element.parent.parent.resource.fsPath;
		return this.cmakeService.addToSrvFiles(pkgPath, fileName).then(() =>
			this.cmakeService.addToMsgDepXml(pkgPath)
		).then(() =>
			this.fileService.createFile(URI.file(paths.join(this.element.parent.resource.fsPath, fileName)))
			);
	}
}

/* Add Srv File */
export class AddSrvFileAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('workbench.action.files.addSrvFile', nls.localize('addSrvFile', "Add Srv File"), tree, true, instantiationService.createInstance(CreateSrvFileAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-file';
		this._updateEnablement();
	}
}

/* Create New Action File (only used internally by explorerViewer) */
export class CreateActionFileAction extends CreateValidateExtAction {

	public static ID = 'workbench.files.action.createActionFileFromExplorer';
	public static LABEL = nls.localize('addActionFile', "Add Action File");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@ICmakeService private cmakeService: ICmakeService
	) {
		super(CreateActionFileAction.ID, CreateActionFileAction.LABEL, element, 'action', fileService, messageService, textFileService);
	}

	public doRunAction(fileName: string): TPromise<any> {
		const pkgPath: string = this.element.parent.parent.resource.fsPath;
		return this.cmakeService.addToActionFiles(pkgPath, fileName).then(() =>
			this.cmakeService.addToMsgDepXml(pkgPath)
		).then(() =>
			this.fileService.createFile(URI.file(paths.join(this.element.parent.resource.fsPath, fileName)))
			);
	}
}

/* Add Action File */
export class AddActionFileAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('workbench.action.files.addActionFile', nls.localize('addActionFile', "Add Action File"), tree, true, instantiationService.createInstance(CreateActionFileAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-file';
		this._updateEnablement();
	}
}

/* Create New Launch File (only used internally by explorerViewer) */
export class CreateLaunchFileAction extends CreateValidateExtAction {

	public static ID = 'workbench.files.action.createLaunchFileFromExplorer';
	public static LABEL = nls.localize('addLaunchFile', "Add Launch File");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@ICmakeService private cmakeService: ICmakeService
	) {
		super(CreateLaunchFileAction.ID, CreateLaunchFileAction.LABEL, element, 'launch', fileService, messageService, textFileService);
	}

	public doRunAction(fileName: string): TPromise<any> {
		return this.fileService.createFile(URI.file(paths.join(this.element.parent.resource.fsPath, fileName)));
	}
}

/* Add Launch File */
export class AddLaunchFileAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('workbench.action.files.addLaunchFile', nls.localize('addLaunchFile', "Add Launch File"), tree, true, instantiationService.createInstance(CreateLaunchFileAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-file';
		this._updateEnablement();
	}
}

/* Create New Cfg File (only used internally by explorerViewer) */
export class CreateCfgFileAction extends CreateValidateExtAction {

	public static ID = 'workbench.files.action.createCfgFileFromExplorer';
	public static LABEL = nls.localize('addCfgFile', "Add Cfg File");

	constructor(
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@ICmakeService private cmakeService: ICmakeService
	) {
		super(CreateCfgFileAction.ID, CreateCfgFileAction.LABEL, element, 'cfg', fileService, messageService, textFileService);
	}

	public doRunAction(fileName: string): TPromise<any> {
		return this.fileService.createFile(URI.file(paths.join(this.element.parent.resource.fsPath, fileName)));
	}
}

/* Add Cfg File */
export class AddCfgFileAction extends BaseNewAction {

	constructor(
		tree: ITree,
		element: FileStat,
		@IFileService fileService: IFileService,
		@IMessageService messageService: IMessageService,
		@ITextFileService textFileService: ITextFileService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('workbench.action.files.addCfgFile', nls.localize('addCfgFile', "Add Cfg File"), tree, true, instantiationService.createInstance(CreateCfgFileAction, element), null, fileService, messageService, textFileService);

		this.class = 'explorer-action new-file';
		this._updateEnablement();
	}
}

/* Run Launch File */
export class RunLaunchFileAction extends Action {

	private tree: ITree;
	private element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@ITerminalService private terminalService: ITerminalService
	) {
		super('workbench.action.files.runLaunchFile', nls.localize('runLaunchFile', "Run Launch File"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {

		// Remove highlight
		this.tree.clearHighlight();

		const terminal = this.terminalService.createInstance({ name: this.element.resource.fsPath, executable: 'bash' });
		terminal.sendText(`cd ${this.element.parent.resource.fsPath}\nroslaunch ${this.element.name}`, true);
		this.terminalService.setActiveInstance(terminal);
		return this.terminalService.showPanel(true);
	}
}

/* Run Remote Launch File */
export class RunRemoteLaunchFileAction extends Action {

	private tree: ITree;
	private element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@IRosService private rosService: IRosService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IMessageService private messageService: IMessageService,
		@ITerminalService private terminalService: ITerminalService
	) {
		super('workbench.action.files.runRemoteLaunchFile', nls.localize('runRemoteLaunchFile', "Run Remote Launch File"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {

		// Remove highlight
		this.tree.clearHighlight();

		return this.rosService.getRemoteArgsCache().then((remoteArgs) => {
			if (remoteArgs) {
				const launchDirPath = this.element.parent.resource.fsPath;
				const relative = paths.relative(this.contextService.getWorkspace().resource.fsPath, launchDirPath);
				const remotePath = paths.join(remoteArgs.cwd, relative);
				const terminal = this.terminalService.createInstance({ name: this.element.resource.fsPath, executable: 'bash', args: ['-c', `ssh ${remoteArgs.user}@${remoteArgs.host}`] });
				terminal.sendText(`cd ${remotePath}\nroslaunch ${this.element.name}`, true);
				this.terminalService.setActiveInstance(terminal);
				return this.terminalService.showPanel(true);
			} else {
				return this.messageService.show(Severity.Error, nls.localize('remoteArgsNotConfig', "Remote Arguments not configured!"));
			}
		});
	}
}

/* Play Bag File */
export class PlayBagFileAction extends Action {

	private tree: ITree;
	private element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@ITerminalService private terminalService: ITerminalService
	) {
		super('workbench.action.files.playBagFile', nls.localize('playBagFile', "Play Bag File"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {

		// Remove highlight
		this.tree.clearHighlight();

		const terminal = this.terminalService.createInstance({ name: this.element.resource.fsPath, executable: 'bash' });
		terminal.sendText(`rosbag play ${this.element.resource.fsPath}`, true);
		this.terminalService.setActiveInstance(terminal);
		return this.terminalService.showPanel(true);
	}
}

/* Loop Play Bag File */
export class LoopPlayBagFileAction extends Action {

	private tree: ITree;
	private element: FileStat;

	constructor(
		tree: ITree,
		element: FileStat,
		@ITerminalService private terminalService: ITerminalService
	) {
		super('workbench.action.files.loopPlayBagFile', nls.localize('loopPlayBagFile', "Loop Play Bag File"));

		this.tree = tree;
		this.element = element;
	}

	public run(): TPromise<any> {

		// Remove highlight
		this.tree.clearHighlight();

		const terminal = this.terminalService.createInstance({ name: this.element.resource.fsPath, executable: 'bash' });
		terminal.sendText(`rosbag play -l ${this.element.resource.fsPath}`, true);
		this.terminalService.setActiveInstance(terminal);
		return this.terminalService.showPanel(true);
	}
}

/* Clean Ros Node File */
export class CleanRosNodeAction extends Action {

	private rosNodeView: RosNodeView;

	constructor(
		rosNodeView: RosNodeView, clazz: string,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IFileService private fileService: IFileService,
		@IRosService private rosService: IRosService,
		@ITerminalService private terminalService: ITerminalService
	) {
		super('workbench.action.files.cleanRosNode', nls.localize('cleanRosNode', "Clean ROS Node"), clazz);
		this.rosNodeView = rosNodeView;
	}

	private cleanPath(path: string): TPromise<void> {
		const uriPath = URI.file(paths.join(this.contextService.getWorkspace().resource.fsPath, path));
		return this.fileService.resolveFile(uriPath, { resolveSingleChildDescendants: true }).then((dirStat) => {
			const modelDirStat = FileStat.create(dirStat);
			for (let i = 0; i < modelDirStat.children.length; i++) {
				this.fileService.del(modelDirStat.children[i].resource, false);
			}
		});
	}

	public run(): TPromise<any> {
		const rootPath = this.rosNodeView.getRootPath();
		switch (rootPath) {
			case 'devel/lib':
				this.fileService.del(URI.file(paths.join(this.contextService.getWorkspace().resource.fsPath, 'build')), false);
				break;
			case 'devel_isolated':
				this.fileService.del(URI.file(paths.join(this.contextService.getWorkspace().resource.fsPath, 'build_isolated')), false);
				break;
			case 'el/lib':
				this.rosService.getRemoteArgsCache().then((remoteArgs) => {
					if (remoteArgs) {
						const terminal = this.terminalService.createInstance({ name: 'Cleaning Remote ROS Node', executable: 'bash', args: ['-c', `ssh ${remoteArgs.user}@${remoteArgs.host} 'rm -rf ${remoteArgs.cwd}/build ${remoteArgs.cwd}/devel'`] });
						this.terminalService.setActiveInstance(terminal);
						return this.terminalService.showPanel(true);
					}
					return null;
				});
				break;
			case 'el_isolated':
				this.rosService.getRemoteArgsCache().then((remoteArgs) => {
					if (remoteArgs) {
						const terminal = this.terminalService.createInstance({ name: 'Cleaning Remote ROS Node', executable: 'bash', args: ['-c', `ssh ${remoteArgs.user}@${remoteArgs.host} 'rm -rf ${remoteArgs.cwd}/build_isolated ${remoteArgs.cwd}/devel_isolated'`] });
						this.terminalService.setActiveInstance(terminal);
						return this.terminalService.showPanel(true);
					}
					return null;
				});
				break;
		}
		return this.cleanPath(rootPath);
	}
}

export function validateFileName(parent: IFileStat, name: string, allowOverwriting: boolean = false): string {

	// Produce a well formed file name
	name = getWellFormedFileName(name);

	// Name not provided
	if (!name || name.length === 0 || /^\s+$/.test(name)) {
		return nls.localize('emptyFileNameError', "A file or folder name must be provided.");
	}

	// Do not allow to overwrite existing file
	if (!allowOverwriting) {
		if (parent.children && parent.children.some((c) => {
			if (isLinux) {
				return c.name === name;
			}

			return c.name.toLowerCase() === name.toLowerCase();
		})) {
			return nls.localize('fileNameExistsError', "A file or folder **{0}** already exists at this location. Please choose a different name.", name);
		}
	}

	// Invalid File name
	if (!paths.isValidBasename(name)) {
		return nls.localize('invalidFileNameError', "The name **{0}** is not valid as a file or folder name. Please choose a different name.", name);
	}

	// Max length restriction (on Windows)
	if (isWindows) {
		const fullPathLength = name.length + parent.resource.fsPath.length + 1 /* path segment */;
		if (fullPathLength > 255) {
			return nls.localize('filePathTooLongError', "The name **{0}** results in a path that is too long. Please choose a shorter name.", name);
		}
	}

	return null;
}

export function getWellFormedFileName(filename: string): string {
	if (!filename) {
		return filename;
	}

	// Trim whitespaces
	filename = strings.trim(strings.trim(filename, ' '), '\t');

	// Remove trailing dots
	filename = strings.rtrim(filename, '.');

	return filename;
}

// Diagnostics support
let diag: (...args: any[]) => void;
if (!diag) {
	diag = diagnostics.register('FileActionsDiagnostics', function (...args: any[]) {
		console.log(args[1] + ' - ' + args[0] + ' (time: ' + args[2].getTime() + ' [' + args[2].toUTCString() + '])');
	});
}
