"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * State which stores global state (across editors)
 */
class GlobalState {
    /**
     * Getters and setters for changing global state
     */
    get searchStatePrevious() {
        return GlobalState._searchStatePrevious;
    }
    set searchStatePrevious(states) {
        GlobalState._searchStatePrevious = GlobalState._searchStatePrevious.concat(states);
    }
    get previousFullAction() {
        return GlobalState._previousFullAction;
    }
    set previousFullAction(state) {
        GlobalState._previousFullAction = state;
    }
    get searchState() {
        return GlobalState._searchState;
    }
    set searchState(state) {
        GlobalState._searchState = state;
    }
    get searchStateIndex() {
        return GlobalState._searchStateIndex;
    }
    set searchStateIndex(state) {
        GlobalState._searchStateIndex = state;
    }
    get hl() {
        return GlobalState._hl;
    }
    set hl(enabled) {
        GlobalState._hl = enabled;
    }
}
/**
 * The keystroke sequence that made up our last complete action (that can be
 * repeated with '.').
 */
GlobalState._previousFullAction = undefined;
/**
 * Previous searches performed
 */
GlobalState._searchStatePrevious = [];
/**
 * Last search state for running n and N commands
 */
GlobalState._searchState = undefined;
/**
 *  Index used for navigating search history with <up> and <down> when searching
 */
GlobalState._searchStateIndex = 0;
/**
 * Used internally for nohl.
 */
GlobalState._hl = true;
exports.GlobalState = GlobalState;
//# sourceMappingURL=globalState.js.map