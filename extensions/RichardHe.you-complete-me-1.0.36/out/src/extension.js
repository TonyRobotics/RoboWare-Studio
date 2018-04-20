/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const path = require("path");
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
let client;
let disposable;
function activate(context) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
    // The debug options for the server
    let debugOptions = { execArgv: ['--nolazy', '--debug=6004'] };
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc, options: debugOptions }
    };
    const languages = vscode_1.workspace.getConfiguration('ycmd').get('enabled_languages');
    // Options to control the language client
    let clientOptions = {
        // Register the server for plain text documents
        documentSelector: languages,
        synchronize: {
            // Synchronize the setting section 'languageServerExample' to the server
            configurationSection: 'ycmd',
        }
    };
    // Create the language client and start the client.
    client = new vscode_languageclient_1.LanguageClient('ycm-language-server', serverOptions, clientOptions);
    client.onReady().then(() => {
        client.onNotification('error', (params) => {
            vscode_1.window.showErrorMessage(`[ycm] ${params}`);
        });
    });
    disposable = client.start();
    vscode_1.commands.registerCommand('ycm.lint', (args) => {
        client.sendNotification('lint', vscode_1.window.activeTextEditor.document.uri.toString());
    });
    vscode_1.commands.registerCommand('ycm.FixIt', (args) => __awaiter(this, void 0, void 0, function* () {
        const fixit = args;
        const edits = utils_1.MapYcmFixItToVSCodeEdit(fixit);
        const success = yield vscode_1.workspace.applyEdit(edits);
        client.sendNotification('lint', vscode_1.window.activeTextEditor.document.uri.toString());
    }));
    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(disposable);
    // workspace.onDidChangeTextDocument((event) => {
    //     let whenToLint = workspace.getConfiguration('ycmd').get('lint_run') as string
    //     if (whenToLint === 'onType') {
    //         client.sendNotification('lint', window.activeTextEditor.document.uri.toString())
    //     }
    // })
    vscode_1.workspace.onDidSaveTextDocument((event) => {
        let whenToLint = vscode_1.workspace.getConfiguration('ycmd').get('lint_run');
        if (whenToLint === 'onSave') {
            client.sendNotification('lint', vscode_1.window.activeTextEditor.document.uri.toString());
        }
    });
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map