/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import nls = require('vs/nls');
import { Registry } from 'vs/platform/platform';
import { Action, IAction } from 'vs/base/common/actions';
import { isMacintosh } from 'vs/base/common/platform';
import { ActionItem, BaseActionItem, Separator } from 'vs/base/browser/ui/actionbar/actionbar';
import { Scope, IActionBarRegistry, Extensions as ActionBarExtensions, ActionBarContributor } from 'vs/workbench/browser/actionBarRegistry';
import { GlobalNewUntitledFileAction, SaveFileAsAction, OpenFileAction, ShowOpenedFileInNewWindow, CopyPathAction, GlobalCopyPathAction, RevealInOSAction, GlobalRevealInOSAction, pasteIntoFocusedFilesExplorerViewItem, FocusOpenEditorsView, FocusFilesExplorer, GlobalCompareResourcesAction, GlobalNewFileAction, GlobalNewFolderAction, RevertFileAction, SaveFilesAction, SaveAllAction, SaveFileAction, MoveFileToTrashAction, TriggerRenameFileAction, PasteFileAction, CopyFileAction, SelectResourceForCompareAction, CompareResourcesAction, NewFolderAction, NewFileAction, OpenToSideAction, ShowActiveFileInExplorer, CollapseExplorerView, RefreshExplorerView, NewWorkspaceAction, AddRosPkgAction, ActivateRosPkgAction, DisactivateRosPkgAction, ActivateAllRosPkgAction, AddIncludeFolderAction, AddSrcFolderAction, AddMsgFolderAction, AddSrvFolderAction, AddActionFolderAction, AddLaunchFolderAction, AddCfgFolderAction, AddCppNodeAction, AddPythonNodeAction, AddCppClassAction, EditRosPkgDepAction, AddHeaderFileAction, AddCppFileAction, AddPyFileAction, AddMsgFileAction, AddSrvFileAction, AddActionFileAction, AddLaunchFileAction, AddCfgFileAction, RunLaunchFileAction, RunRemoteLaunchFileAction, PlayBagFileAction, LoopPlayBagFileAction } from 'vs/workbench/parts/files/browser/fileActions';
import { revertLocalChangesCommand, acceptLocalChangesCommand, CONFLICT_RESOLUTION_CONTEXT } from 'vs/workbench/parts/files/browser/saveErrorHandler';
import { SyncActionDescriptor, MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actionRegistry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IRosService } from 'vs/platform/ros/common/ros';
import { FileStat, StatType } from 'vs/workbench/parts/files/common/explorerViewModel';
import { KeyMod, KeyChord, KeyCode } from 'vs/base/common/keyCodes';
import { OpenFolderAction, OpenFileFolderAction } from 'vs/workbench/browser/actions/fileActions';
import { copyFocusedFilesExplorerViewItem, revealInOSFocusedFilesExplorerItem, openFocusedExplorerItemSideBySideCommand, copyPathOfFocusedExplorerItem, copyPathCommand, revealInExplorerCommand, revealInOSCommand, openFolderPickerCommand, openWindowCommand, openFileInNewWindowCommand, deleteFocusedFilesExplorerViewItemCommand, moveFocusedFilesExplorerViewItemToTrashCommand, renameFocusedFilesExplorerViewItemCommand } from 'vs/workbench/parts/files/browser/fileCommands';
import { CommandsRegistry, ICommandHandler } from 'vs/platform/commands/common/commands';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { KeybindingsRegistry } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { explorerItemToFileResource, ExplorerFocusCondition, FilesExplorerFocusCondition } from 'vs/workbench/parts/files/common/files';

class FilesViewerActionContributor extends ActionBarContributor {

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IKeybindingService private keybindingService: IKeybindingService,
		@IRosService private rosService: IRosService
	) {
		super();
	}

	public hasSecondaryActions(context: any): boolean {
		const element = context.element;

		// Contribute only on Stat Objects (File Explorer)
		return element instanceof FileStat;
	}

	private isRosRootSrcFolder(stat: FileStat): boolean {
		return (stat.name === 'src' && stat.hasChild('CMakeLists.txt', false, StatType.FILE) && !stat.hasChild('package.xml', false, StatType.FILE));
	}

	private isRosPackageFolder(stat: FileStat): boolean {
		// return (stat && stat.hasChild('CMakeLists.txt', false, StatType.FILE) && stat.hasChild('package.xml', false, StatType.FILE));
		return (stat && stat.isDirectory && stat.parent && this.isRosRootSrcFolder(stat.parent));	// Check whether the parent directory is a root src directory
	}

	public getSecondaryActions(context: any): IAction[] {
		const stat = (<FileStat>context.element);
		const tree = context.viewer;
		const actions: IAction[] = [];

		// Open side by side
		if (!stat.isDirectory) {	// Compare Files (of same extension)
			// Run Launch File
			if (/\.launch$/.test(stat.name)) {
				actions.push(this.instantiationService.createInstance(RunLaunchFileAction, tree, stat));
				actions.push(this.instantiationService.createInstance(RunRemoteLaunchFileAction, tree, stat));
			}
			// Play Bag File
			if (/\.bag$/.test(stat.name)) {
				actions.push(this.instantiationService.createInstance(PlayBagFileAction, tree, stat));
				actions.push(this.instantiationService.createInstance(LoopPlayBagFileAction, tree, stat));
			}

			actions.push(this.instantiationService.createInstance(OpenToSideAction, tree, stat.resource, false));
			actions.push(new Separator(null, 50));

			// Run Compare
			const runCompareAction = this.instantiationService.createInstance(CompareResourcesAction, stat.resource, tree);
			if (runCompareAction._isEnabled()) {
				actions.push(runCompareAction);
			}

			// Select for Compare
			actions.push(this.instantiationService.createInstance(SelectResourceForCompareAction, stat.resource, tree));
			actions.push(new Separator(null, 100));
		} else {	// Directory Actions
			if (this.isRosRootSrcFolder(stat)) {	// Whether stat is a root src directory
				// Add ROS Package
				actions.push(this.instantiationService.createInstance(AddRosPkgAction, tree, <FileStat>stat));
			} else if (this.isRosPackageFolder(stat)) {	// Whether stat is a package directory
				const activePkgName = this.rosService.getActivePkgNameCacheSync();
				if (activePkgName && activePkgName.indexOf(stat.name) >= 0) {
					// Disactivate ROS Package
					actions.push(this.instantiationService.createInstance(DisactivateRosPkgAction, tree, <FileStat>stat));
				} else {
					// Activate ROS Package
					actions.push(this.instantiationService.createInstance(ActivateRosPkgAction, tree, <FileStat>stat));
				}
				// Disactivate All ROS Package
				actions.push(this.instantiationService.createInstance(ActivateAllRosPkgAction, tree, <FileStat>stat));
				actions.push(new Separator(null, 20));
				// Add Include Folder
				if (!stat.hasChild('include', false, StatType.ANY)) {
					actions.push(this.instantiationService.createInstance(AddIncludeFolderAction, tree, <FileStat>stat));
				}
				// Add Src Folder
				if (!stat.hasChild('src', false, StatType.ANY)) {
					actions.push(this.instantiationService.createInstance(AddSrcFolderAction, tree, <FileStat>stat));
				}
				// Add Msg Folder
				if (!stat.hasChild('msg', false, StatType.ANY)) {
					actions.push(this.instantiationService.createInstance(AddMsgFolderAction, tree, <FileStat>stat));
				}
				// Add Srv Folder
				if (!stat.hasChild('srv', false, StatType.ANY)) {
					actions.push(this.instantiationService.createInstance(AddSrvFolderAction, tree, <FileStat>stat));
				}
				// Add Action Folder
				if (!stat.hasChild('action', false, StatType.ANY)) {
					actions.push(this.instantiationService.createInstance(AddActionFolderAction, tree, <FileStat>stat));
				}
				// Add Launch Folder
				if (!stat.hasChild('launch', false, StatType.ANY)) {
					actions.push(this.instantiationService.createInstance(AddLaunchFolderAction, tree, <FileStat>stat));
				}
				// Add Cfg Folder
				if (!stat.hasChild('cfg', false, StatType.ANY)) {
					actions.push(this.instantiationService.createInstance(AddCfgFolderAction, tree, <FileStat>stat));
				}
				actions.push(new Separator(null, 30));
				actions.push(this.instantiationService.createInstance(AddCppNodeAction, tree, <FileStat>stat));
				actions.push(this.instantiationService.createInstance(AddPythonNodeAction, tree, <FileStat>stat));
				actions.push(this.instantiationService.createInstance(AddCppClassAction, tree, <FileStat>stat));
				actions.push(new Separator(null, 35));
				actions.push(this.instantiationService.createInstance(EditRosPkgDepAction, tree, <FileStat>stat));
				actions.push(new Separator(null, 40));
			} else if (this.isRosPackageFolder(stat.parent)) {	// Whether the parent of stat is a package directory
				switch (stat.name) {
					case 'src':	// Add CPP&PY File
						actions.push(this.instantiationService.createInstance(AddCppFileAction, tree, <FileStat>stat));
						actions.push(this.instantiationService.createInstance(AddPyFileAction, tree, <FileStat>stat));
						break;
					case 'msg':	// Add MSG File
						actions.push(this.instantiationService.createInstance(AddMsgFileAction, tree, <FileStat>stat));
						break;
					case 'srv':	// Add SRV File
						actions.push(this.instantiationService.createInstance(AddSrvFileAction, tree, <FileStat>stat));
						break;
					case 'action':	// Add ACTION File
						actions.push(this.instantiationService.createInstance(AddActionFileAction, tree, <FileStat>stat));
						break;
					case 'launch':	// Add LAUNCH File
						actions.push(this.instantiationService.createInstance(AddLaunchFileAction, tree, <FileStat>stat));
						break;
					case 'cfg':	// Add CFG File
						actions.push(this.instantiationService.createInstance(AddCfgFileAction, tree, <FileStat>stat));
						break;
				}
			} else if (stat.parent && this.isRosPackageFolder(stat.parent.parent)) {	// Whether stat.parent.parent is a package directory
				switch (stat.parent.name) {
					case 'include':	// Add Header File
						actions.push(this.instantiationService.createInstance(AddHeaderFileAction, tree, <FileStat>stat));
						break;
				}
			}

			// New File
			actions.push(this.instantiationService.createInstance(NewFileAction, tree, <FileStat>stat));

			// New Folder
			actions.push(this.instantiationService.createInstance(NewFolderAction, tree, <FileStat>stat));
			actions.push(new Separator(null, 50));
		}

		const workspace = this.contextService.getWorkspace();
		const isRoot = workspace && stat.resource.toString() === workspace.resource.toString();

		// Copy File/Folder
		if (!isRoot) {
			actions.push(this.instantiationService.createInstance(CopyFileAction, tree, <FileStat>stat));
		}

		// Paste File/Folder
		if (stat.isDirectory) {
			actions.push(this.instantiationService.createInstance(PasteFileAction, tree, <FileStat>stat));
		}

		// Rename File/Folder
		if (!isRoot) {
			actions.push(new Separator(null, 150));
			actions.push(this.instantiationService.createInstance(TriggerRenameFileAction, tree, <FileStat>stat));

			// Delete File/Folder
			actions.push(this.instantiationService.createInstance(MoveFileToTrashAction, tree, <FileStat>stat));
		}

		// Set Order
		let curOrder = 1;
		for (let i = 0; i < actions.length; i++) {
			const action = <any>actions[i];
			if (!action.order) {
				curOrder++;
				action.order = curOrder;
			} else {
				curOrder = action.order;
			}
		}

		return actions;
	}

	public getActionItem(context: any, action: Action): BaseActionItem {
		if (context && context.element instanceof FileStat) {

			// Any other item with keybinding
			const keybinding = this.keybindingService.lookupKeybinding(action.id);
			if (keybinding) {
				return new ActionItem(context, action, { label: true, keybinding: keybinding.getLabel() });
			}
		}

		return null;
	}
}

class ExplorerViewersActionContributor extends ActionBarContributor {

	constructor( @IInstantiationService private instantiationService: IInstantiationService) {
		super();
	}

	public hasSecondaryActions(context: any): boolean {
		const element = context.element;

		// Contribute only on Files (File Explorer and Open Files Viewer)
		return !!explorerItemToFileResource(element);
	}

	public getSecondaryActions(context: any): IAction[] {
		const actions: IAction[] = [];

		if (this.hasSecondaryActions(context)) {
			const fileResource = explorerItemToFileResource(context.element);
			const resource = fileResource.resource;

			// Reveal file in OS native explorer
			actions.push(this.instantiationService.createInstance(RevealInOSAction, resource));

			// Copy Path
			actions.push(this.instantiationService.createInstance(CopyPathAction, resource));
		}

		return actions;
	}
}

// Contribute to Viewers that show Files
const actionBarRegistry = Registry.as<IActionBarRegistry>(ActionBarExtensions.Actionbar);
actionBarRegistry.registerActionBarContributor(Scope.VIEWER, FilesViewerActionContributor);
actionBarRegistry.registerActionBarContributor(Scope.VIEWER, ExplorerViewersActionContributor);

// Contribute Global Actions
const category = nls.localize('filesCategory', "Files");

const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(new SyncActionDescriptor(GlobalCopyPathAction, GlobalCopyPathAction.ID, GlobalCopyPathAction.LABEL, { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyCode.KEY_P) }), 'Files: Copy Path of Active File', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(SaveFileAction, SaveFileAction.ID, SaveFileAction.LABEL, { primary: KeyMod.CtrlCmd | KeyCode.KEY_S }), 'Files: Save', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(SaveAllAction, SaveAllAction.ID, SaveAllAction.LABEL, { primary: void 0, mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KEY_S }, win: { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyCode.KEY_S) } }), 'Files: Save All', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(SaveFilesAction, SaveFilesAction.ID, null /* only for programmatic trigger */), null);
registry.registerWorkbenchAction(new SyncActionDescriptor(RevertFileAction, RevertFileAction.ID, RevertFileAction.LABEL), 'Files: Revert File', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(GlobalNewFileAction, GlobalNewFileAction.ID, GlobalNewFileAction.LABEL), 'Files: New File', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(GlobalNewFolderAction, GlobalNewFolderAction.ID, GlobalNewFolderAction.LABEL), 'Files: New Folder', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(GlobalCompareResourcesAction, GlobalCompareResourcesAction.ID, GlobalCompareResourcesAction.LABEL), 'Files: Compare Active File With...', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(FocusOpenEditorsView, FocusOpenEditorsView.ID, FocusOpenEditorsView.LABEL, { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyCode.KEY_E) }), 'Files: Focus on Open Editors View', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(FocusFilesExplorer, FocusFilesExplorer.ID, FocusFilesExplorer.LABEL), 'Files: Focus on Files Explorer', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(ShowActiveFileInExplorer, ShowActiveFileInExplorer.ID, ShowActiveFileInExplorer.LABEL), 'Files: Reveal Active File in Side Bar', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(CollapseExplorerView, CollapseExplorerView.ID, CollapseExplorerView.LABEL), 'Files: Collapse Folders in Explorer', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(RefreshExplorerView, RefreshExplorerView.ID, RefreshExplorerView.LABEL), 'Files: Refresh Explorer', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(SaveFileAsAction, SaveFileAsAction.ID, SaveFileAsAction.LABEL, { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_S }), 'Files: Save As...', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(GlobalNewUntitledFileAction, GlobalNewUntitledFileAction.ID, GlobalNewUntitledFileAction.LABEL, { primary: KeyMod.CtrlCmd | KeyCode.KEY_N }), 'Files: New Untitled File', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(GlobalRevealInOSAction, GlobalRevealInOSAction.ID, GlobalRevealInOSAction.LABEL, { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyCode.KEY_R) }), 'Files: Reveal Active File', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(ShowOpenedFileInNewWindow, ShowOpenedFileInNewWindow.ID, ShowOpenedFileInNewWindow.LABEL, { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyCode.KEY_O) }), 'Files: Open Active File in New Window', category);

if (isMacintosh) {
	registry.registerWorkbenchAction(new SyncActionDescriptor(OpenFileFolderAction, OpenFileFolderAction.ID, OpenFileFolderAction.LABEL, { primary: KeyMod.CtrlCmd | KeyCode.KEY_O }), 'Files: Open...', category);
} else {
	registry.registerWorkbenchAction(new SyncActionDescriptor(OpenFileAction, OpenFileAction.ID, OpenFileAction.LABEL, { primary: KeyMod.CtrlCmd | KeyCode.KEY_O }), 'Files: Open File...', category);
	registry.registerWorkbenchAction(new SyncActionDescriptor(OpenFolderAction, OpenFolderAction.ID, OpenFolderAction.LABEL, { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_O) }), 'Files: Open Folder...', category);
}

registry.registerWorkbenchAction(new SyncActionDescriptor(NewWorkspaceAction, NewWorkspaceAction.ID, NewWorkspaceAction.LABEL), 'Files: New Workspace...', category);

// Commands
CommandsRegistry.registerCommand('_files.openFolderPicker', openFolderPickerCommand);
CommandsRegistry.registerCommand('_files.windowOpen', openWindowCommand);
CommandsRegistry.registerCommand('workbench.action.files.openFileInNewWindow', openFileInNewWindowCommand);

const explorerCommandsWeightBonus = 10; // give our commands a little bit more weight over other default list/tree commands

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'explorer.openToSide',
	weight: KeybindingsRegistry.WEIGHT.workbenchContrib(explorerCommandsWeightBonus),
	when: ExplorerFocusCondition,
	primary: KeyMod.CtrlCmd | KeyCode.Enter,
	mac: {
		primary: KeyMod.WinCtrl | KeyCode.Enter
	},
	handler: openFocusedExplorerItemSideBySideCommand
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'renameFile',
	weight: KeybindingsRegistry.WEIGHT.workbenchContrib(explorerCommandsWeightBonus),
	when: FilesExplorerFocusCondition,
	primary: KeyCode.F2,
	mac: {
		primary: KeyCode.Enter
	},
	handler: renameFocusedFilesExplorerViewItemCommand
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'moveFileToTrash',
	weight: KeybindingsRegistry.WEIGHT.workbenchContrib(explorerCommandsWeightBonus),
	when: FilesExplorerFocusCondition,
	primary: KeyCode.Delete,
	mac: {
		primary: KeyMod.CtrlCmd | KeyCode.Backspace
	},
	handler: moveFocusedFilesExplorerViewItemToTrashCommand
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'deleteFile',
	weight: KeybindingsRegistry.WEIGHT.workbenchContrib(explorerCommandsWeightBonus),
	when: FilesExplorerFocusCondition,
	primary: KeyMod.Shift | KeyCode.Delete,
	mac: {
		primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Backspace
	},
	handler: deleteFocusedFilesExplorerViewItemCommand
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'filesExplorer.copy',
	weight: KeybindingsRegistry.WEIGHT.workbenchContrib(explorerCommandsWeightBonus),
	when: FilesExplorerFocusCondition,
	primary: KeyMod.CtrlCmd | KeyCode.KEY_C,
	handler: copyFocusedFilesExplorerViewItem
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'filesExplorer.paste',
	weight: KeybindingsRegistry.WEIGHT.workbenchContrib(explorerCommandsWeightBonus),
	when: FilesExplorerFocusCondition,
	primary: KeyMod.CtrlCmd | KeyCode.KEY_V,
	handler: pasteIntoFocusedFilesExplorerViewItem
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'copyFilePath',
	weight: KeybindingsRegistry.WEIGHT.workbenchContrib(explorerCommandsWeightBonus),
	when: ExplorerFocusCondition,
	primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KEY_C,
	win: {
		primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KEY_C
	},
	handler: copyPathOfFocusedExplorerItem
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'revealFileInOS',
	weight: KeybindingsRegistry.WEIGHT.workbenchContrib(explorerCommandsWeightBonus),
	when: ExplorerFocusCondition,
	primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KEY_R,
	win: {
		primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KEY_R
	},
	handler: revealInOSFocusedFilesExplorerItem
});

// Editor Title Context Menu
appendEditorTitleContextMenuItem('_workbench.action.files.revealInOS', RevealInOSAction.LABEL, revealInOSCommand);
appendEditorTitleContextMenuItem('_workbench.action.files.copyPath', CopyPathAction.LABEL, copyPathCommand);
appendEditorTitleContextMenuItem('_workbench.action.files.revealInExplorer', nls.localize('revealInSideBar', "Reveal in Side Bar"), revealInExplorerCommand);

function appendEditorTitleContextMenuItem(id: string, title: string, command: ICommandHandler): void {

	// Command
	CommandsRegistry.registerCommand(id, command);

	// Menu
	MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
		command: { id, title },
		when: ContextKeyExpr.equals('resourceScheme', 'file'),
		group: '2_files'
	});
}

// Editor Title Menu for Conflict Resolution
appendSaveConflictEditorTitleAction('workbench.files.action.acceptLocalChanges', nls.localize('acceptLocalChanges', "Use local changes and overwrite disk contents"), 'save-conflict-action-accept-changes', -10, acceptLocalChangesCommand);
appendSaveConflictEditorTitleAction('workbench.files.action.revertLocalChanges', nls.localize('revertLocalChanges', "Discard local changes and revert to content on disk"), 'save-conflict-action-revert-changes', -9, revertLocalChangesCommand);

function appendSaveConflictEditorTitleAction(id: string, title: string, iconClass: string, order: number, command: ICommandHandler): void {

	// Command
	CommandsRegistry.registerCommand(id, command);

	// Action
	MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
		command: { id, title, iconClass },
		when: ContextKeyExpr.equals(CONFLICT_RESOLUTION_CONTEXT, true),
		group: 'navigation',
		order
	});
}