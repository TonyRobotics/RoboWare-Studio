"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const parser = require("./parser");
const nvimUtil_1 = require("../neovim/nvimUtil");
const configuration_1 = require("../configuration/configuration");
// Shows the vim command line.
function showCmdLine(initialText, modeHandler) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!vscode.window.activeTextEditor) {
            console.log("No active document.");
            return;
        }
        const options = {
            prompt: "Vim command line",
            value: initialText,
            ignoreFocusOut: true,
            valueSelection: [initialText.length, initialText.length]
        };
        try {
            const cmdString = yield vscode.window.showInputBox(options);
            yield runCmdLine(cmdString, modeHandler);
            return;
        }
        catch (e) {
            modeHandler.setStatusBarText(e.toString());
            return;
        }
    });
}
exports.showCmdLine = showCmdLine;
function runCmdLine(command, modeHandler) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!command || command.length === 0) {
            return;
        }
        try {
            var cmd = parser.parse(command);
            if (configuration_1.Configuration.enableNeovim && (!cmd.command || (cmd.command && cmd.command.neovimCapable))) {
                yield nvimUtil_1.Neovim.command(modeHandler.vimState, command).then(() => {
                    console.log("Substituted for neovim command");
                }).catch((err) => console.log(err));
            }
            else {
                yield cmd.execute(modeHandler.vimState.editor, modeHandler);
            }
            return;
        }
        catch (e) {
            if (configuration_1.Configuration.enableNeovim) {
                yield nvimUtil_1.Neovim.command(modeHandler.vimState, command).then(() => {
                    console.log("SUCCESS");
                }).catch((err) => console.log(err));
            }
            return;
        }
    });
}
exports.runCmdLine = runCmdLine;
//# sourceMappingURL=main.js.map