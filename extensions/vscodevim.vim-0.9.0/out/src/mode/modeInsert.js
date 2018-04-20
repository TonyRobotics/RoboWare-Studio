"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mode_1 = require("./mode");
const mode_2 = require("./mode");
class InsertMode extends mode_1.Mode {
    constructor() {
        super(mode_1.ModeName.Insert);
        this.text = "Insert Mode";
        this.cursorType = mode_2.VSCodeVimCursorType.Native;
    }
}
exports.InsertMode = InsertMode;
//# sourceMappingURL=modeInsert.js.map