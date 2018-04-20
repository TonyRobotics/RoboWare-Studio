/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export interface TaskName {
	name: string;
	isBuildCommand?: boolean;
}

export const IRosService = createDecorator<IRosService>('rosService');

export interface IRosService {
	_serviceBrand: any;

	/**
	 * init ROS workspace
	 */
	initRosWs(path: string): TPromise<void>;

	/**
	 * init the configuration of ROS workspace
	 */
	initRosWsYcmConf(): TPromise<void>;

	/**
	 * create ROS package
	 */
	addRosPkg(pkgName: string): TPromise<void>;

	/**
	 * get the debug argument
	 */
	getDebugArgs(name: string): TPromise<string>;

	/**
	 * set the debug argument
	 */
	setDebugArgs(name: string, args: string): TPromise<void>;

	/**
	 * get the argument from cache
	 */
	getArgsCache(): TPromise<string[]>;

	/**
	 * add argument to cache
	 */
	addArgsToCache(args: string): TPromise<void>;

	/**
	 * get the active package name from cache, It's synchronous
	 */
	getActivePkgNameCacheSync(): string[];

	/**
	 * get the active package name from cache
	 */
	getActivePkgNameCache(): TPromise<string[]>;

	/**
	 * add the active package name to cache
	 */
	addActivePkgNameToCache(pkgName: string): TPromise<void>;

	/**
	 * delete the active package name from cache
	 */
	delActivePkgNameFromCache(pkgName: string): TPromise<void>;

	/**
	 * clean all active package name from cache
	 */
	cleanActivePkgNameFromCache(): TPromise<void>;

	/**
	 * get the remote argument from cache
	 */
	getRemoteArgsCache(): TPromise<any>;

	/**
	 * set the remote argument to cache
	 */
	setRemoteArgsToCache(host: string, user: string, keyfile: string, cwd: string): TPromise<void>;

	/**
	 * get Build Task Name list
	 */
	getBuildTaskNames(isCatkinBuild: boolean): TPromise<TaskName[]>;

	/**
	 * set the default Build Task
	 */
	setBuildTask(taskName: string): TPromise<void>;

	/**
	 * set the active package name
	 */
	setActivePkgNameArgs(activePkgName: string[]): TPromise<void>;

	/**
	 * set remote tasks argument
	 */
	setRemoteTasksArgs(host: string, user: string, keyfile: string, cwd: string): TPromise<void>;

	/**
	 * set remote launch argument
	 */
	setRemoteLaunchArgs(host: string, user: string, keyfile: string, cwd: string): TPromise<void>;

	/**
	 * run command and get the results
	 */
	getCmdResultList(command: string): TPromise<string[]>;

	/**
	 * create C++ ROS node
	 */
	addCppNode(path: string, name: string): TPromise<any>;

	/**
	 * create Python ROS node
	 */
	addPythonNode(path: string, name: string): TPromise<any>;

	/**
	 * create C++ class
	 */
	addCppClass(path: string, pkgName: string, name: string): TPromise<any>;
}

export const IRosWinService = createDecorator<IRosWinService>('rowWinService');

export interface IRosWinService {
	_serviceBrand: any;

	/**
	 * Create and open ros workspace
	 */
	newRosWs(): TPromise<void>;
}