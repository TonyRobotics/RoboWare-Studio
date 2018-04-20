"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
function MapYcmFixItToVSCodeEdit(fixIt) {
    const chunks = YcmFixItToChunkFiles(fixIt);
    const edit = new vscode_1.WorkspaceEdit();
    chunks.forEach((fixes, file) => {
        const uri = vscode_1.Uri.file(file);
        const edits = fixes.map(it => {
            const locationEqual = YcmLocationEquals(it.range.start, it.range.end);
            const replacementAvailable = !!it.replacement_text;
            // Insert
            if (locationEqual && replacementAvailable) {
                return vscode_1.TextEdit.insert(YcmLocationToVSCodePosition(it.range.start), it.replacement_text);
            }
            // Replace
            if (!locationEqual && replacementAvailable) {
                return vscode_1.TextEdit.replace(YcmRangeToVSCodeRange(it.range), it.replacement_text);
            }
            // Delete
            // FixMe
            if (!locationEqual && !replacementAvailable) {
                return vscode_1.TextEdit.delete(YcmRangeToVSCodeRange(it.range));
            }
        });
        edit.set(uri, edits);
    });
    return edit;
}
exports.MapYcmFixItToVSCodeEdit = MapYcmFixItToVSCodeEdit;
function YcmRangeToVSCodeRange(range) {
    return new vscode_1.Range(YcmLocationToVSCodePosition(range.start), YcmLocationToVSCodePosition(range.end));
}
function YcmLocationToVSCodePosition(location) {
    return new vscode_1.Position(location.line_num - 1, location.column_num - 1);
}
function YcmLocationEquals(a, b) {
    return a.filepath === b.filepath && a.column_num === b.column_num && a.line_num === b.line_num;
}
function YcmFixItToChunkFiles(fixIts) {
    const map = new Map();
    fixIts.chunks.forEach(it => {
        const filepath = it.range.start.filepath;
        const arr = map.get(filepath) || [];
        arr.push(it);
        map.set(filepath, arr);
    });
    return map;
}
//# sourceMappingURL=utils.js.map