"use strict";
const vscode_1 = require('vscode');
function activate() {
	var previewVisible = false;
	var srcText = '';
	var provider = {
		_onDidChange: new vscode_1.EventEmitter(),
		get onDidChange() {
			return this._onDidChange.event;
		},
		provideTextDocumentContent() {
			return `
<!DOCTYPE html>
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
	<style>
		html, body {
			padding: 0;
			margin: 0;
		}
		iframe {
			position: fixed;
			display: block;
			width: 100%;
			height: 100%;
			border: none;
			overflow: scroll;
		}
	</style>
</head>
<body>
	<div>
		<iframe src="${srcText}"></iframe>
	</div>
</body>
</html>
`;
		}
	};
	vscode_1.workspace.registerTextDocumentContentProvider('rpm', provider);
	vscode_1.commands.registerCommand('extension.view.rpmweb', function (homepage) {
		var uri = vscode_1.Uri.parse(`rpm://rpm.com`);
		srcText = homepage;
		if (!previewVisible) {
			vscode_1.commands.executeCommand('vscode.previewHtml', uri, vscode_1.ViewColumn.One, srcText);
			previewVisible = true;
		} else {
			provider._onDidChange.fire(uri);
		}
	});
	vscode_1.workspace.onDidCloseTextDocument(function (doc) {
		if (doc.uri.scheme === 'rpm' && doc.uri.authority === 'rpm.com') {
			previewVisible = false;
		}
	});
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=webrpm.js.map