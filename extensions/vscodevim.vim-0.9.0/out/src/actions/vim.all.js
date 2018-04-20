"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Make sure they are all loaded.
 */
require("./base");
require("./operator");
require("./motion");
require("./textobject");
// commands
require("./commands/insert");
/**
 * Plugins
 */
// easymotion
require("./plugins/easymotion/easymotion.cmd");
// surround
require("./plugins/surround");
//# sourceMappingURL=vim.all.js.map