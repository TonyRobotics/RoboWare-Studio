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
const _ = require("lodash");
const mode_1 = require("./mode");
const notation_1 = require("./../notation");
const main_1 = require("../../src/cmd_line/main");
class Remapper {
    constructor(configKey, remappedModes, recursive) {
        this._remappings = [];
        /**
         * Have the keys pressed so far potentially be a remap
         */
        this._couldRemappingApply = false;
        this._recursive = recursive;
        this._remappedModes = remappedModes;
        let remappings = vscode.workspace.getConfiguration('vim')
            .get(configKey, []);
        for (let remapping of remappings) {
            let before = [];
            remapping.before.forEach(item => before.push(notation_1.AngleBracketNotation.Normalize(item)));
            let after = [];
            if (remapping.after) {
                remapping.after.forEach(item => after.push(notation_1.AngleBracketNotation.Normalize(item)));
            }
            this._remappings.push({
                before: before,
                after: after,
                commands: remapping.commands,
            });
        }
    }
    get couldRemappingApply() {
        return this._couldRemappingApply;
    }
    _longestKeySequence() {
        if (this._remappings.length > 0) {
            return _.maxBy(this._remappings, map => map.before.length).before.length;
        }
        else {
            return 1;
        }
    }
    sendKey(keys, modeHandler, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._remappedModes.indexOf(vimState.currentMode) === -1) {
                return false;
            }
            const longestKeySequence = this._longestKeySequence();
            let remapping;
            /**
             * Check to see if the keystrokes match any user-specified remapping.
             *
             * In non-Insert mode, we have to precisely match the entire keysequence,
             * but in insert mode, we allow the users to precede the remapped command
             * with extraneous keystrokes ("hello world jj")
             */
            if (this._remappedModes.indexOf(mode_1.ModeName.Insert) === -1) {
                remapping = _.find(this._remappings, map => {
                    return map.before.join("") === keys.join("");
                });
            }
            else {
                for (let sliceLength = 1; sliceLength <= longestKeySequence; sliceLength++) {
                    const slice = keys.slice(-sliceLength);
                    const result = _.find(this._remappings, map => map.before.join("") === slice.join(""));
                    if (result) {
                        remapping = result;
                        break;
                    }
                }
            }
            if (remapping) {
                // If we remapped e.g. jj to esc, we have to revert the inserted "jj"
                if (this._remappedModes.indexOf(mode_1.ModeName.Insert) >= 0) {
                    // Revert every single inserted character. This is actually a bit of
                    // a hack since we aren't guaranteed that each insertion inserted
                    // only a single character.
                    // We subtract 1 because we haven't actually applied the last key.
                    // TODO(johnfn) - study - actions need to be paired up with text
                    // changes... this is a complicated problem.
                    yield vimState.historyTracker.undoAndRemoveChanges(Math.max(0, (remapping.before.length - 1) * vimState.allCursors.length));
                }
                vimState.isCurrentlyPerformingRemapping = false;
                // We need to remove the keys that were remapped into different keys
                // from the state.
                const numToRemove = remapping.before.length - 1;
                vimState.recordedState.actionKeys = vimState.recordedState.actionKeys.slice(0, -numToRemove);
                vimState.keyHistory = vimState.keyHistory.slice(0, -numToRemove);
                if (remapping.after) {
                    const count = vimState.recordedState.count || 1;
                    vimState.recordedState.count = 0;
                    for (let i = 0; i < count; i++) {
                        yield modeHandler.handleMultipleKeyEvents(remapping.after);
                    }
                }
                if (remapping.commands) {
                    for (const command of remapping.commands) {
                        // Check if this is a vim command by looking for :
                        if (command.command.slice(0, 1) === ":") {
                            yield main_1.runCmdLine(command.command.slice(1, command.command.length), modeHandler);
                            yield modeHandler.updateView(modeHandler.vimState);
                        }
                        else {
                            yield vscode.commands.executeCommand(command.command, command.args);
                        }
                    }
                }
                vimState.isCurrentlyPerformingRemapping = false;
                return true;
            }
            else {
                // Check to see if a remapping could potentially be applied when more keys are received
                for (let remap of this._remappings) {
                    if (keys.join("") === remap.before.slice(0, keys.length).join("")) {
                        this._couldRemappingApply = true;
                        break;
                    }
                    else {
                        this._couldRemappingApply = false;
                    }
                }
            }
            return false;
        });
    }
}
class InsertModeRemapper extends Remapper {
    constructor(recursive) {
        super("insertModeKeyBindings" + (recursive ? "" : "NonRecursive"), [mode_1.ModeName.Insert], recursive);
    }
}
exports.InsertModeRemapper = InsertModeRemapper;
class OtherModesRemapper extends Remapper {
    constructor(recursive) {
        super("otherModesKeyBindings" + (recursive ? "" : "NonRecursive"), [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock], recursive);
    }
}
exports.OtherModesRemapper = OtherModesRemapper;
//# sourceMappingURL=remapper.js.map