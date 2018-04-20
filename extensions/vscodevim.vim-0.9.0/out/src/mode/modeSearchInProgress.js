"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mode_1 = require("./mode");
const mode_2 = require("./mode");
class SearchInProgressMode extends mode_1.Mode {
    constructor() {
        super(mode_1.ModeName.SearchInProgressMode);
        this.text = "Search In Progress";
        this.cursorType = mode_2.VSCodeVimCursorType.Block;
    }
}
exports.SearchInProgressMode = SearchInProgressMode;
//# sourceMappingURL=modeSearchInProgress.js.map