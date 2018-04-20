/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/rosviewlet';
import nls = require('vs/nls');
import { IDisposable } from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import { Dimension, Builder } from 'vs/base/browser/builder';
import { VIEWLET_ID } from 'vs/workbench/parts/ros/common/ros';
import { IViewletView, Viewlet } from 'vs/workbench/browser/viewlet';
import { IActionRunner, ActionRunner } from 'vs/base/common/actions';
import { SplitView } from 'vs/base/browser/ui/splitview/splitview';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { RosListView, RosTopicListView } from 'vs/workbench/parts/ros/browser/views/rosListView';

export class RosViewlet extends Viewlet {
	private viewletContainer: Builder;
	private splitView: SplitView;
	private views: IViewletView[];

	private viewActionRunner: IActionRunner;

	private rosTopicView: RosTopicListView;
	private rosNodeView: RosListView;
	private rosServiceView: RosListView;
	private rosPackView: RosListView;
	private rosMsgView: RosListView;
	private rosSrvView: RosListView;

	private lastFocusedView: RosListView;
	private focusListener: IDisposable;

	private dimension: Dimension;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super(VIEWLET_ID, telemetryService, themeService);
	}

	public create(parent: Builder): TPromise<void> {
		super.create(parent);

		this.viewletContainer = parent.div().addClass('ros-viewlet');

		this.dispose();

		this.views = [];
		this.viewletContainer.clearChildren();

		this.splitView = new SplitView(this.viewletContainer.getHTMLElement());

		// Track focus
		this.focusListener = this.splitView.onFocus((view: RosListView) => {
			this.lastFocusedView = view;
		});

		this.addRosTopicView();
		this.addRosNodeView();
		this.addRosServiceView();
		this.addRosPackView();
		this.addRosMsgView();
		this.addRosSrvView();

		return TPromise.join(this.views.map(view => view.create())).then(() => void 0).then(() => {
			if (this.dimension) {
				this.layout(this.dimension);
			}

			// Update title area since the title actions have changed.
			this.updateTitleArea();
			return this.setVisible(this.isVisible()).then(() => this.focus()); // Focus the viewlet since that triggers a rerender.
		});
	}

	private addRosTopicView(): void {
		this.rosTopicView = this.instantiationService.createInstance(RosTopicListView, this.getViewActionRunner(), nls.localize('activeTopics', "Active Topics"), 'rostopic', ['list', 'info'], 'echo');
		this.splitView.addView(this.rosTopicView);
		this.views.push(this.rosTopicView);
	}

	private addRosNodeView(): void {
		this.rosNodeView = this.instantiationService.createInstance(RosListView, this.getViewActionRunner(), nls.localize('activeNodes', "Active Nodes"), 'rosnode', ['list', 'info'], null);
		this.splitView.addView(this.rosNodeView);
		this.views.push(this.rosNodeView);
	}

	private addRosServiceView(): void {
		this.rosServiceView = this.instantiationService.createInstance(RosListView, this.getViewActionRunner(), nls.localize('activeServices', "Active Services"), 'rosservice', ['list', 'info'], null);
		this.splitView.addView(this.rosServiceView);
		this.views.push(this.rosServiceView);
	}

	private addRosPackView(): void {
		this.rosPackView = this.instantiationService.createInstance(RosListView, this.getViewActionRunner(), nls.localize('installedPackages', "Installed Packages"), 'rospack', ['list-names'], null);
		this.splitView.addView(this.rosPackView);
		this.views.push(this.rosPackView);
	}

	private addRosMsgView(): void {
		this.rosMsgView = this.instantiationService.createInstance(RosListView, this.getViewActionRunner(), nls.localize('installedMessages', "Installed Messages"), 'rosmsg', ['list', 'show'], null);
		this.splitView.addView(this.rosMsgView);
		this.views.push(this.rosMsgView);
	}

	private addRosSrvView(): void {
		this.rosSrvView = this.instantiationService.createInstance(RosListView, this.getViewActionRunner(), nls.localize('installedServices', "Installed Services"), 'rossrv', ['list', 'show'], null);
		this.splitView.addView(this.rosSrvView);
		this.views.push(this.rosSrvView);
	}

	public getRosTopicView(): RosListView {
		return this.rosTopicView;
	}

	public getRosNodeView(): RosListView {
		return this.rosNodeView;
	}

	public getRosServiceView(): RosListView {
		return this.rosServiceView;
	}

	public getRosPackView(): RosListView {
		return this.rosPackView;
	}

	public getRosMsgView(): RosListView {
		return this.rosMsgView;
	}

	public getRosSrvView(): RosListView {
		return this.rosSrvView;
	}

	public setVisible(visible: boolean): TPromise<void> {
		return super.setVisible(visible).then(() => {
			return TPromise.join(this.views.map((view) => view.setVisible(visible))).then(() => void 0);
		});
	}

	public focus(): void {
		super.focus();

		if (this.lastFocusedView && this.lastFocusedView.isExpanded() && this.hasSelectionOrFocus(this.lastFocusedView)) {
			this.lastFocusedView.focusBody();
			return;
		}

		if (this.hasSelectionOrFocus(this.rosTopicView)) {
			return this.rosTopicView.focusBody();
		}

		if (this.hasSelectionOrFocus(this.rosNodeView)) {
			return this.rosNodeView.focusBody();
		}

		if (this.hasSelectionOrFocus(this.rosServiceView)) {
			return this.rosServiceView.focusBody();
		}

		if (this.hasSelectionOrFocus(this.rosPackView)) {
			return this.rosPackView.focusBody();
		}

		if (this.hasSelectionOrFocus(this.rosMsgView)) {
			return this.rosMsgView.focusBody();
		}

		if (this.hasSelectionOrFocus(this.rosSrvView)) {
			return this.rosSrvView.focusBody();
		}

		if (this.rosTopicView && this.rosTopicView.isExpanded()) {
			return this.rosTopicView.focusBody();
		}

		if (this.rosNodeView && this.rosNodeView.isExpanded()) {
			return this.rosNodeView.focusBody();
		}

		if (this.rosServiceView && this.rosServiceView.isExpanded()) {
			return this.rosServiceView.focusBody();
		}

		if (this.rosPackView && this.rosPackView.isExpanded()) {
			return this.rosPackView.focusBody();
		}

		if (this.rosMsgView && this.rosMsgView.isExpanded()) {
			return this.rosMsgView.focusBody();
		}

		if (this.rosSrvView && this.rosSrvView.isExpanded()) {
			return this.rosSrvView.focusBody();
		}
	}

	private hasSelectionOrFocus(view: RosListView): boolean {
		if (!view) {
			return false;
		}

		if (!view.isExpanded()) {
			return false;
		}

		if (view instanceof RosListView) {
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
		this.splitView.layout(dimension.height);
	}

	public getViewActionRunner(): IActionRunner {
		if (!this.viewActionRunner) {
			this.viewActionRunner = new ActionRunner();
		}

		return this.viewActionRunner;
	}

	public getOptimalWidth(): number {
		const additionalMargin = 16;
		const rosTopicView = this.getRosTopicView();
		const rosTopicViewWidth = rosTopicView ? rosTopicView.getOptimalWidth() : 0;
		const rosNodeView = this.getRosNodeView();
		const rosNodeViewWidth = rosNodeView ? rosNodeView.getOptimalWidth() : 0;
		const rosServiceView = this.getRosServiceView();
		const rosServiceViewWidth = rosServiceView ? rosServiceView.getOptimalWidth() : 0;
		const rosPackView = this.getRosPackView();
		const rosPackViewWidth = rosPackView ? rosPackView.getOptimalWidth() : 0;
		const rosMsgView = this.getRosMsgView();
		const rosMsgViewWidth = rosMsgView ? rosMsgView.getOptimalWidth() : 0;
		const rosSrvView = this.getRosSrvView();
		const rosSrvViewWidth = rosSrvView ? rosSrvView.getOptimalWidth() : 0;
		const optimalWidth = Math.max(rosTopicViewWidth, rosNodeViewWidth, rosServiceViewWidth, rosPackViewWidth, rosMsgViewWidth, rosSrvViewWidth);

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

		if (this.rosTopicView) {
			this.rosTopicView.dispose();
			this.rosTopicView = null;
		}

		if (this.rosNodeView) {
			this.rosNodeView.dispose();
			this.rosNodeView = null;
		}

		if (this.rosServiceView) {
			this.rosServiceView.dispose();
			this.rosServiceView = null;
		}

		if (this.rosPackView) {
			this.rosPackView.dispose();
			this.rosPackView = null;
		}

		if (this.rosMsgView) {
			this.rosMsgView.dispose();
			this.rosMsgView = null;
		}

		if (this.rosSrvView) {
			this.rosSrvView.dispose();
			this.rosSrvView = null;
		}

		if (this.focusListener) {
			this.focusListener.dispose();
			this.focusListener = null;
		}
	}
}