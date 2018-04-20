"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const node = require("../node");
const path = require("path");
var Tab;
(function (Tab) {
    Tab[Tab["Next"] = 0] = "Next";
    Tab[Tab["Previous"] = 1] = "Previous";
    Tab[Tab["First"] = 2] = "First";
    Tab[Tab["Last"] = 3] = "Last";
    Tab[Tab["New"] = 4] = "New";
    Tab[Tab["Close"] = 5] = "Close";
    Tab[Tab["Only"] = 6] = "Only";
    Tab[Tab["Move"] = 7] = "Move";
})(Tab = exports.Tab || (exports.Tab = {}));
//
//  Implements tab
//  http://vimdoc.sourceforge.net/htmldoc/tabpage.html
//
class TabCommand extends node.CommandBase {
    constructor(args) {
        super();
        this._name = 'tab';
        this._arguments = args;
    }
    get arguments() {
        return this._arguments;
    }
    executeCommandWithCount(count, command) {
        for (let i = 0; i < count; i++) {
            vscode.commands.executeCommand(command);
        }
    }
    execute() {
        switch (this._arguments.tab) {
            case Tab.Next:
                if (this._arguments.count /** not undefined or 0 */) {
                    vscode.commands.executeCommand("workbench.action.openEditorAtIndex1");
                    this.executeCommandWithCount(this._arguments.count - 1, "workbench.action.nextEditorInGroup");
                }
                else {
                    this.executeCommandWithCount(1, "workbench.action.nextEditorInGroup");
                }
                break;
            case Tab.Previous:
                if (this._arguments.count !== undefined && this._arguments.count <= 0) {
                    break;
                }
                this.executeCommandWithCount(this._arguments.count || 1, "workbench.action.previousEditorInGroup");
                break;
            case Tab.First:
                this.executeCommandWithCount(1, "workbench.action.openEditorAtIndex1");
                break;
            case Tab.Last:
                this.executeCommandWithCount(1, "workbench.action.openLastEditorInGroup");
                break;
            case Tab.New:
                if (this.arguments.file) {
                    let currentFilePath = vscode.window.activeTextEditor.document.uri.path;
                    let newFilePath = path.isAbsolute(this._arguments.file) ?
                        this._arguments.file :
                        path.join(path.dirname(currentFilePath), this._arguments.file);
                    if (newFilePath !== currentFilePath) {
                        let folder = vscode.Uri.file(newFilePath);
                        vscode.commands.executeCommand("vscode.open", folder);
                    }
                }
                else {
                    this.executeCommandWithCount(1, "workbench.action.files.newUntitledFile");
                }
                break;
            case Tab.Close:
                // Navigate the correct position
                if (this._arguments.count === undefined) {
                    vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                    break;
                }
                if (this._arguments.count === 0) {
                    // Wrong paramter
                    break;
                }
                // TODO: Close Page {count}. Page count is one-based.
                break;
            case Tab.Only:
                this.executeCommandWithCount(1, "workbench.action.closeOtherEditors");
                break;
            case Tab.Move:
                if (this._arguments.count !== undefined) {
                    if (this._arguments.count === 0) {
                        vscode.commands.executeCommand("activeEditorMove", { to: "first" });
                    }
                    else {
                        vscode.commands.executeCommand("activeEditorMove", { to: "position", amount: this._arguments.count });
                    }
                }
                else {
                    vscode.commands.executeCommand("activeEditorMove", { to: "last" });
                }
                break;
            default:
                break;
        }
    }
}
exports.TabCommand = TabCommand;
//# sourceMappingURL=tab.js.map