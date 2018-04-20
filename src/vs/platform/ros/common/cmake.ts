/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const ICmakeService = createDecorator<ICmakeService>('cmakeService');

export interface LibOrExeObject {
	name: string;
	isLib?: boolean;
}

export interface ICmakeService {
	_serviceBrand: any;

	/**
	 * get find_package list
	 */
	getFindPkg(path: string): TPromise<string[]>;

	/**
	 * set find_package list
	 */
	setFindPkg(path: string, list: string[]): TPromise<void>;

	/**
	 * set build dependency to package.xml
	 */
	setBuildDepXml(path: string, list: string[], newList: string[]): TPromise<void>;

	/**
	 * Get add_library or add_executable list
	 */
	getLibOrExeList(path: string): TPromise<LibOrExeObject[]>;

	/**
	 * Add file name to add_library or add_executable dependency list
	 */
	addToLibOrExe(path: string, obj: LibOrExeObject, name: string): TPromise<void>;

	/**
	 * Add file name to new add_library or add_executable block
	 */
	addToNewLibOrExe(path: string, obj: LibOrExeObject, name: string): TPromise<void>;

	/**
	 * add folder to include_directories
	 */
	addToIncludeDir(path: string, name: string): TPromise<void>;

	/**
	 * add name to find_package
	 */
	addToFindPkg(path: string, name: string): TPromise<void>;

	/**
	 * add name to add_message_files
	 */
	addToMsgFiles(path: string, name: string): TPromise<void>;

	/**
	 * add name to add_service_files
	 */
	addToSrvFiles(path: string, name: string): TPromise<void>;

	/**
	 * add name to add_action_files
	 */
	addToActionFiles(path: string, name: string): TPromise<void>;

	/**
	 * delete path name
	 */
	delPathName(path: string, name: string): TPromise<void>;

	/**
	 * rename path name
	 */
	renamePathName(path: string, name: string, newName: string): TPromise<void>;

	/**
	 * add message dependencies to package.xml
	 */
	addToMsgDepXml(path: string): TPromise<void>;
}