var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var mi2_1 = require("./mi2");
var ChildProcess = require("child_process");
var path_1 = require("path");
var nativePath = require("path");
var path = path_1.posix;
var MI2_LLDB = (function (_super) {
    __extends(MI2_LLDB, _super);
    function MI2_LLDB() {
        _super.apply(this, arguments);
    }
    MI2_LLDB.prototype.initCommands = function (target, cwd, ssh) {
        if (ssh === void 0) { ssh = false; }
        if (ssh) {
            if (!path.isAbsolute(target))
                target = path.join(cwd, target);
        }
        else {
            if (!nativePath.isAbsolute(target))
                target = nativePath.join(cwd, target);
        }
        return [
            this.sendCommand("gdb-set target-async on"),
            this.sendCommand("file-exec-and-symbols \"" + mi2_1.escape(target) + "\"")
        ];
    };
    MI2_LLDB.prototype.attach = function (cwd, executable, target) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.process = ChildProcess.spawn(_this.application, _this.preargs, { cwd: cwd });
            _this.process.stdout.on("data", _this.stdout.bind(_this));
            _this.process.stderr.on("data", _this.stderr.bind(_this));
            _this.process.on("exit", (function () { _this.emit("quit"); }).bind(_this));
            Promise.all([
                _this.sendCommand("gdb-set target-async on"),
                _this.sendCommand("file-exec-and-symbols \"" + mi2_1.escape(executable) + "\""),
                _this.sendCommand("target-attach " + target)
            ]).then(function () {
                _this.emit("debug-ready");
                resolve();
            }, reject);
        });
    };
    MI2_LLDB.prototype.clearBreakPoints = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var promises = [];
            for (var k in _this.breakpoints.values) {
                promises.push(_this.sendCommand("break-delete " + k).then(function (result) {
                    if (result.resultRecords.resultClass == "done")
                        resolve(true);
                    else
                        resolve(false);
                }));
            }
            _this.breakpoints.clear();
            Promise.all(promises).then(resolve, reject);
        });
    };
    MI2_LLDB.prototype.setBreakPointCondition = function (bkptNum, condition) {
        return this.sendCommand("break-condition " + bkptNum + " \"" + mi2_1.escape(condition) + "\" 1");
    };
    return MI2_LLDB;
})(mi2_1.MI2);
exports.MI2_LLDB = MI2_LLDB;
//# sourceMappingURL=mi2lldb.1.js.map