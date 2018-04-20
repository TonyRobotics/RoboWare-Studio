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
const vscode_languageserver_1 = require("vscode-languageserver");
const ycm_1 = require("./ycm");
const utils_1 = require("./utils");
process.on('uncaughtException', err => {
    utils_1.logger('!!!uncaughtException!!!', err);
});
// Create a connection for the server. The connection uses Node's IPC as a transport
let connection = vscode_languageserver_1.createConnection(new vscode_languageserver_1.IPCMessageReader(process), new vscode_languageserver_1.IPCMessageWriter(process));
// Create a simple text document manager. The text document manager
// supports full document sync only
let documents = new vscode_languageserver_1.TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites.
let workspaceRoot;
let workspaceConfiguration;
connection.onInitialize((params) => {
    workspaceRoot = utils_1.crossPlatformUri(params.rootUri);
    return {
        capabilities: {
            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: documents.syncKind,
            // Tell the client that the server support code complete
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', ':', '<', '"', '=', '/', '>', '*', '&']
            },
            hoverProvider: true,
            definitionProvider: true,
            // signatureHelpProvider: {
            //     triggerCharacters: ['(']
            // }
            codeActionProvider: true
        }
    };
});
connection.onCodeAction((param) => __awaiter(this, void 0, void 0, function* () {
    utils_1.logger('onCodeAction', JSON.stringify(param));
    try {
        const ycm = yield getYcm();
        const fixs = yield ycm.fixIt(param.textDocument.uri, param.range.start, documents);
        return fixs.map(it => {
            return {
                title: `Fix: ${it.text}`,
                command: 'ycm.FixIt',
                arguments: [it]
            };
        });
    }
    catch (e) {
        utils_1.logger('onCodeAction', e);
    }
    return [];
}));
connection.onNotification(new vscode_languageserver_1.NotificationType('FixIt'), (args) => __awaiter(this, void 0, void 0, function* () {
    utils_1.logger('On FixIt', JSON.stringify(args));
}));
connection.onHover((event) => __awaiter(this, void 0, void 0, function* () {
    const ycm = yield getYcm();
    try {
        return yield ycm.getType(event.textDocument.uri, event.position, documents, workspaceConfiguration.ycmd.use_imprecise_get_type);
    }
    catch (err) {
        utils_1.logger(`onHover error`, err);
    }
}));
connection.onDefinition((event) => __awaiter(this, void 0, void 0, function* () {
    const ycm = yield getYcm();
    try {
        return yield ycm.goTo(event.textDocument.uri, event.position, documents);
    }
    catch (err) {
        utils_1.logger(`onDefinition error`, err);
    }
}));
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => __awaiter(this, void 0, void 0, function* () {
    utils_1.logger(`onDidChangeContent ${JSON.stringify(change.document.uri)}`);
    const ycm = yield getYcm();
}));
// The settings interface describe the server relevant settings part
function getYcm() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!workspaceRoot || !workspaceConfiguration)
            return yield new Promise((resolve, reject) => setTimeout(() => getYcm(), 100));
        try {
            return yield ycm_1.default.getInstance(workspaceRoot, workspaceConfiguration, connection.window);
        }
        catch (err) {
            utils_1.logger('getYcm error', err);
            connection.window.showErrorMessage(`Ycm startup failed. Please check your ycmd or python path. Detail: ${err.message || err}`);
        }
    });
}
function getIssues(document) {
    return __awaiter(this, void 0, void 0, function* () {
        const ycm = yield getYcm();
        connection.sendDiagnostics({
            uri: document.uri,
            diagnostics: yield ycm.readyToParse(document.uri, documents)
        });
    });
}
// connection.onSignatureHelp((event) => {
//     logger(`onSignatureHelp: ${JSON.stringify(event)}`)
//     return {
//         signatures: [{
//             label: 'test1',
//             documentation: ' test1 test1 test1 test1 test1 test1 test1 test1',
//             parameters: [{
//                 label: 'string',
//                 documentation: 'string string string'
//             }, {
//                 label: 'int',
//                 documentation: 'int int int'
//             }]
//         }, {
//             label: 'test2',
//             documentation: ' test2 test2 test2 test2 test2 test2 test2 test2',
//             parameters: [{
//                 label: 'int',
//                 documentation: 'string string string'
//             }, {
//                 label: 'string',
//                 documentation: 'int int int'
//             }]
//         }]
//     } as SignatureHelp
//     // try {
//     //     // const ycm = await getYcm()
//     //     // await ycm.getDocQuick(event.textDocument.uri, event.position, documents)
//     // } catch (err) {
//     //     logger('onSignatureHelp error', err)
//     // }
// })
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => __awaiter(this, void 0, void 0, function* () {
    let settings = change.settings;
    utils_1.loggerInit(settings.ycmd.debug);
    utils_1.logger(`onDidChangeConfiguration settings`, JSON.stringify(settings));
    try {
        ensureValidConfiguration(settings);
        workspaceConfiguration = settings;
        workspaceConfiguration.ycmd.path = '/usr/share/roboware-studio/resources/app/extensions/RichardHe.you-complete-me-1.0.36/ycmd';
        workspaceConfiguration.ycmd.global_extra_config = '/usr/share/roboware-studio/resources/app/extensions/RichardHe.you-complete-me-1.0.36/ycmd/ycm_extra_conf.py';
    }
    catch (err) {
        connection.window.showErrorMessage(`[Ycm] ${err.message || err}`);
    }
    yield getYcm();
}));
function ensureValidConfiguration(settings) {
    if (!settings.ycmd)
        throw new Error('Invalid ycm configuration');
}
documents.onDidOpen((event) => __awaiter(this, void 0, void 0, function* () {
    utils_1.logger(`onDidOpen`, event.document.uri);
    const ycm = yield getYcm();
    try {
        yield ycm.getReady(event.document.uri, documents);
    }
    catch (err) {
        utils_1.logger('onDidOpen error', err);
    }
}));
// This handler provides the initial list of the completion items.
connection.onCompletion((textDocumentPosition) => __awaiter(this, void 0, void 0, function* () {
    utils_1.logger(`onCompletion: ${textDocumentPosition.textDocument.uri}`);
    const ycm = yield getYcm();
    // await ycm.insertLeave(documents.get(textDocumentPosition.textDocument.uri), documents)
    // await ycm.currentIdentifierFinished(documents.get(textDocumentPosition.textDocument.uri), documents)
    // await ycm.readyToParse(documents.get(textDocumentPosition.textDocument.uri), documents)
    try {
        const latestCompletions = yield ycm.completion(textDocumentPosition.textDocument.uri, textDocumentPosition.position, documents);
        return latestCompletions;
    }
    catch (err) {
        return null;
    }
}));
connection.onShutdown(() => __awaiter(this, void 0, void 0, function* () {
    utils_1.logger('onShutdown');
    yield ycm_1.default.reset();
}));
// connection.onExit(async () => {
//     logger('onExit')
//     Ycm.reset()
// })
// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    return item;
});
// connection.onDidOpenTextDocument((params) => {
// 	// A text document got opened in VSCode.
// 	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
// 	// params.text the initial full content of the document.
//     ycm.readyToParse(documents.get(params.textDocument.uri))
// })
// connection.onDidChangeTextDocument((params) => {
// 	// The content of a text document did change in VSCode.
// 	// params.uri uniquely identifies the document.
// 	// params.contentChanges describe the content changes to the document.
// 	connection.logger(`onDidChangeTextDocument: ${JSON.stringify(params.textDocument.version)}`)
// })
/*
connection.onDidCloseTextDocument((params) => {
    // A text document got closed in VSCode.
    // params.uri uniquely identifies the document.
    connection.logger(`${params.uri} closed.`);
});
*/
connection.onNotification('lint', (uri) => {
    getIssues(documents.get(uri));
});
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map