"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configuration_1 = require("./../configuration/configuration");
const is2DArray = function (x) {
    return Array.isArray(x[0]);
};
exports.compareKeypressSequence = function (one, two) {
    if (is2DArray(one)) {
        for (const sequence of one) {
            if (exports.compareKeypressSequence(sequence, two)) {
                return true;
            }
        }
        return false;
    }
    if (one.length !== two.length) {
        return false;
    }
    const isSingleNumber = (s) => {
        return s.length === 1 && "1234567890".indexOf(s) > -1;
    };
    const containsControlKey = (s) => {
        // We count anything starting with < (e.g. <c-u>) as a control key, but we
        // exclude the first 3 because it's more convenient to do so.
        return s.toUpperCase() !== "<BS>" &&
            s.toUpperCase() !== "<SHIFT+BS>" &&
            s.toUpperCase() !== "<TAB>" &&
            s.startsWith("<") &&
            s.length > 1;
    };
    for (let i = 0, j = 0; i < one.length; i++, j++) {
        const left = one[i], right = two[j];
        if (left === "<any>") {
            continue;
        }
        if (right === "<any>") {
            continue;
        }
        if (left === "<number>" && isSingleNumber(right)) {
            continue;
        }
        if (right === "<number>" && isSingleNumber(left)) {
            continue;
        }
        if (left === "<character>" && !containsControlKey(right)) {
            continue;
        }
        if (right === "<character>" && !containsControlKey(left)) {
            continue;
        }
        if (left === "<leader>" && right === configuration_1.Configuration.leader) {
            continue;
        }
        if (right === "<leader>" && left === configuration_1.Configuration.leader) {
            continue;
        }
        if (left === configuration_1.Configuration.leader) {
            return false;
        }
        if (right === configuration_1.Configuration.leader) {
            return false;
        }
        if (left !== right) {
            return false;
        }
    }
    return true;
};
class BaseAction {
    constructor() {
        /**
         * Can this action be paired with an operator (is it like w in dw)? All
         * BaseMovements can be, and some more sophisticated commands also can be.
         */
        this.isMotion = false;
        this.canBeRepeatedWithDot = false;
        this.mustBeFirstKey = false;
        this.isOperator = false;
        /**
         * The keys pressed at the time that this action was triggered.
         */
        this.keysPressed = [];
    }
    /**
     * Is this action valid in the current Vim state?
     */
    doesActionApply(vimState, keysPressed) {
        if (this.modes.indexOf(vimState.currentMode) === -1) {
            return false;
        }
        if (!exports.compareKeypressSequence(this.keys, keysPressed)) {
            return false;
        }
        if (vimState.recordedState.getCurrentCommandWithoutCountPrefix().length - keysPressed.length > 0 &&
            this.mustBeFirstKey) {
            return false;
        }
        return true;
    }
    /**
     * Could the user be in the process of doing this action.
     */
    couldActionApply(vimState, keysPressed) {
        if (this.modes.indexOf(vimState.currentMode) === -1) {
            return false;
        }
        if (!exports.compareKeypressSequence(this.keys.slice(0, keysPressed.length), keysPressed)) {
            return false;
        }
        if (vimState.recordedState.getCurrentCommandWithoutCountPrefix().length - keysPressed.length > 0 &&
            this.mustBeFirstKey) {
            return false;
        }
        return true;
    }
    toString() {
        return this.keys.join("");
    }
}
exports.BaseAction = BaseAction;
var KeypressState;
(function (KeypressState) {
    KeypressState[KeypressState["WaitingOnKeys"] = 0] = "WaitingOnKeys";
    KeypressState[KeypressState["NoPossibleMatch"] = 1] = "NoPossibleMatch";
})(KeypressState = exports.KeypressState || (exports.KeypressState = {}));
class Actions {
    /**
     * Gets the action that should be triggered given a key
     * sequence.
     *
     * If there is a definitive action that matched, returns that action.
     *
     * If an action could potentially match if more keys were to be pressed, returns true. (e.g.
     * you pressed "g" and are about to press "g" action to make the full action "gg".)
     *
     * If no action could ever match, returns false.
     */
    static getRelevantAction(keysPressed, vimState) {
        let couldPotentiallyHaveMatch = false;
        for (const thing of Actions.allActions) {
            const { type, action } = thing;
            // It's an action that can't be called directly.
            if (action.keys === undefined) {
                continue;
            }
            if (action.doesActionApply(vimState, keysPressed)) {
                const result = new type();
                result.keysPressed = vimState.recordedState.actionKeys.slice(0);
                return result;
            }
            if (action.couldActionApply(vimState, keysPressed)) {
                couldPotentiallyHaveMatch = true;
            }
        }
        return couldPotentiallyHaveMatch ? KeypressState.WaitingOnKeys : KeypressState.NoPossibleMatch;
    }
}
/**
 * Every Vim action will be added here with the @RegisterAction decorator.
 */
Actions.allActions = [];
exports.Actions = Actions;
function RegisterAction(action) {
    Actions.allActions.push({ type: action, action: new action() });
}
exports.RegisterAction = RegisterAction;
//# sourceMappingURL=base.js.map