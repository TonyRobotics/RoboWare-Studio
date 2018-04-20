"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const mode_1 = require("./../mode/mode");
const position_1 = require("./../common/motion/position");
const configuration_1 = require("./../configuration/configuration");
const textEditor_1 = require("./../textEditor");
const modeHandler_1 = require("./../mode/modeHandler");
const register_1 = require("./../register/register");
const matcher_1 = require("./../common/matching/matcher");
const replaceState_1 = require("./../state/replaceState");
const quoteMatcher_1 = require("./../common/matching/quoteMatcher");
const tagMatcher_1 = require("./../common/matching/tagMatcher");
const base_1 = require("./base");
const operator_1 = require("./operator");
const base_2 = require("./base");
function isIMovement(o) {
    return o.start !== undefined &&
        o.stop !== undefined;
}
exports.isIMovement = isIMovement;
/**
 * A movement is something like 'h', 'k', 'w', 'b', 'gg', etc.
 */
class BaseMovement extends base_2.BaseAction {
    constructor() {
        super(...arguments);
        this.modes = [
            mode_1.ModeName.Normal,
            mode_1.ModeName.Visual,
            mode_1.ModeName.VisualLine,
            mode_1.ModeName.VisualBlock,
        ];
        this.isMotion = true;
        this.canBePrefixedWithCount = false;
        /**
         * Whether we should change desiredColumn in VimState.
         */
        this.doesntChangeDesiredColumn = false;
        /**
         * This is for commands like $ which force the desired column to be at
         * the end of even the longest line.
         */
        this.setsDesiredColumnToEOL = false;
    }
    /**
     * Whether we should change lastRepeatableMovement in VimState.
     */
    canBeRepeatedWithSemicolon(vimState, result) {
        return false;
    }
    /**
     * Run the movement a single time.
     *
     * Generally returns a new Position. If necessary, it can return an IMovement instead.
     * Note: If returning an IMovement, make sure that repeated actions on a
     * visual selection work. For example, V}}
     */
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error("Not implemented!");
        });
    }
    /**
     * Run the movement in an operator context a single time.
     *
     * Some movements operate over different ranges when used for operators.
     */
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.execAction(position, vimState);
        });
    }
    /**
     * Run a movement count times.
     *
     * count: the number prefix the user entered, or 0 if they didn't enter one.
     */
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            let recordedState = vimState.recordedState;
            let result = new position_1.Position(0, 0); // bogus init to satisfy typechecker
            if (count < 1) {
                count = 1;
            }
            else if (count > 99999) {
                count = 99999;
            }
            for (let i = 0; i < count; i++) {
                const firstIteration = (i === 0);
                const lastIteration = (i === count - 1);
                const temporaryResult = (recordedState.operator && lastIteration) ?
                    yield this.execActionForOperator(position, vimState) :
                    yield this.execAction(position, vimState);
                if (temporaryResult instanceof position_1.Position) {
                    result = temporaryResult;
                    position = temporaryResult;
                }
                else if (isIMovement(temporaryResult)) {
                    if (result instanceof position_1.Position) {
                        result = {
                            start: new position_1.Position(0, 0),
                            stop: new position_1.Position(0, 0),
                            failed: false
                        };
                    }
                    result.failed = result.failed || temporaryResult.failed;
                    if (firstIteration) {
                        result.start = temporaryResult.start;
                    }
                    if (lastIteration) {
                        result.stop = temporaryResult.stop;
                    }
                    else {
                        position = temporaryResult.stop.getRightThroughLineBreaks();
                    }
                    result.registerMode = temporaryResult.registerMode;
                }
            }
            return result;
        });
    }
}
exports.BaseMovement = BaseMovement;
class MoveByScreenLine extends BaseMovement {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine];
        this.value = 1;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            yield vscode.commands.executeCommand("cursorMove", {
                to: this.movementType,
                select: vimState.currentMode !== mode_1.ModeName.Normal,
                by: this.by,
                value: this.value
            });
            if (vimState.currentMode === mode_1.ModeName.Normal) {
                return position_1.Position.FromVSCodePosition(vimState.editor.selection.active);
            }
            else {
                /**
                 * cursorMove command is handling the selection for us.
                 * So we are not following our design principal (do no real movement inside an action) here.
                 */
                let start = position_1.Position.FromVSCodePosition(vimState.editor.selection.start);
                let stop = position_1.Position.FromVSCodePosition(vimState.editor.selection.end);
                let curPos = position_1.Position.FromVSCodePosition(vimState.editor.selection.active);
                // We want to swap the cursor start stop positions based on which direction we are moving, up or down
                if (start.isEqual(curPos)) {
                    position = start;
                    [start, stop] = [stop, start];
                    start = start.getLeft();
                }
                return { start, stop };
            }
        });
    }
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            yield vscode.commands.executeCommand("cursorMove", {
                to: this.movementType,
                select: true,
                by: this.by,
                value: this.value
            });
            return {
                start: position_1.Position.FromVSCodePosition(vimState.editor.selection.start),
                stop: position_1.Position.FromVSCodePosition(vimState.editor.selection.end)
            };
        });
    }
}
class MoveByScreenLineMaintainDesiredColumn extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.doesntChangeDesiredColumn = true;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            let prevDesiredColumn = vimState.desiredColumn;
            let prevLine = vimState.editor.selection.active.line;
            yield vscode.commands.executeCommand("cursorMove", {
                to: this.movementType,
                select: vimState.currentMode !== mode_1.ModeName.Normal,
                by: this.by,
                value: this.value
            });
            if (vimState.currentMode === mode_1.ModeName.Normal) {
                let returnedPos = position_1.Position.FromVSCodePosition(vimState.editor.selection.active);
                if (prevLine !== returnedPos.line) {
                    returnedPos = returnedPos.setLocation(returnedPos.line, prevDesiredColumn);
                }
                return returnedPos;
            }
            else {
                /**
                 * cursorMove command is handling the selection for us.
                 * So we are not following our design principal (do no real movement inside an action) here.
                 */
                let start = position_1.Position.FromVSCodePosition(vimState.editor.selection.start);
                let stop = position_1.Position.FromVSCodePosition(vimState.editor.selection.end);
                let curPos = position_1.Position.FromVSCodePosition(vimState.editor.selection.active);
                // We want to swap the cursor start stop positions based on which direction we are moving, up or down
                if (start.isEqual(curPos)) {
                    position = start;
                    [start, stop] = [stop, start];
                    start = start.getLeft();
                }
                return { start, stop };
            }
        });
    }
}
class MoveDownByScreenLineMaintainDesiredColumn extends MoveByScreenLineMaintainDesiredColumn {
    constructor() {
        super(...arguments);
        this.movementType = "down";
        this.by = "wrappedLine";
        this.value = 1;
    }
}
class MoveDownFoldFix extends MoveByScreenLineMaintainDesiredColumn {
    constructor() {
        super(...arguments);
        this.movementType = "down";
        this.by = "line";
        this.value = 1;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            if (position.line === textEditor_1.TextEditor.getLineCount() - 1) {
                return position;
            }
            let t;
            let count = 0;
            const prevDesiredColumn = vimState.desiredColumn;
            do {
                t = (yield new MoveDownByScreenLine().execAction(position, vimState));
                count += 1;
            } while (t.line === position.line);
            if (t.line > position.line + 1) {
                return t;
            }
            while (count > 0) {
                t = (yield new MoveUpByScreenLine().execAction(position, vimState));
                count--;
            }
            vimState.desiredColumn = prevDesiredColumn;
            return yield position.getDown(vimState.desiredColumn);
        });
    }
}
let MoveDown = class MoveDown extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["j"];
        this.doesntChangeDesiredColumn = true;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            if (configuration_1.Configuration.foldfix && vimState.currentMode !== mode_1.ModeName.VisualBlock) {
                return new MoveDownFoldFix().execAction(position, vimState);
            }
            return position.getDown(vimState.desiredColumn);
        });
    }
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            vimState.currentRegisterMode = register_1.RegisterMode.LineWise;
            return position.getDown(position.getLineEnd().character);
        });
    }
};
MoveDown = __decorate([
    base_1.RegisterAction
], MoveDown);
let MoveDownArrow = class MoveDownArrow extends MoveDown {
    constructor() {
        super(...arguments);
        this.keys = ["<down>"];
    }
};
MoveDownArrow = __decorate([
    base_1.RegisterAction
], MoveDownArrow);
class MoveUpByScreenLineMaintainDesiredColumn extends MoveByScreenLineMaintainDesiredColumn {
    constructor() {
        super(...arguments);
        this.movementType = "up";
        this.by = "wrappedLine";
        this.value = 1;
    }
}
let MoveUp = class MoveUp extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["k"];
        this.doesntChangeDesiredColumn = true;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            if (configuration_1.Configuration.foldfix && vimState.currentMode !== mode_1.ModeName.VisualBlock) {
                return new MoveUpFoldFix().execAction(position, vimState);
            }
            return position.getUp(vimState.desiredColumn);
        });
    }
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            vimState.currentRegisterMode = register_1.RegisterMode.LineWise;
            return position.getUp(position.getLineEnd().character);
        });
    }
};
MoveUp = __decorate([
    base_1.RegisterAction
], MoveUp);
let MoveUpFoldFix = class MoveUpFoldFix extends MoveByScreenLineMaintainDesiredColumn {
    constructor() {
        super(...arguments);
        this.movementType = "up";
        this.by = "line";
        this.value = 1;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            if (position.line === 0) {
                return position;
            }
            let t;
            const prevDesiredColumn = vimState.desiredColumn;
            let count = 0;
            do {
                t = (yield new MoveUpByScreenLineMaintainDesiredColumn().execAction(position, vimState));
                count += 1;
            } while (t.line === position.line);
            vimState.desiredColumn = prevDesiredColumn;
            if (t.line < position.line - 1) {
                return t;
            }
            while (count > 0) {
                t = (yield new MoveDownByScreenLine().execAction(position, vimState));
                count--;
            }
            vimState.desiredColumn = prevDesiredColumn;
            return yield position.getUp(vimState.desiredColumn);
        });
    }
};
MoveUpFoldFix = __decorate([
    base_1.RegisterAction
], MoveUpFoldFix);
let MoveUpArrow = class MoveUpArrow extends MoveUp {
    constructor() {
        super(...arguments);
        this.keys = ["<up>"];
    }
};
MoveUpArrow = __decorate([
    base_1.RegisterAction
], MoveUpArrow);
let ArrowsInReplaceMode = class ArrowsInReplaceMode extends BaseMovement {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Replace];
        this.keys = [
            ["<up>"],
            ["<down>"],
            ["<left>"],
            ["<right>"],
        ];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            let newPosition = position;
            switch (this.keysPressed[0]) {
                case "<up>":
                    newPosition = (yield new MoveUpArrow().execAction(position, vimState));
                    break;
                case "<down>":
                    newPosition = (yield new MoveDownArrow().execAction(position, vimState));
                    break;
                case "<left>":
                    newPosition = yield new MoveLeftArrow().execAction(position, vimState);
                    break;
                case "<right>":
                    newPosition = yield new MoveRightArrow().execAction(position, vimState);
                    break;
                default:
                    break;
            }
            vimState.replaceState = new replaceState_1.ReplaceState(newPosition);
            return newPosition;
        });
    }
};
ArrowsInReplaceMode = __decorate([
    base_1.RegisterAction
], ArrowsInReplaceMode);
let UpArrowInReplaceMode = class UpArrowInReplaceMode extends ArrowsInReplaceMode {
    constructor() {
        super(...arguments);
        this.keys = [["<up>"]];
    }
};
UpArrowInReplaceMode = __decorate([
    base_1.RegisterAction
], UpArrowInReplaceMode);
let DownArrowInReplaceMode = class DownArrowInReplaceMode extends ArrowsInReplaceMode {
    constructor() {
        super(...arguments);
        this.keys = [["<down>"]];
    }
};
DownArrowInReplaceMode = __decorate([
    base_1.RegisterAction
], DownArrowInReplaceMode);
let LeftArrowInReplaceMode = class LeftArrowInReplaceMode extends ArrowsInReplaceMode {
    constructor() {
        super(...arguments);
        this.keys = [["<left>"]];
    }
};
LeftArrowInReplaceMode = __decorate([
    base_1.RegisterAction
], LeftArrowInReplaceMode);
let RightArrowInReplaceMode = class RightArrowInReplaceMode extends ArrowsInReplaceMode {
    constructor() {
        super(...arguments);
        this.keys = [["<right>"]];
    }
};
RightArrowInReplaceMode = __decorate([
    base_1.RegisterAction
], RightArrowInReplaceMode);
let CommandNextSearchMatch = class CommandNextSearchMatch extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["n"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchState = vimState.globalState.searchState;
            if (!searchState || searchState.searchString === "") {
                return position;
            }
            // Turn one of the highlighting flags back on (turned off with :nohl)
            vimState.globalState.hl = true;
            if (vimState.cursorPosition.getRight().isEqual(vimState.cursorPosition.getLineEnd())) {
                return searchState.getNextSearchMatchPosition(vimState.cursorPosition.getRight()).pos;
            }
            // Turn one of the highlighting flags back on (turned off with :nohl)
            return searchState.getNextSearchMatchPosition(vimState.cursorPosition).pos;
        });
    }
};
CommandNextSearchMatch = __decorate([
    base_1.RegisterAction
], CommandNextSearchMatch);
let CommandPreviousSearchMatch = class CommandPreviousSearchMatch extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["N"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchState = vimState.globalState.searchState;
            if (!searchState || searchState.searchString === "") {
                return position;
            }
            // Turn one of the highlighting flags back on (turned off with :nohl)
            vimState.globalState.hl = true;
            return searchState.getNextSearchMatchPosition(vimState.cursorPosition, -1).pos;
        });
    }
};
CommandPreviousSearchMatch = __decorate([
    base_1.RegisterAction
], CommandPreviousSearchMatch);
let MarkMovementBOL = class MarkMovementBOL extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["'", "<character>"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const markName = this.keysPressed[1];
            const mark = vimState.historyTracker.getMark(markName);
            vimState.currentRegisterMode = register_1.RegisterMode.LineWise;
            return mark.position.getFirstLineNonBlankChar();
        });
    }
};
MarkMovementBOL = __decorate([
    base_1.RegisterAction
], MarkMovementBOL);
exports.MarkMovementBOL = MarkMovementBOL;
let MarkMovement = class MarkMovement extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["`", "<character>"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const markName = this.keysPressed[1];
            const mark = vimState.historyTracker.getMark(markName);
            return mark.position;
        });
    }
};
MarkMovement = __decorate([
    base_1.RegisterAction
], MarkMovement);
exports.MarkMovement = MarkMovement;
let MoveLeft = class MoveLeft extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["h"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getLeft();
        });
    }
};
MoveLeft = __decorate([
    base_1.RegisterAction
], MoveLeft);
exports.MoveLeft = MoveLeft;
let MoveLeftArrow = class MoveLeftArrow extends MoveLeft {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<left>"];
    }
};
MoveLeftArrow = __decorate([
    base_1.RegisterAction
], MoveLeftArrow);
let BackSpaceInNormalMode = class BackSpaceInNormalMode extends BaseMovement {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal];
        this.keys = ["<BS>"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getLeftThroughLineBreaks();
        });
    }
};
BackSpaceInNormalMode = __decorate([
    base_1.RegisterAction
], BackSpaceInNormalMode);
let MoveRight = class MoveRight extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["l"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return new position_1.Position(position.line, position.character + 1);
        });
    }
};
MoveRight = __decorate([
    base_1.RegisterAction
], MoveRight);
let MoveRightArrow = class MoveRightArrow extends MoveRight {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<right>"];
    }
};
MoveRightArrow = __decorate([
    base_1.RegisterAction
], MoveRightArrow);
let MoveRightWithSpace = class MoveRightWithSpace extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = [" "];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getRightThroughLineBreaks();
        });
    }
};
MoveRightWithSpace = __decorate([
    base_1.RegisterAction
], MoveRightWithSpace);
let MoveDownNonBlank = class MoveDownNonBlank extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["+"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getDownByCount(Math.max(count, 1))
                .getFirstLineNonBlankChar();
        });
    }
};
MoveDownNonBlank = __decorate([
    base_1.RegisterAction
], MoveDownNonBlank);
let MoveUpNonBlank = class MoveUpNonBlank extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["-"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getUpByCount(Math.max(count, 1))
                .getFirstLineNonBlankChar();
        });
    }
};
MoveUpNonBlank = __decorate([
    base_1.RegisterAction
], MoveUpNonBlank);
let MoveDownUnderscore = class MoveDownUnderscore extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["_"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getDownByCount(Math.max(count - 1, 0))
                .getFirstLineNonBlankChar();
        });
    }
};
MoveDownUnderscore = __decorate([
    base_1.RegisterAction
], MoveDownUnderscore);
let MoveToColumn = class MoveToColumn extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["|"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            return new position_1.Position(position.line, Math.max(0, count - 1));
        });
    }
};
MoveToColumn = __decorate([
    base_1.RegisterAction
], MoveToColumn);
let MoveFindForward = class MoveFindForward extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["f", "<character>"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            count = count || 1;
            const toFind = this.keysPressed[1];
            let result = position.findForwards(toFind, count);
            if (!result) {
                return { start: position, stop: position, failed: true };
            }
            if (vimState.recordedState.operator) {
                result = result.getRight();
            }
            return result;
        });
    }
    canBeRepeatedWithSemicolon(vimState, result) {
        return !vimState.recordedState.operator || !(isIMovement(result) && result.failed);
    }
};
MoveFindForward = __decorate([
    base_1.RegisterAction
], MoveFindForward);
let MoveFindBackward = class MoveFindBackward extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["F", "<character>"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            count = count || 1;
            const toFind = this.keysPressed[1];
            let result = position.findBackwards(toFind, count);
            if (!result) {
                return { start: position, stop: position, failed: true };
            }
            return result;
        });
    }
    canBeRepeatedWithSemicolon(vimState, result) {
        return !vimState.recordedState.operator || !(isIMovement(result) && result.failed);
    }
};
MoveFindBackward = __decorate([
    base_1.RegisterAction
], MoveFindBackward);
let MoveTilForward = class MoveTilForward extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["t", "<character>"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            count = count || 1;
            const toFind = this.keysPressed[1];
            let result = position.tilForwards(toFind, count);
            if (!result) {
                return { start: position, stop: position, failed: true };
            }
            if (vimState.recordedState.operator) {
                result = result.getRight();
            }
            return result;
        });
    }
    canBeRepeatedWithSemicolon(vimState, result) {
        return !vimState.recordedState.operator || !(isIMovement(result) && result.failed);
    }
};
MoveTilForward = __decorate([
    base_1.RegisterAction
], MoveTilForward);
let MoveTilBackward = class MoveTilBackward extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["T", "<character>"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            count = count || 1;
            const toFind = this.keysPressed[1];
            let result = position.tilBackwards(toFind, count);
            if (!result) {
                return { start: position, stop: position, failed: true };
            }
            return result;
        });
    }
    canBeRepeatedWithSemicolon(vimState, result) {
        return !vimState.recordedState.operator || !(isIMovement(result) && result.failed);
    }
};
MoveTilBackward = __decorate([
    base_1.RegisterAction
], MoveTilBackward);
let MoveRepeat = class MoveRepeat extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = [";"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            const movement = modeHandler_1.VimState.lastRepeatableMovement;
            if (movement) {
                const result = yield movement.execActionWithCount(position, vimState, count);
                /**
                 * For t<character> and T<character> commands vim executes ; as 2;
                 * This way the cursor will get to the next instance of <character>
                 */
                if (result instanceof position_1.Position && position.isEqual(result) && count <= 1) {
                    return yield movement.execActionWithCount(position, vimState, 2);
                }
                return result;
            }
            return position;
        });
    }
};
MoveRepeat = __decorate([
    base_1.RegisterAction
], MoveRepeat);
let MoveRepeatReversed = MoveRepeatReversed_1 = class MoveRepeatReversed extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = [","];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            const movement = modeHandler_1.VimState.lastRepeatableMovement;
            if (movement) {
                const reverse = MoveRepeatReversed_1.reverseMotionMapping.get(movement.constructor)();
                reverse.keysPressed = [reverse.keys[0], movement.keysPressed[1]];
                let result = yield reverse.execActionWithCount(position, vimState, count);
                // For t<character> and T<character> commands vim executes ; as 2;
                if (result instanceof position_1.Position && position.isEqual(result) && count <= 1) {
                    result = yield reverse.execActionWithCount(position, vimState, 2);
                }
                return result;
            }
            return position;
        });
    }
};
MoveRepeatReversed.reverseMotionMapping = new Map([
    [MoveFindForward, () => new MoveFindBackward()],
    [MoveFindBackward, () => new MoveFindForward()],
    [MoveTilForward, () => new MoveTilBackward()],
    [MoveTilBackward, () => new MoveTilForward()]
]);
MoveRepeatReversed = MoveRepeatReversed_1 = __decorate([
    base_1.RegisterAction
], MoveRepeatReversed);
let MoveLineEnd = class MoveLineEnd extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = [
            ["$"],
            ["<end>"],
            ["<D-right>"]
        ];
        this.setsDesiredColumnToEOL = true;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getLineEnd();
        });
    }
};
MoveLineEnd = __decorate([
    base_1.RegisterAction
], MoveLineEnd);
let MoveLineBegin = class MoveLineBegin extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = [["0"],
            ["<home>"],
            ["<D-left>"]];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getLineBegin();
        });
    }
    doesActionApply(vimState, keysPressed) {
        return super.doesActionApply(vimState, keysPressed) &&
            vimState.recordedState.count === 0;
    }
    couldActionApply(vimState, keysPressed) {
        return super.couldActionApply(vimState, keysPressed) &&
            vimState.recordedState.count === 0;
    }
};
MoveLineBegin = __decorate([
    base_1.RegisterAction
], MoveLineBegin);
let MoveScreenLineBegin = class MoveScreenLineBegin extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.keys = ["g", "0"];
        this.movementType = "wrappedLineStart";
    }
};
MoveScreenLineBegin = __decorate([
    base_1.RegisterAction
], MoveScreenLineBegin);
let MoveScreenNonBlank = class MoveScreenNonBlank extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.keys = ["g", "^"];
        this.movementType = "wrappedLineFirstNonWhitespaceCharacter";
    }
};
MoveScreenNonBlank = __decorate([
    base_1.RegisterAction
], MoveScreenNonBlank);
let MoveScreenLineEnd = class MoveScreenLineEnd extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.keys = ["g", "$"];
        this.movementType = "wrappedLineEnd";
    }
};
MoveScreenLineEnd = __decorate([
    base_1.RegisterAction
], MoveScreenLineEnd);
let MoveScreenLineEndNonBlank = class MoveScreenLineEndNonBlank extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.keys = ["g", "_"];
        this.movementType = "wrappedLineLastNonWhitespaceCharacter";
        this.canBePrefixedWithCount = true;
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            count = count || 1;
            const pos = yield this.execAction(position, vimState);
            const newPos = pos;
            // If in visual, return a selection
            if (pos instanceof position_1.Position) {
                return pos.getDownByCount(count - 1);
            }
            else if (isIMovement(pos)) {
                return { start: pos.start, stop: pos.stop.getDownByCount(count - 1).getLeft() };
            }
            return newPos.getDownByCount(count - 1);
        });
    }
};
MoveScreenLineEndNonBlank = __decorate([
    base_1.RegisterAction
], MoveScreenLineEndNonBlank);
let MoveScreenLineCenter = class MoveScreenLineCenter extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.keys = ["g", "m"];
        this.movementType = "wrappedLineColumnCenter";
    }
};
MoveScreenLineCenter = __decorate([
    base_1.RegisterAction
], MoveScreenLineCenter);
let MoveUpByScreenLine = class MoveUpByScreenLine extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Insert, mode_1.ModeName.Normal, mode_1.ModeName.Visual];
        this.keys = [["g", "k"],
            ["g", "<up>"]];
        this.movementType = "up";
        this.by = "wrappedLine";
        this.value = 1;
    }
};
MoveUpByScreenLine = __decorate([
    base_1.RegisterAction
], MoveUpByScreenLine);
exports.MoveUpByScreenLine = MoveUpByScreenLine;
let MoveDownByScreenLine = class MoveDownByScreenLine extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Insert, mode_1.ModeName.Normal, mode_1.ModeName.Visual];
        this.keys = [["g", "j"],
            ["g", "<down>"]];
        this.movementType = "down";
        this.by = "wrappedLine";
        this.value = 1;
    }
};
MoveDownByScreenLine = __decorate([
    base_1.RegisterAction
], MoveDownByScreenLine);
// Because we can't support moving by screen line when in visualLine mode,
// we change to moving by regular line in visualLine mode. We can't move by
// screen line is that our ranges only support a start and stop attribute,
// and moving by screen line just snaps us back to the original position.
// Check PR #1600 for discussion.
let MoveUpByScreenLineVisualLine = class MoveUpByScreenLineVisualLine extends MoveByScreenLine {
    // Because we can't support moving by screen line when in visualLine mode,
    // we change to moving by regular line in visualLine mode. We can't move by
    // screen line is that our ranges only support a start and stop attribute,
    // and moving by screen line just snaps us back to the original position.
    // Check PR #1600 for discussion.
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.VisualLine];
        this.keys = [["g", "k"],
            ["g", "<up>"]];
        this.movementType = "up";
        this.by = "line";
        this.value = 1;
    }
};
MoveUpByScreenLineVisualLine = __decorate([
    base_1.RegisterAction
], MoveUpByScreenLineVisualLine);
let MoveDownByScreenLineVisualLine = class MoveDownByScreenLineVisualLine extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.VisualLine];
        this.keys = [["g", "j"],
            ["g", "<down>"]];
        this.movementType = "down";
        this.by = "line";
        this.value = 1;
    }
};
MoveDownByScreenLineVisualLine = __decorate([
    base_1.RegisterAction
], MoveDownByScreenLineVisualLine);
let MoveScreenToRight = class MoveScreenToRight extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Insert, mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine];
        this.keys = ["z", "h"];
        this.movementType = "right";
        this.by = "character";
        this.value = 1;
    }
};
MoveScreenToRight = __decorate([
    base_1.RegisterAction
], MoveScreenToRight);
let MoveScreenToLeft = class MoveScreenToLeft extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Insert, mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine];
        this.keys = ["z", "l"];
        this.movementType = "left";
        this.by = "character";
        this.value = 1;
    }
};
MoveScreenToLeft = __decorate([
    base_1.RegisterAction
], MoveScreenToLeft);
let MoveScreenToRightHalf = class MoveScreenToRightHalf extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Insert, mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine];
        this.keys = ["z", "H"];
        this.movementType = "right";
        this.by = "halfLine";
        this.value = 1;
    }
};
MoveScreenToRightHalf = __decorate([
    base_1.RegisterAction
], MoveScreenToRightHalf);
let MoveScreenToLeftHalf = class MoveScreenToLeftHalf extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Insert, mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine];
        this.keys = ["z", "L"];
        this.movementType = "left";
        this.by = "halfLine";
        this.value = 1;
    }
};
MoveScreenToLeftHalf = __decorate([
    base_1.RegisterAction
], MoveScreenToLeftHalf);
let MoveToLineFromViewPortTop = class MoveToLineFromViewPortTop extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.keys = ["H"];
        this.movementType = "viewPortTop";
        this.by = "line";
        this.value = 1;
        this.canBePrefixedWithCount = true;
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            this.value = count < 1 ? 1 : count;
            return yield this.execAction(position, vimState);
        });
    }
};
MoveToLineFromViewPortTop = __decorate([
    base_1.RegisterAction
], MoveToLineFromViewPortTop);
let MoveToLineFromViewPortBottom = class MoveToLineFromViewPortBottom extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.keys = ["L"];
        this.movementType = "viewPortBottom";
        this.by = "line";
        this.value = 1;
        this.canBePrefixedWithCount = true;
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            this.value = count < 1 ? 1 : count;
            return yield this.execAction(position, vimState);
        });
    }
};
MoveToLineFromViewPortBottom = __decorate([
    base_1.RegisterAction
], MoveToLineFromViewPortBottom);
let MoveToMiddleLineInViewPort = class MoveToMiddleLineInViewPort extends MoveByScreenLine {
    constructor() {
        super(...arguments);
        this.keys = ["M"];
        this.movementType = "viewPortCenter";
        this.by = "line";
    }
};
MoveToMiddleLineInViewPort = __decorate([
    base_1.RegisterAction
], MoveToMiddleLineInViewPort);
let MoveNonBlank = class MoveNonBlank extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["^"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getFirstLineNonBlankChar();
        });
    }
};
MoveNonBlank = __decorate([
    base_1.RegisterAction
], MoveNonBlank);
let MoveNextLineNonBlank = class MoveNextLineNonBlank extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["\n"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            vimState.currentRegisterMode = register_1.RegisterMode.LineWise;
            // Count === 0 if just pressing enter in normal mode, need to still go down 1 line
            if (count === 0) {
                count++;
            }
            return position.getDownByCount(count).getFirstLineNonBlankChar();
        });
    }
};
MoveNextLineNonBlank = __decorate([
    base_1.RegisterAction
], MoveNextLineNonBlank);
let MoveNonBlankFirst = class MoveNonBlankFirst extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["g", "g"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            if (count === 0) {
                return position.getDocumentBegin().getFirstLineNonBlankChar();
            }
            return new position_1.Position(count - 1, 0).getFirstLineNonBlankChar();
        });
    }
};
MoveNonBlankFirst = __decorate([
    base_1.RegisterAction
], MoveNonBlankFirst);
let MoveNonBlankLast = class MoveNonBlankLast extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["G"];
    }
    execActionWithCount(position, vimState, count) {
        return __awaiter(this, void 0, void 0, function* () {
            let stop;
            if (count === 0) {
                stop = new position_1.Position(textEditor_1.TextEditor.getLineCount() - 1, 0);
            }
            else {
                stop = new position_1.Position(Math.min(count, textEditor_1.TextEditor.getLineCount()) - 1, 0);
            }
            return {
                start: vimState.cursorStartPosition,
                stop: stop,
                registerMode: register_1.RegisterMode.LineWise
            };
        });
    }
};
MoveNonBlankLast = __decorate([
    base_1.RegisterAction
], MoveNonBlankLast);
let MoveWordBegin = class MoveWordBegin extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["w"];
    }
    execAction(position, vimState, isLastIteration = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (isLastIteration && vimState.recordedState.operator instanceof operator_1.ChangeOperator) {
                if (textEditor_1.TextEditor.getLineAt(position).text.length < 1) {
                    return position;
                }
                const line = textEditor_1.TextEditor.getLineAt(position).text;
                const char = line[position.character];
                /*
                From the Vim manual:
          
                Special case: "cw" and "cW" are treated like "ce" and "cE" if the cursor is
                on a non-blank.  This is because "cw" is interpreted as change-word, and a
                word does not include the following white space.
                */
                if (" \t".indexOf(char) >= 0) {
                    return position.getWordRight();
                }
                else {
                    return position.getCurrentWordEnd(true).getRight();
                }
            }
            else {
                return position.getWordRight();
            }
        });
    }
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.execAction(position, vimState, true);
            /*
            From the Vim documentation:
        
            Another special case: When using the "w" motion in combination with an
            operator and the last word moved over is at the end of a line, the end of
            that word becomes the end of the operated text, not the first word in the
            next line.
            */
            if (result.line > position.line + 1 || (result.line === position.line + 1 && result.isFirstWordOfLine())) {
                return position.getLineEnd();
            }
            if (result.isLineEnd()) {
                return new position_1.Position(result.line, result.character + 1);
            }
            return result;
        });
    }
};
MoveWordBegin = __decorate([
    base_1.RegisterAction
], MoveWordBegin);
exports.MoveWordBegin = MoveWordBegin;
let MoveFullWordBegin = class MoveFullWordBegin extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["W"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            if (vimState.recordedState.operator instanceof operator_1.ChangeOperator) {
                // TODO use execForOperator? Or maybe dont?
                // See note for w
                return position.getCurrentBigWordEnd().getRight();
            }
            else {
                return position.getBigWordRight();
            }
        });
    }
};
MoveFullWordBegin = __decorate([
    base_1.RegisterAction
], MoveFullWordBegin);
let MoveWordEnd = class MoveWordEnd extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["e"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getCurrentWordEnd();
        });
    }
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            let end = position.getCurrentWordEnd();
            return new position_1.Position(end.line, end.character + 1);
        });
    }
};
MoveWordEnd = __decorate([
    base_1.RegisterAction
], MoveWordEnd);
let MoveFullWordEnd = class MoveFullWordEnd extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["E"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getCurrentBigWordEnd();
        });
    }
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getCurrentBigWordEnd().getRight();
        });
    }
};
MoveFullWordEnd = __decorate([
    base_1.RegisterAction
], MoveFullWordEnd);
let MoveLastWordEnd = class MoveLastWordEnd extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["g", "e"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getLastWordEnd();
        });
    }
};
MoveLastWordEnd = __decorate([
    base_1.RegisterAction
], MoveLastWordEnd);
let MoveLastFullWordEnd = class MoveLastFullWordEnd extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["g", "E"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getLastBigWordEnd();
        });
    }
};
MoveLastFullWordEnd = __decorate([
    base_1.RegisterAction
], MoveLastFullWordEnd);
let MoveBeginningWord = class MoveBeginningWord extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["b"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getWordLeft();
        });
    }
};
MoveBeginningWord = __decorate([
    base_1.RegisterAction
], MoveBeginningWord);
let MoveBeginningFullWord = class MoveBeginningFullWord extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["B"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getBigWordLeft();
        });
    }
};
MoveBeginningFullWord = __decorate([
    base_1.RegisterAction
], MoveBeginningFullWord);
let MovePreviousSentenceBegin = class MovePreviousSentenceBegin extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["("];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getSentenceBegin({ forward: false });
        });
    }
};
MovePreviousSentenceBegin = __decorate([
    base_1.RegisterAction
], MovePreviousSentenceBegin);
let MoveNextSentenceBegin = class MoveNextSentenceBegin extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = [")"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getSentenceBegin({ forward: true });
        });
    }
};
MoveNextSentenceBegin = __decorate([
    base_1.RegisterAction
], MoveNextSentenceBegin);
let MoveParagraphEnd = class MoveParagraphEnd extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["}"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const isLineWise = position.isLineBeginning() && vimState.currentMode === mode_1.ModeName.Normal && vimState.recordedState.operator;
            let paragraphEnd = position.getCurrentParagraphEnd();
            vimState.currentRegisterMode = isLineWise ? register_1.RegisterMode.LineWise : register_1.RegisterMode.FigureItOutFromCurrentMode;
            return (isLineWise ? paragraphEnd.getLeftThroughLineBreaks(true) : paragraphEnd);
        });
    }
};
MoveParagraphEnd = __decorate([
    base_1.RegisterAction
], MoveParagraphEnd);
let MoveParagraphBegin = class MoveParagraphBegin extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["{"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getCurrentParagraphBeginning();
        });
    }
};
MoveParagraphBegin = __decorate([
    base_1.RegisterAction
], MoveParagraphBegin);
class MoveSectionBoundary extends BaseMovement {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            return position.getSectionBoundary({
                forward: this.forward,
                boundary: this.boundary
            });
        });
    }
}
let MoveNextSectionBegin = class MoveNextSectionBegin extends MoveSectionBoundary {
    constructor() {
        super(...arguments);
        this.keys = ["]", "]"];
        this.boundary = "{";
        this.forward = true;
    }
};
MoveNextSectionBegin = __decorate([
    base_1.RegisterAction
], MoveNextSectionBegin);
let MoveNextSectionEnd = class MoveNextSectionEnd extends MoveSectionBoundary {
    constructor() {
        super(...arguments);
        this.keys = ["]", "["];
        this.boundary = "}";
        this.forward = true;
    }
};
MoveNextSectionEnd = __decorate([
    base_1.RegisterAction
], MoveNextSectionEnd);
let MovePreviousSectionBegin = class MovePreviousSectionBegin extends MoveSectionBoundary {
    constructor() {
        super(...arguments);
        this.keys = ["[", "["];
        this.boundary = "{";
        this.forward = false;
    }
};
MovePreviousSectionBegin = __decorate([
    base_1.RegisterAction
], MovePreviousSectionBegin);
let MovePreviousSectionEnd = class MovePreviousSectionEnd extends MoveSectionBoundary {
    constructor() {
        super(...arguments);
        this.keys = ["[", "]"];
        this.boundary = "}";
        this.forward = false;
    }
};
MovePreviousSectionEnd = __decorate([
    base_1.RegisterAction
], MovePreviousSectionEnd);
let MoveToMatchingBracket = MoveToMatchingBracket_1 = class MoveToMatchingBracket extends BaseMovement {
    constructor() {
        super(...arguments);
        this.keys = ["%"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            position = position.getLeftIfEOL();
            const text = textEditor_1.TextEditor.getLineAt(position).text;
            const charToMatch = text[position.character];
            const toFind = matcher_1.PairMatcher.pairings[charToMatch];
            const failure = { start: position, stop: position, failed: true };
            if (!toFind || !toFind.matchesWithPercentageMotion) {
                // If we're not on a match, go right until we find a
                // pairable character or hit the end of line.
                for (let i = position.character; i < text.length; i++) {
                    if (matcher_1.PairMatcher.pairings[text[i]]) {
                        // We found an opening char, now move to the matching closing char
                        const openPosition = new position_1.Position(position.line, i);
                        const result = matcher_1.PairMatcher.nextPairedChar(openPosition, text[i], true);
                        if (!result) {
                            return failure;
                        }
                        return result;
                    }
                }
                return failure;
            }
            const result = matcher_1.PairMatcher.nextPairedChar(position, charToMatch, true);
            if (!result) {
                return failure;
            }
            return result;
        });
    }
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.execAction(position, vimState);
            if (isIMovement(result)) {
                if (result.failed) {
                    return result;
                }
                else {
                    throw new Error("Did not ever handle this case!");
                }
            }
            if (position.compareTo(result) > 0) {
                return {
                    start: result,
                    stop: position.getRight(),
                };
            }
            else {
                return result.getRight();
            }
        });
    }
    execActionWithCount(position, vimState, count) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            // % has a special mode that lets you use it to jump to a percentage of the file
            // However, some other bracket motions inherit from this so only do this behavior for % explicitly
            if (Object.getPrototypeOf(this) === MoveToMatchingBracket_1.prototype) {
                if (count === 0) {
                    if (vimState.recordedState.operator) {
                        return this.execActionForOperator(position, vimState);
                    }
                    else {
                        return this.execAction(position, vimState);
                    }
                }
                // Check to make sure this is a valid percentage
                if (count < 0 || count > 100) {
                    return { start: position, stop: position, failed: true };
                }
                const targetLine = Math.round((count * textEditor_1.TextEditor.getLineCount()) / 100);
                return new position_1.Position(targetLine - 1, 0).getFirstLineNonBlankChar();
            }
            else {
                return _super("execActionWithCount").call(this, position, vimState, count);
            }
        });
    }
};
MoveToMatchingBracket = MoveToMatchingBracket_1 = __decorate([
    base_1.RegisterAction
], MoveToMatchingBracket);
class MoveInsideCharacter extends BaseMovement {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.includeSurrounding = false;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const failure = { start: position, stop: position, failed: true };
            const text = textEditor_1.TextEditor.getLineAt(position).text;
            const closingChar = matcher_1.PairMatcher.pairings[this.charToMatch].match;
            const closedMatch = text[position.character] === closingChar;
            // First, search backwards for the opening character of the sequence
            let startPos = matcher_1.PairMatcher.nextPairedChar(position, closingChar, closedMatch);
            if (startPos === undefined) {
                return failure;
            }
            let startPlusOne;
            if (startPos.isAfterOrEqual(startPos.getLineEnd().getLeft())) {
                startPlusOne = new position_1.Position(startPos.line + 1, 0);
            }
            else {
                startPlusOne = new position_1.Position(startPos.line, startPos.character + 1);
            }
            let endPos = matcher_1.PairMatcher.nextPairedChar(startPlusOne, this.charToMatch, false);
            if (endPos === undefined) {
                return failure;
            }
            if (this.includeSurrounding) {
                if (vimState.currentMode !== mode_1.ModeName.Visual) {
                    endPos = new position_1.Position(endPos.line, endPos.character + 1);
                }
            }
            else {
                startPos = startPlusOne;
                if (vimState.currentMode === mode_1.ModeName.Visual) {
                    endPos = endPos.getLeftThroughLineBreaks();
                }
            }
            // If the closing character is the first on the line, don't swallow it.
            if (!this.includeSurrounding) {
                if (endPos.getLeft().isInLeadingWhitespace()) {
                    endPos = endPos.getLineBegin();
                }
            }
            if (position.isBefore(startPos)) {
                vimState.recordedState.operatorPositionDiff = startPos.subtract(position);
            }
            return {
                start: startPos,
                stop: endPos,
                diff: new position_1.PositionDiff(0, startPos === position ? 1 : 0)
            };
        });
    }
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.execAction(position, vimState);
            if (isIMovement(result)) {
                if (result.failed) {
                    vimState.recordedState.hasRunOperator = false;
                    vimState.recordedState.actionsRun = [];
                }
            }
            return result;
        });
    }
}
exports.MoveInsideCharacter = MoveInsideCharacter;
let MoveIParentheses = class MoveIParentheses extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["i", "("];
        this.charToMatch = "(";
    }
};
MoveIParentheses = __decorate([
    base_1.RegisterAction
], MoveIParentheses);
let MoveIClosingParentheses = class MoveIClosingParentheses extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["i", ")"];
        this.charToMatch = "(";
    }
};
MoveIClosingParentheses = __decorate([
    base_1.RegisterAction
], MoveIClosingParentheses);
let MoveIClosingParenthesesBlock = class MoveIClosingParenthesesBlock extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["i", "b"];
        this.charToMatch = "(";
    }
};
MoveIClosingParenthesesBlock = __decorate([
    base_1.RegisterAction
], MoveIClosingParenthesesBlock);
let MoveAParentheses = class MoveAParentheses extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["a", "("];
        this.charToMatch = "(";
        this.includeSurrounding = true;
    }
};
MoveAParentheses = __decorate([
    base_1.RegisterAction
], MoveAParentheses);
exports.MoveAParentheses = MoveAParentheses;
let MoveAClosingParentheses = class MoveAClosingParentheses extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["a", ")"];
        this.charToMatch = "(";
        this.includeSurrounding = true;
    }
};
MoveAClosingParentheses = __decorate([
    base_1.RegisterAction
], MoveAClosingParentheses);
let MoveAParenthesesBlock = class MoveAParenthesesBlock extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["a", "b"];
        this.charToMatch = "(";
        this.includeSurrounding = true;
    }
};
MoveAParenthesesBlock = __decorate([
    base_1.RegisterAction
], MoveAParenthesesBlock);
let MoveICurlyBrace = class MoveICurlyBrace extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["i", "{"];
        this.charToMatch = "{";
    }
};
MoveICurlyBrace = __decorate([
    base_1.RegisterAction
], MoveICurlyBrace);
let MoveIClosingCurlyBrace = class MoveIClosingCurlyBrace extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["i", "}"];
        this.charToMatch = "{";
    }
};
MoveIClosingCurlyBrace = __decorate([
    base_1.RegisterAction
], MoveIClosingCurlyBrace);
let MoveIClosingCurlyBraceBlock = class MoveIClosingCurlyBraceBlock extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["i", "B"];
        this.charToMatch = "{";
    }
};
MoveIClosingCurlyBraceBlock = __decorate([
    base_1.RegisterAction
], MoveIClosingCurlyBraceBlock);
let MoveACurlyBrace = class MoveACurlyBrace extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["a", "{"];
        this.charToMatch = "{";
        this.includeSurrounding = true;
    }
};
MoveACurlyBrace = __decorate([
    base_1.RegisterAction
], MoveACurlyBrace);
exports.MoveACurlyBrace = MoveACurlyBrace;
let MoveAClosingCurlyBrace = class MoveAClosingCurlyBrace extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["a", "}"];
        this.charToMatch = "{";
        this.includeSurrounding = true;
    }
};
MoveAClosingCurlyBrace = __decorate([
    base_1.RegisterAction
], MoveAClosingCurlyBrace);
exports.MoveAClosingCurlyBrace = MoveAClosingCurlyBrace;
let MoveAClosingCurlyBraceBlock = class MoveAClosingCurlyBraceBlock extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["a", "B"];
        this.charToMatch = "{";
        this.includeSurrounding = true;
    }
};
MoveAClosingCurlyBraceBlock = __decorate([
    base_1.RegisterAction
], MoveAClosingCurlyBraceBlock);
let MoveICaret = class MoveICaret extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["i", "<"];
        this.charToMatch = "<";
    }
};
MoveICaret = __decorate([
    base_1.RegisterAction
], MoveICaret);
let MoveIClosingCaret = class MoveIClosingCaret extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["i", ">"];
        this.charToMatch = "<";
    }
};
MoveIClosingCaret = __decorate([
    base_1.RegisterAction
], MoveIClosingCaret);
let MoveACaret = class MoveACaret extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["a", "<"];
        this.charToMatch = "<";
        this.includeSurrounding = true;
    }
};
MoveACaret = __decorate([
    base_1.RegisterAction
], MoveACaret);
exports.MoveACaret = MoveACaret;
let MoveAClosingCaret = class MoveAClosingCaret extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["a", ">"];
        this.charToMatch = "<";
        this.includeSurrounding = true;
    }
};
MoveAClosingCaret = __decorate([
    base_1.RegisterAction
], MoveAClosingCaret);
let MoveISquareBracket = class MoveISquareBracket extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["i", "["];
        this.charToMatch = "[";
    }
};
MoveISquareBracket = __decorate([
    base_1.RegisterAction
], MoveISquareBracket);
let MoveIClosingSquareBraket = class MoveIClosingSquareBraket extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["i", "]"];
        this.charToMatch = "[";
    }
};
MoveIClosingSquareBraket = __decorate([
    base_1.RegisterAction
], MoveIClosingSquareBraket);
let MoveASquareBracket = class MoveASquareBracket extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["a", "["];
        this.charToMatch = "[";
        this.includeSurrounding = true;
    }
};
MoveASquareBracket = __decorate([
    base_1.RegisterAction
], MoveASquareBracket);
exports.MoveASquareBracket = MoveASquareBracket;
let MoveAClosingSquareBracket = class MoveAClosingSquareBracket extends MoveInsideCharacter {
    constructor() {
        super(...arguments);
        this.keys = ["a", "]"];
        this.charToMatch = "[";
        this.includeSurrounding = true;
    }
};
MoveAClosingSquareBracket = __decorate([
    base_1.RegisterAction
], MoveAClosingSquareBracket);
class MoveQuoteMatch extends BaseMovement {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualBlock];
        this.includeSurrounding = false;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const text = textEditor_1.TextEditor.getLineAt(position).text;
            const quoteMatcher = new quoteMatcher_1.QuoteMatcher(this.charToMatch, text);
            const start = quoteMatcher.findOpening(position.character);
            const end = quoteMatcher.findClosing(start + 1);
            if (start === -1 || end === -1 || end === start || end < position.character) {
                return {
                    start: position,
                    stop: position,
                    failed: true
                };
            }
            let startPos = new position_1.Position(position.line, start);
            let endPos = new position_1.Position(position.line, end);
            if (!this.includeSurrounding) {
                startPos = startPos.getRight();
                endPos = endPos.getLeft();
            }
            if (position.isBefore(startPos)) {
                vimState.recordedState.operatorPositionDiff = startPos.subtract(position);
            }
            return {
                start: startPos,
                stop: endPos
            };
        });
    }
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.execAction(position, vimState);
            if (isIMovement(result)) {
                if (result.failed) {
                    vimState.recordedState.hasRunOperator = false;
                    vimState.recordedState.actionsRun = [];
                }
                else {
                    result.stop = result.stop.getRight();
                }
            }
            return result;
        });
    }
}
exports.MoveQuoteMatch = MoveQuoteMatch;
let MoveInsideSingleQuotes = class MoveInsideSingleQuotes extends MoveQuoteMatch {
    constructor() {
        super(...arguments);
        this.keys = ["i", "'"];
        this.charToMatch = "'";
        this.includeSurrounding = false;
    }
};
MoveInsideSingleQuotes = __decorate([
    base_1.RegisterAction
], MoveInsideSingleQuotes);
let MoveASingleQuotes = class MoveASingleQuotes extends MoveQuoteMatch {
    constructor() {
        super(...arguments);
        this.keys = ["a", "'"];
        this.charToMatch = "'";
        this.includeSurrounding = true;
    }
};
MoveASingleQuotes = __decorate([
    base_1.RegisterAction
], MoveASingleQuotes);
exports.MoveASingleQuotes = MoveASingleQuotes;
let MoveInsideDoubleQuotes = class MoveInsideDoubleQuotes extends MoveQuoteMatch {
    constructor() {
        super(...arguments);
        this.keys = ["i", "\""];
        this.charToMatch = "\"";
        this.includeSurrounding = false;
    }
};
MoveInsideDoubleQuotes = __decorate([
    base_1.RegisterAction
], MoveInsideDoubleQuotes);
let MoveADoubleQuotes = class MoveADoubleQuotes extends MoveQuoteMatch {
    constructor() {
        super(...arguments);
        this.keys = ["a", "\""];
        this.charToMatch = "\"";
        this.includeSurrounding = true;
    }
};
MoveADoubleQuotes = __decorate([
    base_1.RegisterAction
], MoveADoubleQuotes);
exports.MoveADoubleQuotes = MoveADoubleQuotes;
let MoveInsideBacktick = class MoveInsideBacktick extends MoveQuoteMatch {
    constructor() {
        super(...arguments);
        this.keys = ["i", "`"];
        this.charToMatch = "`";
        this.includeSurrounding = false;
    }
};
MoveInsideBacktick = __decorate([
    base_1.RegisterAction
], MoveInsideBacktick);
let MoveABacktick = class MoveABacktick extends MoveQuoteMatch {
    constructor() {
        super(...arguments);
        this.keys = ["a", "`"];
        this.charToMatch = "`";
        this.includeSurrounding = true;
    }
};
MoveABacktick = __decorate([
    base_1.RegisterAction
], MoveABacktick);
exports.MoveABacktick = MoveABacktick;
let MoveToUnclosedRoundBracketBackward = class MoveToUnclosedRoundBracketBackward extends MoveToMatchingBracket {
    constructor() {
        super(...arguments);
        this.keys = ["[", "("];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const failure = { start: position, stop: position, failed: true };
            const charToMatch = ")";
            const result = matcher_1.PairMatcher.nextPairedChar(position.getLeftThroughLineBreaks(), charToMatch, false);
            if (!result) {
                return failure;
            }
            return result;
        });
    }
};
MoveToUnclosedRoundBracketBackward = __decorate([
    base_1.RegisterAction
], MoveToUnclosedRoundBracketBackward);
let MoveToUnclosedRoundBracketForward = class MoveToUnclosedRoundBracketForward extends MoveToMatchingBracket {
    constructor() {
        super(...arguments);
        this.keys = ["]", ")"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const failure = { start: position, stop: position, failed: true };
            const charToMatch = "(";
            const result = matcher_1.PairMatcher.nextPairedChar(position.getRightThroughLineBreaks(), charToMatch, false);
            if (!result) {
                return failure;
            }
            return result;
        });
    }
};
MoveToUnclosedRoundBracketForward = __decorate([
    base_1.RegisterAction
], MoveToUnclosedRoundBracketForward);
let MoveToUnclosedCurlyBracketBackward = class MoveToUnclosedCurlyBracketBackward extends MoveToMatchingBracket {
    constructor() {
        super(...arguments);
        this.keys = ["[", "{"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const failure = { start: position, stop: position, failed: true };
            const charToMatch = "}";
            const result = matcher_1.PairMatcher.nextPairedChar(position.getLeftThroughLineBreaks(), charToMatch, false);
            if (!result) {
                return failure;
            }
            return result;
        });
    }
};
MoveToUnclosedCurlyBracketBackward = __decorate([
    base_1.RegisterAction
], MoveToUnclosedCurlyBracketBackward);
let MoveToUnclosedCurlyBracketForward = class MoveToUnclosedCurlyBracketForward extends MoveToMatchingBracket {
    constructor() {
        super(...arguments);
        this.keys = ["]", "}"];
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const failure = { start: position, stop: position, failed: true };
            const charToMatch = "{";
            const result = matcher_1.PairMatcher.nextPairedChar(position.getRightThroughLineBreaks(), charToMatch, false);
            if (!result) {
                return failure;
            }
            return result;
        });
    }
};
MoveToUnclosedCurlyBracketForward = __decorate([
    base_1.RegisterAction
], MoveToUnclosedCurlyBracketForward);
class MoveTagMatch extends BaseMovement {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualBlock];
        this.includeTag = false;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const editorText = textEditor_1.TextEditor.getText();
            const offset = textEditor_1.TextEditor.getOffsetAt(position);
            const tagMatcher = new tagMatcher_1.TagMatcher(editorText, offset);
            const start = tagMatcher.findOpening(this.includeTag);
            const end = tagMatcher.findClosing(this.includeTag);
            if (start === undefined || end === undefined) {
                return {
                    start: position,
                    stop: position,
                    failed: true
                };
            }
            let startPosition = start ? textEditor_1.TextEditor.getPositionAt(start) : position;
            let endPosition = end ? textEditor_1.TextEditor.getPositionAt(end) : position;
            if (position.isAfter(endPosition)) {
                vimState.recordedState.transformations.push({
                    type: "moveCursor",
                    diff: endPosition.subtract(position)
                });
            }
            else if (position.isBefore(startPosition)) {
                vimState.recordedState.transformations.push({
                    type: "moveCursor",
                    diff: startPosition.subtract(position)
                });
            }
            if (start === end) {
                if (vimState.recordedState.operator instanceof operator_1.ChangeOperator) {
                    vimState.currentMode = mode_1.ModeName.Insert;
                }
                return {
                    start: startPosition,
                    stop: startPosition,
                    failed: true
                };
            }
            return {
                start: startPosition,
                stop: endPosition.getLeftThroughLineBreaks(true)
            };
        });
    }
    execActionForOperator(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.execAction(position, vimState);
            if (isIMovement(result)) {
                if (result.failed) {
                    vimState.recordedState.hasRunOperator = false;
                    vimState.recordedState.actionsRun = [];
                }
                else {
                    result.stop = result.stop.getRight();
                }
            }
            return result;
        });
    }
}
let MoveInsideTag = class MoveInsideTag extends MoveTagMatch {
    constructor() {
        super(...arguments);
        this.keys = ["i", "t"];
        this.includeTag = false;
    }
};
MoveInsideTag = __decorate([
    base_1.RegisterAction
], MoveInsideTag);
exports.MoveInsideTag = MoveInsideTag;
let MoveAroundTag = class MoveAroundTag extends MoveTagMatch {
    constructor() {
        super(...arguments);
        this.keys = ["a", "t"];
        this.includeTag = true;
    }
};
MoveAroundTag = __decorate([
    base_1.RegisterAction
], MoveAroundTag);
exports.MoveAroundTag = MoveAroundTag;
class ArrowsInInsertMode extends BaseMovement {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Insert];
        this.canBePrefixedWithCount = true;
    }
    execAction(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            // we are in Insert Mode and arrow keys will clear all other actions except the first action, which enters Insert Mode.
            // Please note the arrow key movement can be repeated while using `.` but it can't be repeated when using `<C-A>` in Insert Mode.
            vimState.recordedState.actionsRun = [vimState.recordedState.actionsRun.shift(), vimState.recordedState.actionsRun.pop()];
            let newPosition = position;
            switch (this.keys[0]) {
                case "<up>":
                    newPosition = (yield new MoveUpArrow().execAction(position, vimState));
                    break;
                case "<down>":
                    newPosition = (yield new MoveDownArrow().execAction(position, vimState));
                    break;
                case "<left>":
                    newPosition = yield new MoveLeftArrow().execAction(position, vimState);
                    break;
                case "<right>":
                    newPosition = yield new MoveRightArrow().execAction(position, vimState);
                    break;
                default:
                    break;
            }
            vimState.replaceState = new replaceState_1.ReplaceState(newPosition);
            return newPosition;
        });
    }
}
exports.ArrowsInInsertMode = ArrowsInInsertMode;
let UpArrowInInsertMode = class UpArrowInInsertMode extends ArrowsInInsertMode {
    constructor() {
        super(...arguments);
        this.keys = ["<up>"];
    }
};
UpArrowInInsertMode = __decorate([
    base_1.RegisterAction
], UpArrowInInsertMode);
let DownArrowInInsertMode = class DownArrowInInsertMode extends ArrowsInInsertMode {
    constructor() {
        super(...arguments);
        this.keys = ["<down>"];
    }
};
DownArrowInInsertMode = __decorate([
    base_1.RegisterAction
], DownArrowInInsertMode);
let LeftArrowInInsertMode = class LeftArrowInInsertMode extends ArrowsInInsertMode {
    constructor() {
        super(...arguments);
        this.keys = ["<left>"];
    }
};
LeftArrowInInsertMode = __decorate([
    base_1.RegisterAction
], LeftArrowInInsertMode);
let RightArrowInInsertMode = class RightArrowInInsertMode extends ArrowsInInsertMode {
    constructor() {
        super(...arguments);
        this.keys = ["<right>"];
    }
};
RightArrowInInsertMode = __decorate([
    base_1.RegisterAction
], RightArrowInInsertMode);
var MoveRepeatReversed_1, MoveToMatchingBracket_1;
//# sourceMappingURL=motion.js.map