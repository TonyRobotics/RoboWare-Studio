"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const taskQueue_1 = require("../../src/taskQueue");
const globals_1 = require("../../src/globals");
/**
 * Every Vim option we support should
 * 1. Be added to contribution section of `package.json`.
 * 2. Named as `vim.{optionName}`, `optionName` is the name we use in Vim.
 * 3. Define a public property in `Configuration `with the same name and a default value.
 *    Or define a private propery and define customized Getter/Setter accessors for it.
 *    Always remember to decorate Getter accessor as @enumerable()
 * 4. If user doesn't set the option explicitly
 *    a. we don't have a similar setting in Code, initialize the option as default value.
 *    b. we have a similar setting in Code, use Code's setting.
 *
 * Vim option override sequence.
 * 1. `:set {option}` on the fly
 * 2. TODO .vimrc.
 * 2. `vim.{option}`
 * 3. VS Code configuration
 * 4. VSCodeVim flavored Vim option default values
 *
 */
class ConfigurationClass {
    constructor() {
        /**
         * Use the system's clipboard when copying.
         */
        this.useSystemClipboard = false;
        /**
         * Enable ctrl- actions that would override existing VSCode actions.
         */
        this.useCtrlKeys = false;
        /**
         * Override default VSCode copy behavior.
         */
        this.overrideCopy = true;
        /**
         * Width in characters to word-wrap to.
         */
        this.textwidth = 80;
        /**
         * Should we highlight incremental search matches?
         */
        this.hlsearch = false;
        /**
         * Ignore case when searching with / or ?.
         */
        this.ignorecase = true;
        /**
         * In / or ?, default to ignorecase=true unless the user types a capital
         * letter.
         */
        this.smartcase = true;
        /**
         * Indent automatically?
         */
        this.autoindent = true;
        /**
         * Use EasyMotion plugin?
         */
        this.easymotion = false;
        /**
         * Use surround plugin?
         */
        this.surround = true;
        /**
         * Easymotion marker appearance settings
         */
        this.easymotionMarkerBackgroundColor = "#000000";
        this.easymotionMarkerForegroundColorOneChar = "#ff0000";
        this.easymotionMarkerForegroundColorTwoChar = "#ffa500";
        this.easymotionMarkerWidthPerChar = 8;
        this.easymotionMarkerHeight = 14;
        this.easymotionMarkerFontFamily = "Consolas";
        this.easymotionMarkerFontSize = "14";
        this.easymotionMarkerFontWeight = "normal";
        this.easymotionMarkerYOffset = 11;
        /**
         * Timeout in milliseconds for remapped commands.
         */
        this.timeout = 1000;
        /**
         * Display partial commands on status bar?
         */
        this.showcmd = true;
        /**
         * What key should <leader> map to in key remappings?
         */
        this.leader = "\\";
        /**
         * How much search or command history should be remembered
         */
        this.history = 50;
        /**
         * Show results of / or ? search as user is typing?
         */
        this.incsearch = true;
        /**
         * Start in insert mode?
         */
        this.startInInsertMode = false;
        /**
         * Enable changing of the status bar color based on mode
         */
        this.statusBarColorControl = false;
        /**
         * Status bar colors to change to based on mode
         */
        this.statusBarColors = {
            "normal": "#005f5f",
            "insert": "#5f0000",
            "visual": "#5f00af",
            "visualline": "#005f87",
            "visualblock": "#86592d",
            "replace": "#000000",
        };
        /**
         * Color of search highlights.
         */
        this.searchHighlightColor = "rgba(150, 150, 255, 0.3)";
        this.iskeyword = "/\\()\"':,.;<>~!@#$%^&*|+=[]{}`?-";
        /**
         * Array of all key combinations that were registered in angle bracket notation
         */
        this.boundKeyCombinations = [];
        /**
         * In visual mode, start a search with * or # using the current selection
         */
        this.visualstar = false;
        /**
         * Uses a hack to fix moving around folds.
         */
        this.foldfix = false;
        this.enableNeovim = true;
        this.neovimPath = "nvim";
        this.disableAnnoyingNeovimMessage = false;
        this.updateConfiguration();
    }
    static getInstance() {
        if (ConfigurationClass._instance == null) {
            ConfigurationClass._instance = new ConfigurationClass();
        }
        return ConfigurationClass._instance;
    }
    updateConfiguration() {
        /**
         * Load Vim options from User Settings.
         */
        let vimOptions = vscode.workspace.getConfiguration("vim");
        /* tslint:disable:forin */
        // Disable forin rule here as we make accessors enumerable.`
        for (const option in this) {
            const vimOptionValue = vimOptions[option];
            if (vimOptionValue !== null && vimOptionValue !== undefined) {
                this[option] = vimOptionValue;
            }
        }
        // <space> is special, change it to " " internally if it is used as leader
        if (this.leader.toLowerCase() === "<space>") {
            this.leader = " ";
        }
        // Get the cursor type from vscode
        const cursorStyleString = vscode.workspace.getConfiguration().get("editor.cursorStyle");
        this.userCursor = this.cursorStyleFromString(cursorStyleString);
        // Get configuration setting for handled keys, this allows user to disable
        // certain key comboinations
        const handleKeys = vscode.workspace.getConfiguration('vim')
            .get("handleKeys", []);
        for (const bracketedKey of this.boundKeyCombinations) {
            // Set context for key that is not used
            // This either happens when user sets useCtrlKeys to false (ctrl keys are not used then)
            // Or if user usese vim.handleKeys configuration option to set certain combinations to false
            // By default, all key combinations are used so start with true
            let useKey = true;
            // Check for configuration setting disabling combo
            if (handleKeys[bracketedKey] !== undefined) {
                if (handleKeys[bracketedKey] === false) {
                    useKey = false;
                }
            }
            else if (!this.useCtrlKeys && (bracketedKey.slice(1, 3) === "C-")) {
                // Check for useCtrlKeys and if it is a <C- ctrl> based keybinding.
                // However, we need to still capture <C-c> due to overrideCopy.
                if (bracketedKey === '<C-c>' && this.overrideCopy) {
                    useKey = true;
                }
                else {
                    useKey = false;
                }
            }
            // Set the context of whether or not this key will be used based on criteria from above
            vscode.commands.executeCommand('setContext', 'vim.use' + bracketedKey, useKey);
        }
    }
    cursorStyleFromString(cursorStyle) {
        const cursorType = {
            "line": vscode.TextEditorCursorStyle.Line,
            "block": vscode.TextEditorCursorStyle.Block,
            "underline": vscode.TextEditorCursorStyle.Underline,
            "line-thin": vscode.TextEditorCursorStyle.LineThin,
            "block-outline": vscode.TextEditorCursorStyle.BlockOutline,
            "underline-thin": vscode.TextEditorCursorStyle.UnderlineThin,
        };
        if (cursorType[cursorStyle] !== undefined) {
            return cursorType[cursorStyle];
        }
        else {
            return vscode.TextEditorCursorStyle.Line;
        }
    }
}
__decorate([
    overlapSetting({ codeName: "tabSize", default: 8 })
], ConfigurationClass.prototype, "tabstop", void 0);
__decorate([
    overlapSetting({ codeName: "insertSpaces", default: false })
], ConfigurationClass.prototype, "expandtab", void 0);
__decorate([
    overlapSetting({ codeName: "lineNumbers", default: true, codeValueMapping: { true: "on", false: "off" } })
], ConfigurationClass.prototype, "number", void 0);
__decorate([
    overlapSetting({ codeName: "lineNumbers", default: false, codeValueMapping: { true: "relative", false: "off" } })
], ConfigurationClass.prototype, "relativenumber", void 0);
function overlapSetting(args) {
    return function (target, propertyKey) {
        Object.defineProperty(target, propertyKey, {
            get: function () {
                if (this["_" + propertyKey] !== undefined) {
                    return this["_" + propertyKey];
                }
                if (args.codeValueMapping) {
                    let val = vscode.workspace.getConfiguration("editor").get(args.codeName);
                    if (val !== undefined) {
                        return args.codeValueMapping[val];
                    }
                }
                else {
                    return vscode.workspace.getConfiguration("editor").get(args.codeName, args.default);
                }
            },
            set: function (value) {
                this["_" + propertyKey] = value;
                taskQueue_1.taskQueue.enqueueTask({
                    promise: () => __awaiter(this, void 0, void 0, function* () {
                        if (value === undefined || globals_1.Globals.isTesting) {
                            return;
                        }
                        let codeValue = value;
                        if (args.codeValueMapping) {
                            codeValue = args.codeValueMapping[value];
                        }
                        yield vscode.workspace.getConfiguration("editor").update(args.codeName, codeValue, true);
                    }),
                    isRunning: false,
                    queue: "config"
                });
            },
            enumerable: true,
            configurable: true
        });
    };
}
exports.Configuration = ConfigurationClass.getInstance();
//# sourceMappingURL=configuration.js.map