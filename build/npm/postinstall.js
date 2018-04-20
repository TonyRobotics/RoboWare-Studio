/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const cp = require('child_process');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function npmInstall(location) {
	const result = cp.spawnSync(npm, ['install'], {
		cwd: location ,
		stdio: 'inherit'
	});

	if (result.error || result.status !== 0) {
		process.exit(1);
	}
}

npmInstall('extensions'); // node modules shared by all extensions

const extensions = [
	'json',
	'configuration-editing',
	'extension-editing',
	'markdown',
	'git'
];

extensions.forEach(extension => npmInstall(`extensions/${extension}`));

npmInstall(`build`); // node modules required for build
