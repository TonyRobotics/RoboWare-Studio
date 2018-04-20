/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Wang Tong
 *--------------------------------------------------------------------------------------------*/

import { resolve, join } from 'path';
import { R_OK, W_OK, X_OK } from 'constants';
import { readFileSync, writeFileSync, accessSync } from 'fs';
import { execSync } from 'child_process';
import * as paths from 'vs/base/node/paths';

const CONF_HOME = resolve(paths.getDefaultUserDataPath(process.platform));
const RPM_HOME = join(CONF_HOME, 'Rpm');
const RPM_DB_HOME = join(require('electron').remote.app.getAppPath(), 'extensions/roboware-webrpm/data/rpm');
const RPM_DISTROS = ['kinetic', 'jade', 'indigo', 'hydro', 'groovy'];
const ROS_DISTRO = (() => {
	if (process.env.ROS_DISTRO) {
		return process.env.ROS_DISTRO;
	}
	try {
		var thenames = require('fs').readdirSync('/opt/ros', 'utf8');
		var thename = '';
		label: {
			for (var n of thenames) {
				for (var distro of RPM_DISTROS) {
					if (n === distro) {
						thename = distro;
						break label;
					}
				}
			}
		}
		process.env.ROS_DISTRO = thename;
		return thename;
	} catch (e) {
		return '';
	}
})();

function tryCreateDir(dirname: string) {
	// TODO: windows.showError
	try {
		accessSync(dirname, R_OK | W_OK | X_OK);
	} catch (e) {
		try {
			execSync(`mkdir -p '${dirname}'`);
		} catch (e) {
			console.log(e);
		}
	}
}

function tryCopyFile(file1: string, file2: string) {
	// TODO: windows.showError
	try {
		var data = readFileSync(file1);
		writeFileSync(file2, data);
	} catch (e) {
		console.log(e);
	}
}

tryCreateDir(CONF_HOME);
tryCreateDir(RPM_HOME);
RPM_DISTROS.map((distro) =>
	tryCopyFile(join(RPM_DB_HOME, distro + '.json'),
		join(RPM_HOME, distro + '.json')));

export default {
	logfile: join(CONF_HOME, 'roboware.log'),
	rosDistro: ROS_DISTRO,
	rpm: {
		home: RPM_HOME,
		viewletId: 'workbench.roboware.rpm'
	}
};