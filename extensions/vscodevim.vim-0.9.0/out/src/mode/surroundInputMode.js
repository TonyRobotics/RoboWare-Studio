"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mode_1 = require("./mode");
const mode_2 = require("./mode");
class SurroundInputMode extends mode_1.Mode {
    constructor() {
        super(mode_1.ModeName.SurroundInputMode);
        this.text = "Surround Input Mode";
        this.cursorType = mode_2.VSCodeVimCursorType.Block;
    }
}
exports.SurroundInputMode = SurroundInputMode;
//# sourceMappingURL=surroundInputMode.js.map