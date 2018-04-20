var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var vscode_debugadapter_1 = require('vscode-debugadapter');
var mi2_1 = require('./backend/mi2/mi2');
var vscode = require('vscode');
var MI2DebugSession = (function (_super) {
    __extends(MI2DebugSession, _super);
    function MI2DebugSession(debuggerLinesStartAt1, isServer) {
        if (isServer === void 0) { isServer = false; }
        _super.call(this, debuggerLinesStartAt1, isServer);
        console.log("CONSTRUCTED");
    }
    MI2DebugSession.prototype.initializeRequest = function (response, args) {
        this.sendResponse(response);
        this.gdbDebugger = new mi2_1.MI2("gdb", ["--interpreter=mi2"]);
        this.gdbDebugger.on("quit", this.stopEvent);
        this.gdbDebugger.on("msg", this.handleMsg);
        this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
        console.log("INITIALIZED");
    };
    MI2DebugSession.prototype.handleMsg = function (type, msg) {
        if (type == "target")
            type = "stdout";
        if (type == "log")
            type = "stderr";
        this.sendEvent(new vscode_debugadapter_1.OutputEvent(msg, type));
    };
    MI2DebugSession.prototype.stopEvent = function () {
        this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
    };
    MI2DebugSession.prototype.launchRequest = function (response, args) {
        var _this = this;
        console.log("LAUNCH REQUEST");
        this.gdbDebugger.load(vscode.workspace.rootPath, args.target).then(function () {
            _this.gdbDebugger.start().then(function () {
                _this.sendResponse(response);
            });
        });
    };
    MI2DebugSession.prototype.setBreakPointsRequest = function (response, args) {
        console.log("BREAKPOINTS");
        console.log(args.breakpoints);
    };
    MI2DebugSession.prototype.threadsRequest = function (response) {
        console.log("THREADS REQUEST");
    };
    MI2DebugSession.prototype.stackTraceRequest = function (response, args) {
        console.log("STACK TRACE REQUEST");
    };
    MI2DebugSession.prototype.scopesRequest = function (response, args) {
        console.log("SCOPES REQUEST");
    };
    MI2DebugSession.prototype.variablesRequest = function (response, args) {
        console.log("VARIABLES REQUEST");
    };
    MI2DebugSession.prototype.continueRequest = function (response, args) {
        var _this = this;
        console.log("CONTINUE REQUEST");
        this.gdbDebugger.continue().then(function (done) {
            _this.sendResponse(response);
            _this.sendEvent(new vscode_debugadapter_1.StoppedEvent("step", args.threadId));
        }, function (msg) {
            _this.sendResponse(response);
            _this.sendEvent(new vscode_debugadapter_1.OutputEvent("Could not continue: " + msg + "\n", 'stderr'));
        });
    };
    MI2DebugSession.prototype.nextRequest = function (response, args) {
        var _this = this;
        console.log("NEXT REQUEST");
        this.gdbDebugger.next().then(function (done) {
            _this.sendResponse(response);
            _this.sendEvent(new vscode_debugadapter_1.StoppedEvent("step", args.threadId));
        }, function (msg) {
            _this.sendResponse(response);
            _this.sendEvent(new vscode_debugadapter_1.OutputEvent("Could not step: " + msg + "\n", 'stderr'));
        });
    };
    MI2DebugSession.prototype.evaluateRequest = function (response, args) {
        console.log("EVAL REQUEST");
        this.gdbDebugger.sendRaw(args.expression);
        this.sendResponse(response);
    };
    MI2DebugSession.THREAD_ID = 1;
    return MI2DebugSession;
})(vscode_debugadapter_1.DebugSession);
vscode_debugadapter_1.DebugSession.run(MI2DebugSession);
//# sourceMappingURL=extension.js.map