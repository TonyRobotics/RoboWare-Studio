/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/

'use strict';

import nls = require('vs/nls');
import { Registry } from 'vs/platform/platform';
import { ConfigLaunchArgsAction, SelectLaunchArgsAction, OpenBashrcAction, OpenRemoteBashrcAction, RunRosCoreAction, RunRosRvizAction, RunRosRqtAction, RunRosReconfigureAction, RunRosGraphAction, RunRemoteRosCoreAction } from 'vs/workbench/parts/ros/browser/rosActions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actionRegistry';

// Contribute Global Actions
const category = nls.localize('rosCategory', "Ros");

const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(new SyncActionDescriptor(ConfigLaunchArgsAction, ConfigLaunchArgsAction.ID, ConfigLaunchArgsAction.LABEL), 'Ros: Configure Launch Args', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(SelectLaunchArgsAction, SelectLaunchArgsAction.ID, SelectLaunchArgsAction.LABEL), 'Ros: Select Launch Args', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(OpenBashrcAction, OpenBashrcAction.ID, OpenBashrcAction.LABEL), 'Ros: Open ~/.bashrc', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(OpenRemoteBashrcAction, OpenRemoteBashrcAction.ID, OpenRemoteBashrcAction.LABEL), 'Ros: Open Remote ~/.bashrc', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(RunRosCoreAction, RunRosCoreAction.ID, RunRosCoreAction.LABEL), 'Ros: Run roscore', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(RunRosRvizAction, RunRosRvizAction.ID, RunRosRvizAction.LABEL), 'Ros: Run RViz', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(RunRosRqtAction, RunRosRqtAction.ID, RunRosRqtAction.LABEL), 'Ros: Run rqt', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(RunRosReconfigureAction, RunRosReconfigureAction.ID, RunRosReconfigureAction.LABEL), 'Ros: Run rqt_reconfigure', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(RunRosGraphAction, RunRosGraphAction.ID, RunRosGraphAction.LABEL), 'Ros: Run rqt_graph', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(RunRemoteRosCoreAction, RunRemoteRosCoreAction.ID, RunRemoteRosCoreAction.LABEL), 'Ros: Run Remote roscore', category);