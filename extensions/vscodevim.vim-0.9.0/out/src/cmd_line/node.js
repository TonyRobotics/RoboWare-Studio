"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const token = require("./token");
class LineRange {
    constructor() {
        this.left = [];
        this.right = [];
    }
    addToken(tok) {
        if (tok.type === token.TokenType.Comma) {
            this.separator = tok;
            return;
        }
        if (!this.separator) {
            if (this.left.length > 0 && tok.type !== token.TokenType.Offset) {
                // XXX: is this always this error?
                throw Error("not a Vim command");
            }
            this.left.push(tok);
        }
        else {
            if (this.right.length > 0 && tok.type !== token.TokenType.Offset) {
                // XXX: is this always this error?
                throw Error("not a Vim command");
            }
            this.right.push(tok);
        }
    }
    get isEmpty() {
        return this.left.length === 0 && this.right.length === 0 && !this.separator;
    }
    toString() {
        return this.left.toString() + this.separator.content + this.right.toString();
    }
    execute(document, modeHandler) {
        if (this.isEmpty) {
            return;
        }
        var lineRef = this.right.length === 0 ? this.left : this.right;
        var pos = this.lineRefToPosition(document, lineRef, modeHandler);
        let vimState = modeHandler.vimState;
        vimState.cursorPosition = vimState.cursorPosition.setLocation(pos.line, pos.character);
        vimState.cursorStartPosition = vimState.cursorPosition;
        modeHandler.updateView(modeHandler.vimState);
    }
    lineRefToPosition(doc, toks, modeHandler) {
        var first = toks[0];
        switch (first.type) {
            case token.TokenType.Dollar:
            case token.TokenType.Percent:
                return new vscode.Position(doc.document.lineCount, 0);
            case token.TokenType.Dot:
                return new vscode.Position(doc.selection.active.line, 0);
            case token.TokenType.LineNumber:
                var line = Number.parseInt(first.content);
                line = Math.max(0, line - 1);
                line = Math.min(doc.document.lineCount, line);
                return new vscode.Position(line, 0);
            case token.TokenType.SelectionFirstLine:
                let startLine = Math.min.apply(null, doc.selections.map(selection => selection.start.isBeforeOrEqual(selection.end) ? selection.start.line : selection.end.line));
                return new vscode.Position(startLine, 0);
            case token.TokenType.SelectionLastLine:
                let endLine = Math.max.apply(null, doc.selections.map(selection => selection.start.isAfter(selection.end) ? selection.start.line : selection.end.line));
                return new vscode.Position(endLine, 0);
            case token.TokenType.Mark:
                return modeHandler.vimState.historyTracker.getMark(first.content).position;
            default:
                throw new Error("not implemented");
        }
    }
}
exports.LineRange = LineRange;
class CommandLine {
    constructor() {
        this.range = new LineRange();
    }
    get isEmpty() {
        return this.range.isEmpty && !this.command;
    }
    toString() {
        return ":" + this.range.toString() + " " + this.command.toString();
    }
    execute(document, modeHandler) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.command) {
                this.range.execute(document, modeHandler);
                return;
            }
            if (this.range.isEmpty) {
                yield this.command.execute(modeHandler);
            }
            else {
                yield this.command.executeWithRange(modeHandler, this.range);
            }
        });
    }
}
exports.CommandLine = CommandLine;
class CommandBase {
    constructor() {
        this.neovimCapable = false;
    }
    get activeTextEditor() {
        return vscode.window.activeTextEditor;
    }
    get name() {
        return this._name;
    }
    get arguments() {
        return this._arguments;
    }
    executeWithRange(modeHandler, range) {
        throw new Error("Not implemented!");
    }
}
exports.CommandBase = CommandBase;
//# sourceMappingURL=node.js.map