"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mode_1 = require("./mode");
const mode_2 = require("./mode");
class VisualMode extends mode_1.Mode {
    constructor() {
        super(mode_1.ModeName.Visual);
        this.text = "Visual Mode";
        this.cursorType = mode_2.VSCodeVimCursorType.TextDecoration;
        this.isVisualMode = true;
    }
}
exports.VisualMode = VisualMode;
//# sourceMappingURL=modeVisual.js.map