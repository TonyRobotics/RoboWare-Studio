/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/explorerviewlet';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IAction, IActionRunner } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { Dimension, Builder } from 'vs/base/browser/builder';
import { Scope } from 'vs/workbench/common/memento';
import { VIEWLET_ID, ExplorerViewletVisibleContext, IFilesConfiguration } from 'vs/workbench/parts/files/common/files';
import { IViewletView, Viewlet } from 'vs/workbench/browser/viewlet';
import { SplitView } from 'vs/base/browser/ui/splitview/splitview';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ActionRunner, FileViewletState } from 'vs/workbench/parts/files/browser/views/explorerViewer';
import { ExplorerView } from 'vs/workbench/parts/files/browser/views/explorerView';
import { EmptyView } from 'vs/workbench/parts/files/browser/views/emptyView';
import { OpenEditorsView } from 'vs/workbench/parts/files/browser/views/openEditorsView';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { DelegatingWorkbenchEditorService } from 'vs/workbench/services/editor/browser/editorService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { EditorInput, EditorOptions } from 'vs/workbench/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachHeaderViewStyler } from 'vs/platform/theme/common/styler';
import { RosNodeView } from 'vs/workbench/parts/files/browser/views/rosNodeView';
import { RunBuildTaskAction, ConfigureTaskAction, ConfigureRemoteTaskAction } from 'vs/workbench/parts/files/browser/fileActions';
import { RunTaskActionItem } from 'vs/workbench/parts/files/browser/fileActionItems';
import { IActionItem } from 'vs/base/browser/ui/actionbar/actionbar';

export class ExplorerViewlet extends Viewlet {
	private viewletContainer: Builder;
	private splitView: SplitView;
	private views: IViewletView[];

	private actions: IAction[];
	private runTaskActionItem: RunTaskActionItem;

	private explorerView: ExplorerView;
	private rosNodeView: RosNodeView;
	private openEditorsView: OpenEditorsView;
	private emptyView: EmptyView;

	private openEditorsVisible: boolean;
	private lastFocusedView: ExplorerView | RosNodeView | OpenEditorsView | EmptyView;
	private focusListener: IDisposable;
	private delayEditorOpeningInOpenedEditors: boolean;

	private viewletSettings: any;
	private viewletState: FileViewletState;
	private dimension: Dimension;

	private viewletVisibleContextKey: IContextKey<boolean>;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IStorageService storageService: IStorageService,
		@IEditorGroupService private editorGroupService: IEditorGroupService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService
	) {
		super(VIEWLET_ID, telemetryService, themeService);

		this.views = [];

		this.viewletState = new FileViewletState();
		this.viewletVisibleContextKey = ExplorerViewletVisibleContext.bindTo(contextKeyService);

		this.viewletSettings = this.getMemento(storageService, Scope.WORKSPACE);
		this.configurationService.onDidUpdateConfiguration(e => this.onConfigurationUpdated(e.config));
	}

	public create(parent: Builder): TPromise<void> {
		super.create(parent);

		this.viewletContainer = parent.div().addClass('explorer-viewlet');

		const settings = this.configurationService.getConfiguration<IFilesConfiguration>();

		return this.onConfigurationUpdated(settings);
	}

	public getActions(): IAction[] {
		if (this.contextService.getWorkspace()) {
			if (!this.actions) {
				this.actions = [
					this.instantiationService.createInstance(RunBuildTaskAction, RunBuildTaskAction.ID, RunBuildTaskAction.LABEL),
					this.instantiationService.createInstance(ConfigureTaskAction, ConfigureTaskAction.ID, ConfigureTaskAction.LABEL),
					this.instantiationService.createInstance(ConfigureRemoteTaskAction, ConfigureRemoteTaskAction.ID, ConfigureRemoteTaskAction.LABEL)
				];
			}
			return this.actions;
		}
		return [];
	}

	public getActionItem(action: IAction): IActionItem {
		if (action.id === RunBuildTaskAction.ID) {
			this.runTaskActionItem = this.instantiationService.createInstance(RunTaskActionItem, null, action, this.rosNodeView);
			return this.runTaskActionItem;
		}

		return null;
	}

	private onConfigurationUpdated(config: IFilesConfiguration): TPromise<void> {

		// No need to delay if preview is disabled
		this.delayEditorOpeningInOpenedEditors = !!config.workbench.editor.enablePreview;

		// Open editors view should always be visible in no folder workspace.
		// const openEditorsVisible = !this.contextService.hasWorkspace() || config.explorer.openEditors.visible !== 0;
		const openEditorsVisible = config.explorer.openEditors.visible !== 0;

		// Create views on startup and if open editors visibility has changed #6919
		if (this.openEditorsVisible !== openEditorsVisible) {
			this.dispose();
			this.openEditorsVisible = openEditorsVisible;
			this.views = [];
			this.viewletContainer.clearChildren();

			this.splitView = new SplitView(this.viewletContainer.getHTMLElement());

			// Track focus
			this.focusListener = this.splitView.onFocus((view: ExplorerView | RosNodeView | OpenEditorsView | EmptyView) => {
				this.lastFocusedView = view;
			});

			if (this.openEditorsVisible) {
				// Open editors view
				this.addOpenEditorsView();
			}

			// Explorer view
			this.addExplorerView();
			this.lastFocusedView = this.explorerView;

			// Ros Node view
			if (this.contextService.getWorkspace()) {
				this.addRosNodeView();
			}

			return TPromise.join(this.views.map(view => view.create())).then(() => void 0).then(() => {
				if (this.dimension) {
					this.layout(this.dimension);
				}

				// Update title area since the title actions have changed.
				this.updateTitleArea();
				return this.setVisible(this.isVisible()).then(() => this.focus()); // Focus the viewlet since that triggers a rerender.
			});
		}

		return TPromise.as(null);
	}

	private addOpenEditorsView(): void {
		this.openEditorsView = this.instantiationService.createInstance(OpenEditorsView, this.getActionRunner(), this.viewletSettings);
		attachHeaderViewStyler(this.openEditorsView, this.themeService);

		this.splitView.addView(this.openEditorsView);

		this.views.push(this.openEditorsView);
	}

	private addRosNodeView(): void {
		this.rosNodeView = this.instantiationService.createInstance(RosNodeView, this.getActionRunner(), this.viewletSettings, undefined);
		attachHeaderViewStyler(this.rosNodeView, this.themeService);

		this.splitView.addView(this.rosNodeView);

		this.views.push(this.rosNodeView);
	}

	private addExplorerView(): void {
		let explorerOrEmptyView: ExplorerView | EmptyView;

		// With a Workspace
		if (this.contextService.hasWorkspace()) {

			// Create a delegating editor service for the explorer to be able to delay the refresh in the opened
			// editors view above. This is a workaround for being able to double click on a file to make it pinned
			// without causing the animation in the opened editors view to kick in and change scroll position.
			// We try to be smart and only use the delay if we recognize that the user action is likely to cause
			// a new entry in the opened editors view.
			const delegatingEditorService = this.instantiationService.createInstance(DelegatingWorkbenchEditorService);
			delegatingEditorService.setEditorOpenHandler((input: EditorInput, options?: EditorOptions, arg3?: any) => {
				if (this.openEditorsView) {
					let delay = 0;
					if (this.delayEditorOpeningInOpenedEditors && (arg3 === false /* not side by side */ || typeof arg3 !== 'number' /* no explicit position */)) {
						const activeGroup = this.editorGroupService.getStacksModel().activeGroup;
						if (!activeGroup || !activeGroup.previewEditor) {
							delay = 250; // a new editor entry is likely because there is either no group or no preview in group
						}
					}

					this.openEditorsView.setStructuralRefreshDelay(delay);
				}

				const onSuccessOrError = (editor?: BaseEditor) => {
					if (this.openEditorsView) {
						this.openEditorsView.setStructuralRefreshDelay(0);
					}

					return editor;
				};

				return this.editorService.openEditor(input, options, arg3).then(onSuccessOrError, onSuccessOrError);
			});

			const explorerInstantiator = this.instantiationService.createChild(new ServiceCollection([IWorkbenchEditorService, delegatingEditorService]));

			// const headerSize = this.openEditorsVisible ? undefined : 0; // If open editors are not visible set header size explicitly to 0, otherwise const it be computed by super class.
			this.explorerView = explorerOrEmptyView = explorerInstantiator.createInstance(ExplorerView, this.viewletState, this.getActionRunner(), this.viewletSettings, undefined);
			attachHeaderViewStyler(this.explorerView, this.themeService);
		}

		// No workspace
		else {
			this.emptyView = explorerOrEmptyView = this.instantiationService.createInstance(EmptyView, this.getActionRunner());
			attachHeaderViewStyler(this.emptyView, this.themeService);
		}

		// if (this.openEditorsVisible) {
		this.splitView.addView(explorerOrEmptyView);
		// } else {
		// 	explorerOrEmptyView.render(this.viewletContainer.getHTMLElement(), Orientation.VERTICAL);	//need: import {Orientation} from 'vs/base/browser/ui/splitview/splitview';
		// }

		this.views.push(explorerOrEmptyView);
	}

	public getExplorerView(): ExplorerView {
		return this.explorerView;
	}

	public getRosNodeView(): RosNodeView {
		return this.rosNodeView;
	}

	public getOpenEditorsView(): OpenEditorsView {
		return this.openEditorsView;
	}

	public setVisible(visible: boolean): TPromise<void> {
		this.viewletVisibleContextKey.set(visible);

		return super.setVisible(visible).then(() => {
			return TPromise.join(this.views.map((view) => view.setVisible(visible))).then(() => void 0);
		});
	}

	public focus(): void {
		super.focus();

		if (this.runTaskActionItem) {
			this.runTaskActionItem.focus();
		}

		const hasOpenedEditors = !!this.editorGroupService.getStacksModel().activeGroup;

		if (this.lastFocusedView && this.lastFocusedView.isExpanded() && this.hasSelectionOrFocus(this.lastFocusedView)) {
			if (this.lastFocusedView !== this.openEditorsView || hasOpenedEditors) {
				this.lastFocusedView.focusBody();
				return;
			}
		}

		if (this.hasSelectionOrFocus(this.openEditorsView) && hasOpenedEditors) {
			return this.openEditorsView.focusBody();
		}

		if (this.hasSelectionOrFocus(this.explorerView)) {
			return this.explorerView.focusBody();
		}

		if (this.hasSelectionOrFocus(this.rosNodeView)) {
			return this.rosNodeView.focusBody();
		}

		if (this.openEditorsView && this.openEditorsView.isExpanded() && hasOpenedEditors) {
			return this.openEditorsView.focusBody(); // we have entries in the opened editors view to focus on
		}

		if (this.explorerView && this.explorerView.isExpanded()) {
			return this.explorerView.focusBody();
		}

		if (this.rosNodeView && this.rosNodeView.isExpanded()) {
			return this.rosNodeView.focusBody();
		}

		if (this.emptyView && this.emptyView.isExpanded()) {
			return this.emptyView.focusBody();
		}

		// return this.openEditorsView.focus();
	}

	private hasSelectionOrFocus(view: ExplorerView | RosNodeView | OpenEditorsView | EmptyView): boolean {
		if (!view) {
			return false;
		}

		if (!view.isExpanded()) {
			return false;
		}

		if (view instanceof ExplorerView || view instanceof RosNodeView || view instanceof OpenEditorsView) {
			const viewer = view.getViewer();
			if (!viewer) {
				return false;
			}

			return !!viewer.getFocus() || (viewer.getSelection() && viewer.getSelection().length > 0);

		}

		return false;
	}

	public layout(dimension: Dimension): void {
		this.dimension = dimension;

		// if (this.openEditorsVisible) {
		this.splitView.layout(dimension.height);
		// } else if (this.explorerView) {
		// 	this.explorerView.layout(dimension.height, Orientation.VERTICAL);	//need: import {Orientation} from 'vs/base/browser/ui/splitview/splitview';
		// }
	}

	public getActionRunner(): IActionRunner {
		if (!this.actionRunner) {
			this.actionRunner = new ActionRunner(this.viewletState);
		}

		return this.actionRunner;
	}

	public getViewletState(): FileViewletState {
		return this.viewletState;
	}

	public getOptimalWidth(): number {
		const additionalMargin = 16;
		const openedEditorsViewWidth = this.openEditorsVisible ? this.openEditorsView.getOptimalWidth() : 0;
		const explorerView = this.getExplorerView();
		const explorerViewWidth = explorerView ? explorerView.getOptimalWidth() : 0;
		const rosNodeView = this.getRosNodeView();
		const rosNodeViewWidth = rosNodeView ? rosNodeView.getOptimalWidth() : 0;
		const optimalWidth = Math.max(openedEditorsViewWidth, explorerViewWidth, rosNodeViewWidth);

		return optimalWidth + additionalMargin;
	}

	public shutdown(): void {
		this.views.forEach((view) => view.shutdown());

		super.shutdown();
	}

	public dispose(): void {
		if (this.splitView) {
			this.splitView.dispose();
			this.splitView = null;
		}

		if (this.explorerView) {
			this.explorerView.dispose();
			this.explorerView = null;
		}

		if (this.openEditorsView) {
			this.openEditorsView.dispose();
			this.openEditorsView = null;
		}

		if (this.rosNodeView) {
			this.rosNodeView.dispose();
			this.rosNodeView = null;
		}

		if (this.emptyView) {
			this.emptyView.dispose();
			this.emptyView = null;
		}

		if (this.focusListener) {
			this.focusListener.dispose();
			this.focusListener = null;
		}
	}
}