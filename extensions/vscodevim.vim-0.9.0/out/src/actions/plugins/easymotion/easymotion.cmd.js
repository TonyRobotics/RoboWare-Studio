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
const easymotion_1 = require("./easymotion");
const position_1 = require("./../../../common/motion/position");
const mode_1 = require("./../../../mode/mode");
const configuration_1 = require("./../../../configuration/configuration");
const actions_1 = require("./../../commands/actions");
const base_1 = require("./../../base");
class BaseEasyMotionCommand extends actions_1.BaseCommand {
    getMatches(position, vimState) {
        throw new Error("Not implemented!");
    }
    getMatchPosition(match, position, vimState) {
        return match.position;
    }
    processMarkers(matches, position, vimState) {
        // Clear existing markers, just in case
        vimState.easyMotion.clearMarkers();
        var index = 0;
        for (var j = 0; j < matches.length; j++) {
            var match = matches[j];
            var pos = this.getMatchPosition(match, position, vimState);
            if (match.position.isEqual(position)) {
                continue;
            }
            let marker = easymotion_1.EasyMotion.generateMarker(index++, matches.length, position, pos);
            if (marker) {
                vimState.easyMotion.addMarker(marker);
            }
        }
    }
    exec(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            // Only execute the action if the configuration is set
            if (!configuration_1.Configuration.easymotion) {
                return vimState;
            }
            // Search all occurences of the character pressed
            let matches = this.getMatches(position, vimState);
            // Stop if there are no matches
            if (matches.length === 0) {
                return vimState;
            }
            // Enter the EasyMotion mode and await further keys
            vimState.easyMotion = new easymotion_1.EasyMotion();
            // Store mode to return to after performing easy motion
            vimState.easyMotion.previousMode = vimState.currentMode;
            vimState.currentMode = mode_1.ModeName.EasyMotionMode;
            this.processMarkers(matches, position, vimState);
            return vimState;
        });
    }
}
let ActionEasyMotionSearchCommand = class ActionEasyMotionSearchCommand extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "s", "<character>"];
    }
    getMatches(position, vimState) {
        const searchChar = this.keysPressed[3];
        // Search all occurences of the character pressed
        if (searchChar === " ") {
            return vimState.easyMotion.sortedSearch(position, new RegExp(" {1,}", "g"));
        }
        else {
            return vimState.easyMotion.sortedSearch(position, searchChar);
        }
    }
};
ActionEasyMotionSearchCommand = __decorate([
    base_1.RegisterAction
], ActionEasyMotionSearchCommand);
let ActionEasyMotionFindForwardCommand = class ActionEasyMotionFindForwardCommand extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "f", "<character>"];
    }
    getMatches(position, vimState) {
        const searchChar = this.keysPressed[3];
        // Search all occurences of the character pressed after the cursor
        if (searchChar === " ") {
            return vimState.easyMotion.sortedSearch(position, new RegExp(" {1,}", "g"), {
                min: position
            });
        }
        else {
            return vimState.easyMotion.sortedSearch(position, searchChar, {
                min: position
            });
        }
    }
};
ActionEasyMotionFindForwardCommand = __decorate([
    base_1.RegisterAction
], ActionEasyMotionFindForwardCommand);
let ActionEasyMotionFindBackwardCommand = class ActionEasyMotionFindBackwardCommand extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "F", "<character>"];
    }
    getMatches(position, vimState) {
        const searchChar = this.keysPressed[3];
        // Search all occurences of the character pressed after the cursor
        if (searchChar === " ") {
            return vimState.easyMotion.sortedSearch(position, new RegExp(" {1,}", "g"), {
                max: position
            });
        }
        else {
            return vimState.easyMotion.sortedSearch(position, searchChar, {
                max: position
            });
        }
    }
};
ActionEasyMotionFindBackwardCommand = __decorate([
    base_1.RegisterAction
], ActionEasyMotionFindBackwardCommand);
let ActionEasyMotionTilForwardCommand = class ActionEasyMotionTilForwardCommand extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "t", "<character>"];
    }
    getMatches(position, vimState) {
        const searchChar = this.keysPressed[3];
        // Search all occurences of the character pressed after the cursor
        if (searchChar === " ") {
            return vimState.easyMotion.sortedSearch(position, new RegExp(" {1,}", "g"), {
                min: position
            });
        }
        else {
            return vimState.easyMotion.sortedSearch(position, searchChar, {
                min: position
            });
        }
    }
    getMatchPosition(match, position, vimState) {
        return new position_1.Position(match.position.line, Math.max(0, match.position.character - 1));
    }
};
ActionEasyMotionTilForwardCommand = __decorate([
    base_1.RegisterAction
], ActionEasyMotionTilForwardCommand);
let ActionEasyMotionTilBackwardCommand = class ActionEasyMotionTilBackwardCommand extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "T", "<character>"];
    }
    getMatches(position, vimState) {
        const searchChar = this.keysPressed[3];
        // Search all occurences of the character pressed after the cursor
        if (searchChar === " ") {
            return vimState.easyMotion.sortedSearch(position, new RegExp(" {1,}"), {
                max: position
            });
        }
        else {
            return vimState.easyMotion.sortedSearch(position, searchChar, {
                max: position
            });
        }
    }
    getMatchPosition(match, position, vimState) {
        return new position_1.Position(match.position.line, Math.max(0, match.position.character + 1));
    }
};
ActionEasyMotionTilBackwardCommand = __decorate([
    base_1.RegisterAction
], ActionEasyMotionTilBackwardCommand);
let ActionEasyMotionWordCommand = class ActionEasyMotionWordCommand extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "w"];
    }
    getMatches(position, vimState) {
        // Search for the beginning of all words after the cursor
        return vimState.easyMotion.sortedSearch(position, new RegExp("\\w{1,}", "g"), {
            min: position
        });
    }
};
ActionEasyMotionWordCommand = __decorate([
    base_1.RegisterAction
], ActionEasyMotionWordCommand);
let ActionEasyMotionEndForwardCommand = class ActionEasyMotionEndForwardCommand extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "e"];
    }
    getMatches(position, vimState) {
        // Search for the end of all words after the cursor
        return vimState.easyMotion.sortedSearch(position, new RegExp("\\w{1,}", "g"), {
            min: position
        });
    }
    getMatchPosition(match, position, vimState) {
        return new position_1.Position(match.position.line, match.position.character + match.text.length - 1);
    }
};
ActionEasyMotionEndForwardCommand = __decorate([
    base_1.RegisterAction
], ActionEasyMotionEndForwardCommand);
let ActionEasyMotionEndBackwardCommand = class ActionEasyMotionEndBackwardCommand extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "g", "e"];
    }
    getMatches(position, vimState) {
        // Search for the beginning of all words before the cursor
        return vimState.easyMotion.sortedSearch(position, new RegExp("\\w{1,}", "g"), {
            max: position,
        });
    }
    getMatchPosition(match, position, vimState) {
        return new position_1.Position(match.position.line, match.position.character + match.text.length - 1);
    }
};
ActionEasyMotionEndBackwardCommand = __decorate([
    base_1.RegisterAction
], ActionEasyMotionEndBackwardCommand);
let ActionEasyMotionBeginningWordCommand = class ActionEasyMotionBeginningWordCommand extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "b"];
    }
    getMatches(position, vimState) {
        // Search for the beginning of all words before the cursor
        return vimState.easyMotion.sortedSearch(position, new RegExp("\\w{1,}", "g"), {
            max: position,
        });
    }
};
ActionEasyMotionBeginningWordCommand = __decorate([
    base_1.RegisterAction
], ActionEasyMotionBeginningWordCommand);
let ActionEasyMotionDownLines = class ActionEasyMotionDownLines extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "j"];
    }
    getMatches(position, vimState) {
        // Search for the beginning of all non whitespace chars on each line after the cursor
        let matches = vimState.easyMotion.sortedSearch(position, new RegExp("^.", "gm"), {
            min: position
        });
        for (let match of matches) {
            match.position = match.position.getFirstLineNonBlankChar();
        }
        return matches;
    }
};
ActionEasyMotionDownLines = __decorate([
    base_1.RegisterAction
], ActionEasyMotionDownLines);
let ActionEasyMotionUpLines = class ActionEasyMotionUpLines extends BaseEasyMotionCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.Normal, mode_1.ModeName.Visual, mode_1.ModeName.VisualLine, mode_1.ModeName.VisualBlock];
        this.keys = ["<leader>", "<leader>", "k"];
    }
    getMatches(position, vimState) {
        // Search for the beginning of all non whitespace chars on each line before the cursor
        let matches = vimState.easyMotion.sortedSearch(position, new RegExp("^.", "gm"), {
            max: position
        });
        for (let match of matches) {
            match.position = match.position.getFirstLineNonBlankChar();
        }
        return matches;
    }
};
ActionEasyMotionUpLines = __decorate([
    base_1.RegisterAction
], ActionEasyMotionUpLines);
let MoveEasyMotion = class MoveEasyMotion extends actions_1.BaseCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.ModeName.EasyMotionMode];
        this.keys = ["<character>"];
    }
    exec(position, vimState) {
        return __awaiter(this, void 0, void 0, function* () {
            var key = this.keysPressed[0];
            if (!key) {
                return vimState;
            }
            // "nail" refers to the accumulated depth keys
            var nail = vimState.easyMotion.accumulation + key;
            vimState.easyMotion.accumulation = nail;
            // Find markers starting with "nail"
            var markers = vimState.easyMotion.findMarkers(nail);
            // If previous mode was visual, restore visual selection
            if (vimState.easyMotion.previousMode === mode_1.ModeName.Visual ||
                vimState.easyMotion.previousMode === mode_1.ModeName.VisualLine ||
                vimState.easyMotion.previousMode === mode_1.ModeName.VisualBlock) {
                vimState.cursorStartPosition = vimState.lastVisualSelectionStart;
                vimState.cursorPosition = vimState.lastVisualSelectionEnd;
            }
            if (markers.length === 1) {
                var marker = markers[0];
                vimState.easyMotion.clearDecorations();
                // Restore the mode from before easy motion
                vimState.currentMode = vimState.easyMotion.previousMode;
                // Set cursor position based on marker entered
                vimState.cursorPosition = marker.position;
                return vimState;
            }
            else {
                if (markers.length === 0) {
                    vimState.easyMotion.clearDecorations();
                    vimState.currentMode = vimState.easyMotion.previousMode;
                    return vimState;
                }
            }
            return vimState;
        });
    }
};
MoveEasyMotion = __decorate([
    base_1.RegisterAction
], MoveEasyMotion);
//# sourceMappingURL=easymotion.cmd.js.map