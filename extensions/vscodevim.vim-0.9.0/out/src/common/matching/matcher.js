"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const position_1 = require("./../motion/position");
const textEditor_1 = require("./../../textEditor");
const vscode = require("vscode");
function escapeRegExpCharacters(value) {
    return value.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, '\\$&');
}
let toReversedString = (function () {
    function reverse(str) {
        let reversedStr = '';
        for (let i = str.length - 1; i >= 0; i--) {
            reversedStr += str.charAt(i);
        }
        return reversedStr;
    }
    let lastInput = '';
    let lastOutput = '';
    return function toReversedString(str) {
        if (lastInput !== str) {
            lastInput = str;
            lastOutput = reverse(lastInput);
        }
        return lastOutput;
    };
})();
/**
 * PairMatcher finds the position matching the given character, respecting nested
 * instances of the pair.
 */
class PairMatcher {
    static nextPairedChar(position, charToMatch, closed = true) {
        /**
         * We do a fairly basic implementation that only tracks the state of the type of
         * character you're over and its pair (e.g. "[" and "]"). This is similar to
         * what Vim does.
         *
         * It can't handle strings very well - something like "|( ')' )" where | is the
         * cursor will cause it to go to the ) in the quotes, even though it should skip over it.
         *
         * PRs welcomed! (TODO)
         * Though ideally VSC implements https://github.com/Microsoft/vscode/issues/7177
         */
        const toFind = this.pairings[charToMatch];
        if (toFind === undefined || toFind.directionLess) {
            return undefined;
        }
        let regex = new RegExp('(' + escapeRegExpCharacters(charToMatch) + '|' + escapeRegExpCharacters(toFind.match) + ')', 'i');
        let stackHeight = closed ? 0 : 1;
        let matchedPosition = undefined;
        // find matched bracket up
        if (!toFind.nextMatchIsForward) {
            for (let lineNumber = position.line; lineNumber >= 0; lineNumber--) {
                let lineText = textEditor_1.TextEditor.getLineAt(new position_1.Position(lineNumber, 0)).text;
                let startOffset = lineNumber === position.line ? lineText.length - position.character - 1 : 0;
                while (true) {
                    let queryText = toReversedString(lineText).substr(startOffset);
                    if (queryText === '') {
                        break;
                    }
                    let m = queryText.match(regex);
                    if (!m) {
                        break;
                    }
                    let matchedChar = m[0];
                    if (matchedChar === charToMatch) {
                        stackHeight++;
                    }
                    if (matchedChar === toFind.match) {
                        stackHeight--;
                    }
                    if (stackHeight === 0) {
                        matchedPosition = new position_1.Position(lineNumber, lineText.length - startOffset - m.index - 1);
                        return matchedPosition;
                    }
                    startOffset = startOffset + m.index + 1;
                }
            }
        }
        else {
            for (let lineNumber = position.line, lineCount = textEditor_1.TextEditor.getLineCount(); lineNumber < lineCount; lineNumber++) {
                let lineText = textEditor_1.TextEditor.getLineAt(new position_1.Position(lineNumber, 0)).text;
                let startOffset = lineNumber === position.line ? position.character : 0;
                while (true) {
                    let queryText = lineText.substr(startOffset);
                    if (queryText === '') {
                        break;
                    }
                    let m = queryText.match(regex);
                    if (!m) {
                        break;
                    }
                    let matchedChar = m[0];
                    if (matchedChar === charToMatch) {
                        stackHeight++;
                    }
                    if (matchedChar === toFind.match) {
                        stackHeight--;
                    }
                    if (stackHeight === 0) {
                        matchedPosition = new position_1.Position(lineNumber, startOffset + m.index);
                        return matchedPosition;
                    }
                    startOffset = startOffset + m.index + 1;
                }
            }
        }
        if (matchedPosition) {
            return matchedPosition;
        }
        // TODO(bell)
        return undefined;
    }
    /**
     * Given a current position, find an immediate following bracket and return the range. If
     * no matching bracket is found immediately following the opening bracket, return undefined.
     */
    static immediateMatchingBracket(currentPosition) {
        // Don't delete bracket unless autoClosingBrackets is set
        if (!vscode.workspace.getConfiguration().get("editor.autoClosingBrackets")) {
            return undefined;
        }
        const deleteRange = new vscode.Range(currentPosition, currentPosition.getLeftThroughLineBreaks());
        const deleteText = vscode.window.activeTextEditor.document.getText(deleteRange);
        let matchRange;
        let isNextMatch = false;
        if ("{[(\"'`".indexOf(deleteText) > -1) {
            const matchPosition = currentPosition.add(new position_1.PositionDiff(0, 1));
            matchRange = new vscode.Range(matchPosition, matchPosition.getLeftThroughLineBreaks());
            isNextMatch = vscode.window.activeTextEditor.document.getText(matchRange) === PairMatcher.pairings[deleteText].match;
        }
        if (isNextMatch && matchRange) {
            return matchRange;
        }
        return undefined;
    }
}
PairMatcher.pairings = {
    "(": { match: ")", nextMatchIsForward: true, matchesWithPercentageMotion: true },
    "{": { match: "}", nextMatchIsForward: true, matchesWithPercentageMotion: true },
    "[": { match: "]", nextMatchIsForward: true, matchesWithPercentageMotion: true },
    ")": { match: "(", nextMatchIsForward: false, matchesWithPercentageMotion: true },
    "}": { match: "{", nextMatchIsForward: false, matchesWithPercentageMotion: true },
    "]": { match: "[", nextMatchIsForward: false, matchesWithPercentageMotion: true },
    // These characters can't be used for "%"-based matching, but are still
    // useful for text objects.
    "<": { match: ">", nextMatchIsForward: true },
    ">": { match: "<", nextMatchIsForward: false },
    // These are useful for deleting closing and opening quotes, but don't seem to negatively
    // affect how text objects such as `ci"` work, which was my worry.
    '"': { match: '"', nextMatchIsForward: false, directionLess: true },
    "'": { match: "'", nextMatchIsForward: false, directionLess: true },
    "`": { match: "`", nextMatchIsForward: false, directionLess: true },
};
exports.PairMatcher = PairMatcher;
//# sourceMappingURL=matcher.js.map