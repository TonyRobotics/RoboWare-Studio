"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const _ = require("lodash");
const vscode_uri_1 = require("vscode-uri");
const iconv = require('iconv-lite');
function mapYcmCompletionsToLanguageServerCompletions(CompletionItems = []) {
    const len = CompletionItems.length.toString().length;
    return _.map(CompletionItems, (it, index) => {
        const item = {
            label: it.menu_text || it.insertion_text,
            detail: it.extra_menu_info,
            insertText: it.insertion_text,
            documentation: it.detailed_info,
            sortText: _.padStart(index.toString(), len, '0')
        };
        switch (it.kind || it.extra_menu_info) {
            case 'TYPE':
            case 'STRUCT':
                item.kind = vscode_languageserver_1.CompletionItemKind.Interface;
                break;
            case 'ENUM':
                item.kind = vscode_languageserver_1.CompletionItemKind.Enum;
                break;
            case 'MEMBER':
                item.kind = vscode_languageserver_1.CompletionItemKind.Property;
                break;
            case 'MACRO':
                item.kind = vscode_languageserver_1.CompletionItemKind.Keyword;
                break;
            case 'NAMESPACE':
                item.kind = vscode_languageserver_1.CompletionItemKind.Module;
                break;
            case 'UNKNOWN':
                item.kind = vscode_languageserver_1.CompletionItemKind.Value;
                break;
            case 'FUNCTION':
                item.kind = vscode_languageserver_1.CompletionItemKind.Function;
                break;
            case 'VARIABLE':
                item.kind = vscode_languageserver_1.CompletionItemKind.Variable;
                break;
            case 'CLASS':
                item.kind = vscode_languageserver_1.CompletionItemKind.Class;
                break;
            case '[File]':
            case '[Dir]':
            case '[File&Dir]':
                item.kind = vscode_languageserver_1.CompletionItemKind.File;
                break;
            default:
                item.kind = vscode_languageserver_1.CompletionItemKind.Text;
                break;
        }
        return item;
    });
}
exports.mapYcmCompletionsToLanguageServerCompletions = mapYcmCompletionsToLanguageServerCompletions;
function mapYcmDiagnosticToLanguageServerDiagnostic(items) {
    return _.map(items, (it, index) => {
        const item = {
            range: null,
            source: 'ycm',
            message: it.text,
            code: it.fixit_available ? 'FixIt' : null
        };
        let range = it.location_extent;
        if (!(range.start.line_num > 0 && range.end.line_num > 0))
            range = it.ranges.length > 0 ? it.ranges[0] : null;
        if (!!range)
            item.range = {
                start: {
                    line: range.start.line_num - 1,
                    character: range.start.column_num - 1
                },
                end: {
                    line: range.end.line_num - 1,
                    character: range.end.column_num - 1
                }
            };
        if (!item.range && it.location.column_num > 0 && it.location.line_num > 0) {
            item.range = {
                start: {
                    line: it.location.line_num - 1,
                    character: it.location.column_num - 1
                },
                end: {
                    line: it.location.line_num - 1,
                    character: it.location.column_num - 1
                }
            };
        }
        // FIXME: is there any other kind?
        switch (it.kind) {
            case 'ERROR':
                item.severity = vscode_languageserver_1.DiagnosticSeverity.Error;
                break;
            case 'WARNING':
                item.severity = vscode_languageserver_1.DiagnosticSeverity.Warning;
                break;
            default:
                item.severity = vscode_languageserver_1.DiagnosticSeverity.Information;
                break;
        }
        return item;
    });
}
exports.mapYcmDiagnosticToLanguageServerDiagnostic = mapYcmDiagnosticToLanguageServerDiagnostic;
function mapYcmTypeToHover(res, language) {
    if (res.message === 'Unknown type')
        return null;
    if (res.message === 'Internal error: cursor not valid')
        return null;
    logger('mapYcmTypeToHover', `language: ${language}`);
    return {
        contents: {
            language: language,
            value: res.message
        }
    };
}
exports.mapYcmTypeToHover = mapYcmTypeToHover;
function mapYcmLocationToLocation(location) {
    return {
        uri: vscode_uri_1.default.file(location.filepath).toString(),
        range: {
            start: {
                line: location.line_num - 1,
                character: location.column_num - 1
            },
            end: {
                line: location.line_num - 1,
                character: location.column_num - 1
            },
        }
    };
}
exports.mapYcmLocationToLocation = mapYcmLocationToLocation;
function crossPlatformBufferToString(buffer) {
    return buffer.toString('utf8');
}
exports.crossPlatformBufferToString = crossPlatformBufferToString;
function crossPlatformUri(uri) {
    return vscode_uri_1.default.parse(uri).fsPath;
}
exports.crossPlatformUri = crossPlatformUri;
let isDebug = false;
function loggerInit(debug) {
    isDebug = debug;
}
exports.loggerInit = loggerInit;
function logger(tag, ...args) {
    args.unshift(`[${tag}]`);
    /* tslint:disable:no-console */
    if (isDebug)
        console.log.apply(console, args);
    /* tslint:enable:no-console */
}
exports.logger = logger;
let extensions = new Map();
extensions.set('objective-c', 'objc');
function mapVSCodeLanguageIdToYcmFileType(languageId) {
    const type = extensions.get(languageId);
    if (type)
        return type;
    else
        return languageId;
}
exports.mapVSCodeLanguageIdToYcmFileType = mapVSCodeLanguageIdToYcmFileType;
//# sourceMappingURL=utils.js.map