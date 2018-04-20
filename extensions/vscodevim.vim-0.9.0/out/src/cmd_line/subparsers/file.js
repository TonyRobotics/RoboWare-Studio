"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node = require("../commands/file");
const scanner_1 = require("../scanner");
function parseEditFileCommandArgs(args) {
    if (!args) {
        return new node.FileCommand({ name: "" });
    }
    let scanner = new scanner_1.Scanner(args);
    let bang;
    const c = scanner.next();
    bang = (c === '!');
    if (scanner.isAtEof) {
        return new node.FileCommand({ name: "", bang: bang });
    }
    let name = scanner.nextWord();
    return new node.FileCommand({
        name: name.trim(),
        position: node.FilePosition.CurrentWindow,
        bang: bang
    });
}
exports.parseEditFileCommandArgs = parseEditFileCommandArgs;
// Note that this isn't really implemented.
function parseEditNewFileInNewWindowCommandArgs(args) {
    return new node.FileCommand({
        name: undefined,
        position: node.FilePosition.NewWindow
    });
}
exports.parseEditNewFileInNewWindowCommandArgs = parseEditNewFileInNewWindowCommandArgs;
function parseEditFileInNewWindowCommandArgs(args) {
    let name = "";
    if (args) {
        let scanner = new scanner_1.Scanner(args);
        name = scanner.nextWord();
    }
    return new node.FileCommand({
        name: name,
        position: node.FilePosition.NewWindow
    });
}
exports.parseEditFileInNewWindowCommandArgs = parseEditFileInNewWindowCommandArgs;
//# sourceMappingURL=file.js.map