"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ModeName;
(function (ModeName) {
    ModeName[ModeName["Normal"] = 0] = "Normal";
    ModeName[ModeName["Insert"] = 1] = "Insert";
    ModeName[ModeName["Visual"] = 2] = "Visual";
    ModeName[ModeName["VisualBlock"] = 3] = "VisualBlock";
    ModeName[ModeName["VisualLine"] = 4] = "VisualLine";
    ModeName[ModeName["SearchInProgressMode"] = 5] = "SearchInProgressMode";
    ModeName[ModeName["Replace"] = 6] = "Replace";
    ModeName[ModeName["EasyMotionMode"] = 7] = "EasyMotionMode";
    ModeName[ModeName["SurroundInputMode"] = 8] = "SurroundInputMode";
})(ModeName = exports.ModeName || (exports.ModeName = {}));
var VSCodeVimCursorType;
(function (VSCodeVimCursorType) {
    VSCodeVimCursorType[VSCodeVimCursorType["Block"] = 0] = "Block";
    VSCodeVimCursorType[VSCodeVimCursorType["Line"] = 1] = "Line";
    VSCodeVimCursorType[VSCodeVimCursorType["LineThin"] = 2] = "LineThin";
    VSCodeVimCursorType[VSCodeVimCursorType["Underline"] = 3] = "Underline";
    VSCodeVimCursorType[VSCodeVimCursorType["TextDecoration"] = 4] = "TextDecoration";
    VSCodeVimCursorType[VSCodeVimCursorType["Native"] = 5] = "Native";
})(VSCodeVimCursorType = exports.VSCodeVimCursorType || (exports.VSCodeVimCursorType = {}));
class Mode {
    constructor(name) {
        this.isVisualMode = false;
        this._name = name;
        this._isActive = false;
    }
    get name() {
        return this._name;
    }
    get isActive() {
        return this._isActive;
    }
    set isActive(val) {
        this._isActive = val;
    }
}
exports.Mode = Mode;
//# sourceMappingURL=mode.js.map