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
const position_1 = require("./../common/motion/position");
const textEditor_1 = require("../textEditor");
const configuration_1 = require("../configuration/configuration");
const child_process_1 = require("child_process");
const promised_neovim_client_1 = require("promised-neovim-client");
const register_1 = require("../register/register");
const mode_1 = require("../mode/mode");
class Neovim {
    static initNvim(vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const proc = child_process_1.spawn(configuration_1.Configuration.neovimPath, ['-u', 'NONE', '-N', '--embed'], { cwd: __dirname });
            proc.on('error', function (err) {
                console.log(err);
                vscode.window.showErrorMessage("Unable to setup neovim instance! Check your path.");
                configuration_1.Configuration.enableNeovim = false;
            });
            vimState.nvim = yield promised_neovim_client_1.attach(proc.stdin, proc.stdout);
        });
    }
    // Data flows from VS to Vim
    static syncVSToVim(vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const nvim = vimState.nvim;
            const buf = yield nvim.getCurrentBuf();
            if (configuration_1.Configuration.expandtab) {
                yield vscode.commands.executeCommand("editor.action.indentationToTabs");
            }
            yield buf.setLines(0, -1, true, textEditor_1.TextEditor.getText().split('\n'));
            const [rangeStart, rangeEnd] = [position_1.Position.EarlierOf(vimState.cursorPosition, vimState.cursorStartPosition),
                position_1.Position.LaterOf(vimState.cursorPosition, vimState.cursorStartPosition)];
            yield nvim.callFunction("setpos", [".", [0, vimState.cursorPosition.line + 1, vimState.cursorPosition.character, false]]);
            yield nvim.callFunction("setpos", ["'<", [0, rangeStart.line + 1, rangeEnd.character, false]]);
            yield nvim.callFunction("setpos", ["'>", [0, rangeEnd.line + 1, rangeEnd.character, false]]);
            for (const mark of vimState.historyTracker.getMarks()) {
                yield nvim.callFunction("setpos", [`'${mark.name}`, [0, mark.position.line + 1, mark.position.character, false]]);
            }
            const effectiveRegisterMode = (register) => {
                if (register === register_1.RegisterMode.FigureItOutFromCurrentMode) {
                    if (vimState.currentMode === mode_1.ModeName.VisualLine) {
                        return register_1.RegisterMode.LineWise;
                    }
                    else if (vimState.currentMode === mode_1.ModeName.VisualBlock) {
                        return register_1.RegisterMode.BlockWise;
                    }
                    else {
                        return register_1.RegisterMode.CharacterWise;
                    }
                }
                else {
                    return register;
                }
            };
            // We only copy over " register for now, due to our weird handling of macros.
            let reg = yield register_1.Register.get(vimState);
            let vsRegTovimReg = [undefined, "c", "l", "b"];
            yield nvim.callFunction("setreg", ['"', reg.text, vsRegTovimReg[effectiveRegisterMode(reg.registerMode)]]);
        });
    }
    // Data flows from Vim to VS
    static syncVimToVs(vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const nvim = vimState.nvim;
            const buf = yield nvim.getCurrentBuf();
            yield textEditor_1.TextEditor.replace(new vscode.Range(0, 0, textEditor_1.TextEditor.getLineCount() - 1, textEditor_1.TextEditor.getLineMaxColumn(textEditor_1.TextEditor.getLineCount() - 1)), (yield buf.getLines(0, -1, false)).join('\n'));
            let [row, character] = (yield nvim.callFunction("getpos", ["."])).slice(1, 3);
            vimState.editor.selection = new vscode.Selection(new position_1.Position(row - 1, character), new position_1.Position(row - 1, character));
            if (configuration_1.Configuration.expandtab) {
                yield vscode.commands.executeCommand("editor.action.indentationToSpaces");
            }
            // We're only syncing back the default register for now, due to the way we could
            // be storing macros in registers.
            const vimRegToVsReg = { "v": register_1.RegisterMode.CharacterWise, "V": register_1.RegisterMode.LineWise, "\x16": register_1.RegisterMode.BlockWise };
            vimState.currentRegisterMode = vimRegToVsReg[yield nvim.callFunction("getregtype", ['"'])];
            register_1.Register.put(yield nvim.callFunction("getreg", ['"']), vimState);
        });
    }
    static command(vimState, command) {
        return __awaiter(this, void 0, void 0, function* () {
            const nvim = vimState.nvim;
            yield this.syncVSToVim(vimState);
            command = ":" + command + "\n";
            command = command.replace('<', '<lt>');
            yield nvim.input(command);
            if ((yield nvim.getMode()).blocking) {
                yield nvim.input('<esc>');
            }
            yield this.syncVimToVs(vimState);
            return;
        });
    }
    static input(vimState, keys) {
        return __awaiter(this, void 0, void 0, function* () {
            const nvim = vimState.nvim;
            yield this.syncVSToVim(vimState);
            yield nvim.input(keys);
            yield this.syncVimToVs(vimState);
            return;
        });
    }
}
exports.Neovim = Neovim;
//# sourceMappingURL=nvimUtil.js.map