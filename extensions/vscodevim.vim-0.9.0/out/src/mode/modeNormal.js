"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mode_1 = require("./mode");
const mode_2 = require("./mode");
class NormalMode extends mode_1.Mode {
    constructor(modeHandler) {
        super(mode_1.ModeName.Normal);
        this.text = "Normal Mode";
        this.cursorType = mode_2.VSCodeVimCursorType.Block;
        this._modeHandler = modeHandler;
    }
}
exports.NormalMode = NormalMode;
//# sourceMappingURL=modeNormal.js.map