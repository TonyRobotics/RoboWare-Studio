/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { join } from 'path';

import pfs = require('vs/base/node/pfs');
import { TPromise } from 'vs/base/common/winjs.base';

import { ICmakeService, LibOrExeObject } from 'vs/platform/ros/common/cmake';
import { DOMParser, XMLSerializer } from 'xmldom';

export class CmakeService implements ICmakeService {

	public _serviceBrand: any;

	public static MAKE_FILE_NAME = 'CMakeLists.txt';
	public static PKG_FILE_NAME = 'package.xml';

	// get find_package list
	public getFindPkg(path: string): TPromise<string[]> {
		const filePath = join(path, CmakeService.MAKE_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			const srcStr = this.removeComment(contents.toString());
			const subStr = srcStr.match(/(\n|^)\s*find_package\s*\(\s*catkin\s+REQUIRED\s+COMPONENTS\b[^\)]*\)/);
			if (subStr) {
				const pkgList = subStr[0].replace(/(\n|^)\s*find_package\s*\(\s*catkin\s+REQUIRED\s+COMPONENTS\s*/, '').replace(/\s*\)$/, '').split(/\s+/);
				return pkgList;
			}
			return [];
		});
	}

	// set find_package list
	public setFindPkg(path: string, list: string[]): TPromise<void> {
		const filePath = join(path, CmakeService.MAKE_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			const newStr = contents.toString().replace(/(\n|^)\s*find_package\s*\(\s*catkin\s+REQUIRED\b[^\)]*\)/, `\nfind_package(catkin REQUIRED COMPONENTS ${list.join(' ')})`);
			return pfs.writeFile(filePath, newStr);
		});
	}

	// set build dependency to package.xml
	public setBuildDepXml(path: string, list: string[], newList: string[]): TPromise<void> {
		for (let i = list.length - 1; i >= 0; i--) {
			if (newList.indexOf(list[i]) >= 0) {
				list.splice(i, 1);
			}
		}
		return this.delFromBuildDepXml(path, list).then(() => this.addToBuildDepXml(path, newList));
	}

	// Get add_library or add_executable list
	public getLibOrExeList(path: string): TPromise<LibOrExeObject[]> {
		const filePath = join(path, CmakeService.MAKE_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			let strArray = contents.toString().match(/(\n|^)\s*(add_library|add_executable)\s*\(\s*\w+/g);
			let objs: LibOrExeObject[] = [];
			if (strArray) {
				for (let i = 0; i < strArray.length; i++) {
					objs[i] = { name: strArray[i].match(/\w+$/)[0], isLib: /(\n|^)\s*add_library/.test(strArray[i]) };
				}
			}
			return objs;
		});
	}

	// Add file name to add_library or add_executable dependency list
	public addToLibOrExe(path: string, obj: LibOrExeObject, name: string): TPromise<void> {
		const filePath = join(path, CmakeService.MAKE_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			const regExp = new RegExp(`(\\n|^)\\s*${obj.isLib ? 'add_library' : 'add_executable'}\\s*\\(\\s*${obj.name}\\b`);
			const oldStr = contents.toString();
			const subStr = oldStr.match(regExp);
			const newStr = oldStr.replace(regExp, `${subStr[0]}\n  ${name}`);
			return pfs.writeFile(filePath, newStr);
		});
	}

	// Add file name to new add_library or add_executable block
	public addToNewLibOrExe(path: string, obj: LibOrExeObject, name: string): TPromise<void> {
		const filePath = join(path, CmakeService.MAKE_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			const oldStr = contents.toString();
			const newStr = `${oldStr}\n\n${obj.isLib ? 'add_library' : 'add_executable'}(${obj.name}\n  ${name}\n)\nadd_dependencies(${obj.name} \${\${PROJECT_NAME}_EXPORTED_TARGETS} \${catkin_EXPORTED_TARGETS})\ntarget_link_libraries(${obj.name}\n  \${catkin_LIBRARIES}\n)`;
			return pfs.writeFile(filePath, newStr);
		});
	}

	// Clear the comment line from content
	private removeComment(content: string): string {
		return content.replace(/#.*/g, '');
	}

	// add name to oldStr
	private addToListString(oldStr: string, name: string, subHeadReg: string, commentReg: string, subHead: string): string {
		const regExp = new RegExp(`(\\n|^)\\s*${subHeadReg}[^\\)]*\\)`);
		const srcStr = this.removeComment(oldStr);
		const subStr = srcStr.match(regExp);
		if (subStr) {	// match ok
			const regExp2 = new RegExp(`(\\b|\\B)${name.replace('$', '\\$')}(\\b|\\B)`);
			if (regExp2.test(subStr[0])) {	// The same name already exists
				return null;
			}
			const newReg = new RegExp(`(\\n|^)\\s*${subHeadReg}`);
			const newSub = oldStr.match(newReg);
			return oldStr.replace(newReg, `${newSub[0]}\n  ${name}`);	// add name
		} else {	// match failed, find comment
			const cmtReg = new RegExp(`(\\n|^)\\s*#+\\s*${commentReg}[^\\)]*\\)`);
			const cmtStr = oldStr.match(cmtReg);
			if (cmtStr) {	// Found in the comment
				return oldStr.replace(cmtStr[0], `\n${subHead}\n  ${name}\n)`);	// replace the comment
			} else {	// create a new
				return `${oldStr}\n\n${subHead}\n  ${name}\n)`;
			}
		}
	}

	// add dependency to find_package
	private addToFindPkgString(oldStr: string, name: string): string {
		return this.addToListString(oldStr, name, 'find_package\\s*\\(\\s*catkin\\s+REQUIRED\\s+COMPONENTS\\b', 'find_package\\s*\\(\\s*catkin\\s+REQUIRED\\s+COMPONENTS\\b', 'find_package(catkin REQUIRED COMPONENTS');
	}

	// add dependency to generate_messages
	private addToGenerateMsgString(oldStr: string, name: string): string {
		return this.addToListString(oldStr, name, 'generate_messages\\s*\\(\\s*DEPENDENCIES\\b', 'generate_messages\\b', 'generate_messages(DEPENDENCIES');
	}

	// add dependency to catkin_package
	private addToCatkinPkgString(oldStr: string, name: string): string {
		const regExp = /(\n|^)\s*catkin_package\s*\([^\)]*\)/;
		const srcStr = this.removeComment(oldStr);
		const subStr = srcStr.match(regExp);
		if (subStr) {	// match ok
			const regExp2 = /\bCATKIN_DEPENDS\b[^\)A-Z]*/;
			const subStr2 = subStr[0].match(regExp2);
			if (subStr2) {	// match ok
				const regExp3 = new RegExp(`\\b${name}\\b`);
				if (regExp3.test(subStr2[0])) {	// The same name already exists
					return null;
				}
				const newReg = /\bCATKIN_DEPENDS/;
				const newSub = subStr[0].match(newReg);
				return oldStr.replace(subStr[0], subStr[0].replace(newReg, `${newSub[0]}\n  ${name}`));	// add name
			} else {	// create a new
				const newReg = /(\n|^)\s*catkin_package\s*\(/;
				const newSub = oldStr.match(newReg);
				return oldStr.replace(newReg, `${newSub[0]}\n  CATKIN_DEPENDS\n  ${name}`);	// add CATKIN_DEPENDS
			}
		} else {	// match failed, find comment
			const cmtReg = /(\n|^)\s*#+\s*catkin_package\b[^\)]*\)/;
			const cmtStr = oldStr.match(cmtReg);
			if (cmtStr) {	// Found in the comment
				return oldStr.replace(cmtStr[0], `\ncatkin_package\n  CATKIN_DEPENDS\n  ${name}\n)`);	// replace the comment
			} else {	// create a new
				return `${oldStr}\n\ncatkin_package(\n  CATKIN_DEPENDS\n  ${name}\n)`;
			}
		}
	}

	// add name to the list and write to file
	private addToList(path: string, name: string, subHeadReg: string, commentReg: string, subHead: string): TPromise<void> {
		const filePath = join(path, CmakeService.MAKE_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			const newStr = this.addToListString(contents.toString(), name, subHeadReg, commentReg, subHead);
			if (newStr) {
				return pfs.writeFile(filePath, newStr);
			}
			return null;
		});
	}

	// add folder to include_directories
	public addToIncludeDir(path: string, name: string): TPromise<void> {
		return this.addToList(path, name, 'include_directories\\s*\\(', 'include_directories\\b', 'include_directories(');
	}

	// add name to find_package
	public addToFindPkg(path: string, name: string): TPromise<void> {
		return this.addToList(path, name, 'find_package\\s*\\(\\s*catkin\\s+REQUIRED\\s+COMPONENTS\\b', 'find_package\\s*\\(\\s*catkin\\s+REQUIRED\\s+COMPONENTS\\b', 'find_package(catkin REQUIRED COMPONENTS');
	}

	// add file name to the list of message files
	private addToMsgFilesBase(path: string, name: string, baseName: string): TPromise<void> {
		const filePath = join(path, CmakeService.MAKE_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			let oldStr = contents.toString();
			let isChanged: boolean = false;
			let newStr = this.addToFindPkgString(oldStr, 'message_generation');
			if (newStr) {
				oldStr = newStr;
				isChanged = true;
			}
			newStr = this.addToListString(oldStr, name, `${baseName}\\s*\\(\\s*FILES\\b`, `${baseName}\\b`, `${baseName}(FILES`);
			if (newStr) {
				oldStr = newStr;
				isChanged = true;
			}
			newStr = this.addToGenerateMsgString(oldStr, 'std_msgs');
			if (newStr) {
				oldStr = newStr;
				isChanged = true;
			}
			newStr = this.addToCatkinPkgString(oldStr, 'message_runtime');
			if (newStr) {
				oldStr = newStr;
				isChanged = true;
			}
			if (isChanged) {
				return pfs.writeFile(filePath, oldStr);
			}
			return null;
		});
	}

	// add name to add_message_files
	public addToMsgFiles(path: string, name: string): TPromise<void> {
		return this.addToMsgFilesBase(path, name, 'add_message_files');
	}

	// add name to add_service_files
	public addToSrvFiles(path: string, name: string): TPromise<void> {
		return this.addToMsgFilesBase(path, name, 'add_service_files');
	}

	// add name to add_action_files
	public addToActionFiles(path: string, name: string): TPromise<void> {
		const filePath = join(path, CmakeService.MAKE_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			let oldStr = contents.toString();
			let isChanged: boolean = false;
			let newStr = this.addToFindPkgString(oldStr, 'message_generation');
			if (newStr) {
				oldStr = newStr;
				isChanged = true;
			}
			newStr = this.addToFindPkgString(oldStr, 'actionlib_msgs');
			if (newStr) {
				oldStr = newStr;
				isChanged = true;
			}
			newStr = this.addToListString(oldStr, name, 'add_action_files\\s*\\(\\s*FILES\\b', 'add_action_files\\b', 'add_action_files(FILES');
			if (newStr) {
				oldStr = newStr;
				isChanged = true;
			}
			newStr = this.addToGenerateMsgString(oldStr, 'std_msgs');
			if (newStr) {
				oldStr = newStr;
				isChanged = true;
			}
			newStr = this.addToGenerateMsgString(oldStr, 'actionlib_msgs');
			if (newStr) {
				oldStr = newStr;
				isChanged = true;
			}
			newStr = this.addToCatkinPkgString(oldStr, 'message_runtime');
			if (newStr) {
				oldStr = newStr;
				isChanged = true;
			}
			if (isChanged) {
				return pfs.writeFile(filePath, oldStr);
			}
			return null;
		});
	}

	// get a empty add_library or add_executable's name
	private getEmptyLibOrExe(oldStr: string): string {
		let strArray = oldStr.match(/(\n|^)\s*(add_library|add_executable)\s*\(\s*\w+\s*\)/);
		if (strArray) {
			return strArray[0].match(/\w+\s*\)/)[0].match(/\w+/)[0];
		}
		return null;
	}

	// delete path name
	public delPathName(path: string, name: string): TPromise<void> {
		const filePath = join(path, CmakeService.MAKE_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			const regExp = new RegExp(`\\b${name}\\b\\s*`);
			const oldStr = contents.toString();
			let newStr = oldStr.replace(regExp, '');	// delete name
			if (/\.cpp$/.test(name) || /\.h$/.test(name)) {	// delete empty list
				const LibOrExe = this.getEmptyLibOrExe(newStr);
				if (LibOrExe) {
					const regExp2 = new RegExp(`(\\n|^)\\s*(add_library|add_executable)\\s*\\(\\s*${LibOrExe}\\s*\\)`);
					const regExp3 = new RegExp(`(\\n|^)\\s*add_dependencies\\s*\\(\\s*${LibOrExe}\\s+\\\${\\\${PROJECT_NAME}_EXPORTED_TARGETS}\\s+\\\${catkin_EXPORTED_TARGETS}\\s*\\)`);
					const regExp4 = new RegExp(`(\\n|^)\\s*target_link_libraries\\s*\\(\\s*${LibOrExe}\\s+\\\${catkin_LIBRARIES}\\s*\\)`);
					newStr = newStr.replace(regExp2, '').replace(regExp3, '').replace(regExp4, '');
				}
			} else if (/\.msg$/.test(name)) {
				newStr = newStr.replace(/(\n|^)\s*add_message_files\s*\(\s*FILES\s*\)/, '\n# add_message_files(\n#   FILES\n# )');
			} else if (/\.srv$/.test(name)) {
				newStr = newStr.replace(/(\n|^)\s*add_service_files\s*\(\s*FILES\s*\)/, '\n# add_service_files(\n#   FILES\n# )');
			} else if (/\.action$/.test(name)) {
				newStr = newStr.replace(/(\n|^)\s*add_action_files\s*\(\s*FILES\s*\)/, '\n# add_action_files(\n#   FILES\n# )');
			}
			return pfs.writeFile(filePath, newStr);
		});
	}

	// rename path name
	public renamePathName(path: string, name: string, newName: string): TPromise<void> {
		const filePath = join(path, CmakeService.MAKE_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			const regExp = new RegExp(`\\b${name}\\b`);
			const oldStr = contents.toString();
			const newStr = oldStr.replace(regExp, newName);	// rename
			return pfs.writeFile(filePath, newStr);
		});
	}

	// add multiple dependencies to package.xml
	private addToPackageXml(path: string, element: { key: string, text: string }[]): TPromise<void> {
		const filePath = join(path, CmakeService.PKG_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			const doc = new DOMParser().parseFromString(contents.toString(), 'text/xml');
			const pkg = doc.getElementsByTagName('package');
			const format = pkg[0].getAttribute('format');
			element.forEach((value) => {
				if (format === '2') {
					if (value.key === 'run_depend') {
						return;
					}
				} else {
					if (value.key === 'build_export_depend' || value.key === 'exec_depend') {
						return;
					}
				}
				const elems = doc.getElementsByTagName(value.key);
				for (let i = 0; i < elems.length; i++) {
					if (elems[i].firstChild.nodeValue === value.text) {
						return;
					}
				}
				const elem = doc.createElement(value.key);
				const txt = doc.createTextNode(value.text);
				elem.appendChild(txt);
				pkg[0].appendChild(elem);
			});
			const newStr = new XMLSerializer().serializeToString(doc).replace(/></g, '>\n<');
			return pfs.writeFile(filePath, newStr);
		});
	}

	// delete multiple dependencies from package.xml
	private delFromPackageXml(path: string, element: { key: string, text: string }[]): TPromise<void> {
		const filePath = join(path, CmakeService.PKG_FILE_NAME);
		return pfs.readFile(filePath).then(contents => {
			const doc = new DOMParser().parseFromString(contents.toString(), 'text/xml');
			const pkg = doc.getElementsByTagName('package');
			element.forEach((value) => {
				const elems = doc.getElementsByTagName(value.key);
				for (let i = 0; i < elems.length; i++) {
					if (elems[i].firstChild.nodeValue === value.text) {
						pkg[0].removeChild(elems[i]);
					}
				}
			});
			const newStr = new XMLSerializer().serializeToString(doc).replace(/\n\n\n/g, '');
			return pfs.writeFile(filePath, newStr);
		});
	}

	// add message dependencies to package.xml
	public addToMsgDepXml(path: string): TPromise<void> {
		return this.addToPackageXml(path, [{ key: 'build_depend', text: 'message_generation' }, { key: 'build_export_depend', text: 'message_generation' }, { key: 'run_depend', text: 'message_runtime' }, { key: 'exec_depend', text: 'message_runtime' }]);
	}

	// add build dependencies to package.xml
	private addToBuildDepXml(path: string, list: string[]): TPromise<void> {
		return this.addToPackageXml(path, list.map(val => ({ key: 'build_depend', text: val })).concat(list.map(val => ({ key: 'run_depend', text: val })), list.map(val => ({ key: 'build_export_depend', text: val })), list.map(val => ({ key: 'exec_depend', text: val }))));
	}

	// delete build dependencies from package.xml
	private delFromBuildDepXml(path: string, list: string[]): TPromise<void> {
		return this.delFromPackageXml(path, list.map(val => ({ key: 'build_depend', text: val })).concat(list.map(val => ({ key: 'run_depend', text: val })), list.map(val => ({ key: 'build_export_depend', text: val })), list.map(val => ({ key: 'exec_depend', text: val }))));
	}
}