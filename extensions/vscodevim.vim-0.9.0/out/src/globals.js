"use strict";
/**
 * globals.ts hold some globals used throughout the extension
 */
Object.defineProperty(exports, "__esModule", { value: true });
class Globals {
}
// true for running tests, false during regular runtime
Globals.isTesting = false;
Globals.modeHandlerForTesting = undefined;
Globals.WhitespaceRegExp = new RegExp("^ *$");
// false for disabling Vim temporarily
Globals.active = true;
exports.Globals = Globals;
//# sourceMappingURL=globals.js.map