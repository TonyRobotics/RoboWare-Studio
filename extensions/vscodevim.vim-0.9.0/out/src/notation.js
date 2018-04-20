"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configuration_1 = require("./configuration/configuration");
const _ = require("lodash");
class AngleBracketNotation {
    /**
     * Normalizes key to AngleBracketNotation
     * For instance, <ctrl+x>, Ctrl+x, <c-x> normalized to <C-x>
     */
    static Normalize(key) {
        if (!this.isSurroundedByAngleBrackets(key) && key.length > 1) {
            key = `<${key.toLocaleLowerCase()}>`;
        }
        // Special cases that we handle incorrectly (internally)
        if (key.toLowerCase() === "<space>") {
            return " ";
        }
        if (key.toLowerCase() === "<cr>") {
            return "\n";
        }
        if (key.toLowerCase() === "<leader>") {
            return configuration_1.Configuration.leader;
        }
        if (_.includes(["<up>", "<down>", "<left>", "<right>"], key.toLocaleLowerCase())) {
            key = key.toLocaleLowerCase();
        }
        for (const notationMapKey in this._notationMap) {
            if (this._notationMap.hasOwnProperty(notationMapKey)) {
                const regex = new RegExp(this._notationMap[notationMapKey].join('|'), 'gi');
                if (regex.test(key)) {
                    key = key.replace(regex, notationMapKey);
                    break;
                }
            }
        }
        return key;
    }
    static isSurroundedByAngleBrackets(key) {
        return key.startsWith('<') && key.endsWith('>');
    }
}
// Mapping from the nomalized string to regex strings that could match it.
AngleBracketNotation._notationMap = {
    'C-': ['ctrl\\+', 'c\\-'],
    'D-': ['cmd\\+', 'd\\-'],
    'Esc': ['escape', 'esc'],
    'BS': ['backspace', 'bs'],
    'Del': ['delete', 'del'],
};
exports.AngleBracketNotation = AngleBracketNotation;
//# sourceMappingURL=notation.js.map