"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mode_1 = require("./mode");
const mode_2 = require("./mode");
class VisualLineMode extends mode_1.Mode {
    constructor() {
        super(mode_1.ModeName.VisualLine);
        this.text = "Visual Line Mode";
        this.cursorType = mode_2.VSCodeVimCursorType.Block;
        this.isVisualMode = true;
    }
}
exports.VisualLineMode = VisualLineMode;
//# sourceMappingURL=modeVisualLine.js.map