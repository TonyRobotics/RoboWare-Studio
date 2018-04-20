"use strict";
const mi2_1 = require("./mi2");
const ChildProcess = require("child_process");
const path_1 = require("path");
const nativePath = require("path");
let path = path_1.posix;
class MI2_LLDB extends mi2_1.MI2 {
    initCommands(target, cwd, ssh = false, attach = false) {
        if (ssh) {
            if (!path.isAbsolute(target))
                target = path.join(cwd, target);
        }
        else {
            if (!nativePath.isAbsolute(target))
                target = nativePath.join(cwd, target);
        }
        var cmds = [
            this.sendCommand("gdb-set target-async on")
        ];
        if (!attach)
            cmds.push(this.sendCommand("file-exec-and-symbols \"" + mi2_1.escape(target) + "\""));
        return cmds;
    }
    attach(cwd, executable, target) {
        return new Promise((resolve, reject) => {
            this.process = ChildProcess.spawn(this.application, this.preargs, { cwd: cwd, env: this.procEnv });
            this.process.stdout.on("data", this.stdout.bind(this));
            this.process.stderr.on("data", this.stderr.bind(this));
            this.process.on("exit", (() => { this.emit("quit"); }).bind(this));
            this.process.on("error", ((err) => { this.emit("launcherror", err); }).bind(this));
            Promise.all([
                this.sendCommand("gdb-set target-async on"),
                this.sendCommand("file-exec-and-symbols \"" + mi2_1.escape(executable) + "\""),
                this.sendCommand("target-attach " + target)
            ]).then(() => {
                this.emit("debug-ready");
                resolve();
            }, reject);
        });
    }
    clearBreakPoints() {
        return new Promise((resolve, reject) => {
            let promises = [];
            this.breakpoints.forEach((k, index) => {
                promises.push(this.sendCommand("break-delete " + k).then((result) => {
                    if (result.resultRecords.resultClass == "done")
                        resolve(true);
                    else
                        resolve(false);
                }));
            });
            this.breakpoints.clear();
            Promise.all(promises).then(resolve, reject);
        });
    }
    setBreakPointCondition(bkptNum, condition) {
        return this.sendCommand("break-condition " + bkptNum + " \"" + mi2_1.escape(condition) + "\" 1");
    }
}
exports.MI2_LLDB = MI2_LLDB;
//# sourceMappingURL=mi2lldb.js.map