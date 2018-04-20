"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const vscode_debugadapter_1 = require("vscode-debugadapter");
const backend_1 = require("./backend/backend");
const mi_parse_1 = require("./backend/mi_parse");
const gdb_expansion_1 = require("./backend/gdb_expansion");
const path_1 = require("path");
const systemPath = require("path");
const net = require("net");
const os = require("os");
const fs = require("fs");
let resolve = path_1.posix.resolve;
let relative = path_1.posix.relative;
class ExtendedVariable {
    constructor(name, options) {
        this.name = name;
        this.options = options;
    }
}
const STACK_HANDLES_START = 1000;
const VAR_HANDLES_START = 2000;
class MI2DebugSession extends vscode_debugadapter_1.DebugSession {
    constructor(debuggerLinesStartAt1, isServer = false, threadID = 1) {
        super(debuggerLinesStartAt1, isServer);
        this.variableHandles = new vscode_debugadapter_1.Handles(VAR_HANDLES_START);
        this.variableHandlesReverse = {};
        this.threadID = 1;
        this.threadID = threadID;
    }
    initDebugger() {
        this.miDebugger.on("launcherror", this.launchError.bind(this));
        this.miDebugger.on("quit", this.quitEvent.bind(this));
        this.miDebugger.on("exited-normally", this.quitEvent.bind(this));
        this.miDebugger.on("stopped", this.stopEvent.bind(this));
        this.miDebugger.on("msg", this.handleMsg.bind(this));
        this.miDebugger.on("breakpoint", this.handleBreakpoint.bind(this));
        this.miDebugger.on("step-end", this.handleBreak.bind(this));
        this.miDebugger.on("step-out-end", this.handleBreak.bind(this));
        this.miDebugger.on("signal-stop", this.handlePause.bind(this));
        this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
        try {
            this.commandServer = net.createServer(c => {
                c.on("data", data => {
                    var rawCmd = data.toString();
                    var spaceIndex = rawCmd.indexOf(" ");
                    var func = rawCmd;
                    var args = [];
                    if (spaceIndex != -1) {
                        func = rawCmd.substr(0, spaceIndex);
                        args = JSON.parse(rawCmd.substr(spaceIndex + 1));
                    }
                    Promise.resolve(this.miDebugger[func].apply(this.miDebugger, args)).then(data => {
                        c.write(data.toString());
                    });
                });
            });
            this.commandServer.on("error", err => {
                if (process.platform != "win32")
                    this.handleMsg("stderr", "Code-Debug WARNING: Utility Command Server: Error in command socket " + err.toString() + "\nCode-Debug WARNING: The examine memory location command won't work");
            });
            if (!fs.existsSync(systemPath.join(os.tmpdir(), "code-debug-sockets")))
                fs.mkdirSync(systemPath.join(os.tmpdir(), "code-debug-sockets"));
            this.commandServer.listen(systemPath.join(os.tmpdir(), "code-debug-sockets", "Debug-Instance-" + Math.floor(Math.random() * 36 * 36 * 36 * 36).toString(36)));
        }
        catch (e) {
            if (process.platform != "win32")
                this.handleMsg("stderr", "Code-Debug WARNING: Utility Command Server: Failed to start " + e.toString() + "\nCode-Debug WARNING: The examine memory location command won't work");
        }
    }
    setValuesFormattingMode(mode) {
        switch (mode) {
            case "disabled":
                this.useVarObjects = true;
                this.miDebugger.prettyPrint = false;
                break;
            case "prettyPrinters":
                this.useVarObjects = true;
                this.miDebugger.prettyPrint = true;
                break;
            case "parseText":
            default:
                this.useVarObjects = false;
                this.miDebugger.prettyPrint = false;
        }
    }
    handleMsg(type, msg) {
        if (type == "target")
            type = "stdout";
        if (type == "log")
            type = "stderr";
        this.sendEvent(new vscode_debugadapter_1.OutputEvent(msg, type));
    }
    handleBreakpoint(info) {
        this.sendEvent(new vscode_debugadapter_1.StoppedEvent("breakpoint", this.threadID));
    }
    handleBreak(info) {
        this.sendEvent(new vscode_debugadapter_1.StoppedEvent("step", this.threadID));
    }
    handlePause(info) {
        this.sendEvent(new vscode_debugadapter_1.StoppedEvent("user request", this.threadID));
    }
    stopEvent(info) {
        if (!this.started)
            this.crashed = true;
        if (!this.quit)
            this.sendEvent(new vscode_debugadapter_1.StoppedEvent("exception", this.threadID));
    }
    quitEvent() {
        this.quit = true;
        this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
    }
    launchError(err) {
        this.handleMsg("stderr", "Could not start debugger process, does the program exist in filesystem?\n");
        this.handleMsg("stderr", err.toString() + "\n");
        this.quitEvent();
    }
    disconnectRequest(response, args) {
        if (this.attached)
            this.miDebugger.detach();
        else
            this.miDebugger.stop();
        this.commandServer.close();
        this.commandServer = undefined;
        this.sendResponse(response);
    }
    setVariableRequest(response, args) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.useVarObjects) {
                    let name = args.name;
                    if (args.variablesReference >= VAR_HANDLES_START) {
                        const parent = this.variableHandles.get(args.variablesReference);
                        name = `${parent.name}.${name}`;
                    }
                    let res = yield this.miDebugger.varAssign(name, args.value);
                    response.body = {
                        value: res.result("value")
                    };
                }
                else {
                    yield this.miDebugger.changeVariable(args.name, args.value);
                    response.body = {
                        value: args.value
                    };
                }
                this.sendResponse(response);
            }
            catch (err) {
                this.sendErrorResponse(response, 11, `Could not continue: ${err}`);
            }
            ;
        });
    }
    setFunctionBreakPointsRequest(response, args) {
        let cb = (() => {
            this.debugReady = true;
            let all = [];
            args.breakpoints.forEach(brk => {
                all.push(this.miDebugger.addBreakPoint({ raw: brk.name, condition: brk.condition, countCondition: brk.hitCondition }));
            });
            Promise.all(all).then(brkpoints => {
                let finalBrks = [];
                brkpoints.forEach(brkp => {
                    if (brkp[0])
                        finalBrks.push({ line: brkp[1].line });
                });
                response.body = {
                    breakpoints: finalBrks
                };
                this.sendResponse(response);
            }, msg => {
                this.sendErrorResponse(response, 10, msg.toString());
            });
        }).bind(this);
        if (this.debugReady)
            cb();
        else
            this.miDebugger.once("debug-ready", cb);
    }
    setBreakPointsRequest(response, args) {
        let cb = (() => {
            this.debugReady = true;
            this.miDebugger.clearBreakPoints().then(() => {
                let path = args.source.path;
                if (this.isSSH) {
                    path = relative(this.trimCWD.replace(/\\/g, "/"), path.replace(/\\/g, "/"));
                    path = resolve(this.switchCWD.replace(/\\/g, "/"), path.replace(/\\/g, "/"));
                }
                let all = [];
                args.breakpoints.forEach(brk => {
                    all.push(this.miDebugger.addBreakPoint({ file: path, line: brk.line, condition: brk.condition, countCondition: brk.hitCondition }));
                });
                Promise.all(all).then(brkpoints => {
                    let finalBrks = [];
                    brkpoints.forEach(brkp => {
                        if (brkp[0])
                            finalBrks.push({ line: brkp[1].line });
                    });
                    response.body = {
                        breakpoints: finalBrks
                    };
                    this.sendResponse(response);
                }, msg => {
                    this.sendErrorResponse(response, 9, msg.toString());
                });
            }, msg => {
                this.sendErrorResponse(response, 9, msg.toString());
            });
        }).bind(this);
        if (this.debugReady)
            cb();
        else
            this.miDebugger.once("debug-ready", cb);
    }
    threadsRequest(response) {
        response.body = {
            threads: [
                new vscode_debugadapter_1.Thread(this.threadID, "Thread 1")
            ]
        };
        this.sendResponse(response);
    }
    stackTraceRequest(response, args) {
        this.miDebugger.getStack(args.levels).then(stack => {
            let ret = [];
            stack.forEach(element => {
                let file = element.file;
                if (file) {
                    if (this.isSSH) {
                        file = relative(this.switchCWD.replace(/\\/g, "/"), file.replace(/\\/g, "/"));
                        file = systemPath.resolve(this.trimCWD.replace(/\\/g, "/"), file.replace(/\\/g, "/"));
                    }
                    else if (process.platform === "win32") {
                        if (file.startsWith("\\cygdrive\\") || file.startsWith("/cygdrive/")) {
                            file = file[10] + ":" + file.substr(11); // replaces /cygdrive/c/foo/bar.txt with c:/foo/bar.txt
                        }
                    }
                    ret.push(new vscode_debugadapter_1.StackFrame(element.level, element.function + "@" + element.address, new vscode_debugadapter_1.Source(element.fileName, file), element.line, 0));
                }
                else
                    ret.push(new vscode_debugadapter_1.StackFrame(element.level, element.function + "@" + element.address, null, element.line, 0));
            });
            response.body = {
                stackFrames: ret
            };
            this.sendResponse(response);
        }, err => {
            this.sendErrorResponse(response, 12, `Failed to get Stack Trace: ${err.toString()}`);
        });
    }
    configurationDoneRequest(response, args) {
        // FIXME: Does not seem to get called in january release
        if (this.needContinue) {
            this.miDebugger.continue().then(done => {
                this.sendResponse(response);
            }, msg => {
                this.sendErrorResponse(response, 2, `Could not continue: ${msg}`);
            });
        }
        else
            this.sendResponse(response);
    }
    scopesRequest(response, args) {
        const scopes = new Array();
        scopes.push(new vscode_debugadapter_1.Scope("Local", STACK_HANDLES_START + (parseInt(args.frameId) || 0), false));
        response.body = {
            scopes: scopes
        };
        this.sendResponse(response);
    }
    variablesRequest(response, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const variables = [];
            let id;
            if (args.variablesReference < VAR_HANDLES_START) {
                id = args.variablesReference - STACK_HANDLES_START;
            }
            else {
                id = this.variableHandles.get(args.variablesReference);
            }
            let createVariable = (arg, options) => {
                if (options)
                    return this.variableHandles.create(new ExtendedVariable(arg, options));
                else
                    return this.variableHandles.create(arg);
            };
            let findOrCreateVariable = (varObj) => {
                let id;
                if (this.variableHandlesReverse.hasOwnProperty(varObj.name)) {
                    id = this.variableHandlesReverse[varObj.name];
                }
                else {
                    id = createVariable(varObj);
                    this.variableHandlesReverse[varObj.name] = id;
                }
                return varObj.isCompound() ? id : 0;
            };
            if (typeof id == "number") {
                let stack;
                try {
                    stack = yield this.miDebugger.getStackVariables(this.threadID, id);
                    for (const variable of stack) {
                        if (this.useVarObjects) {
                            try {
                                let varObjName = `var_${variable.name}`;
                                let varObj;
                                try {
                                    const changes = yield this.miDebugger.varUpdate(varObjName);
                                    const changelist = changes.result("changelist");
                                    changelist.forEach((change) => {
                                        const name = mi_parse_1.MINode.valueOf(change, "name");
                                        const vId = this.variableHandlesReverse[varObjName];
                                        const v = this.variableHandles.get(vId);
                                        v.applyChanges(change);
                                    });
                                    const varId = this.variableHandlesReverse[varObjName];
                                    varObj = this.variableHandles.get(varId);
                                }
                                catch (err) {
                                    if (err instanceof backend_1.MIError && err.message == "Variable object not found") {
                                        varObj = yield this.miDebugger.varCreate(variable.name, varObjName);
                                        const varId = findOrCreateVariable(varObj);
                                        varObj.exp = variable.name;
                                        varObj.id = varId;
                                    }
                                    else {
                                        throw err;
                                    }
                                }
                                variables.push(varObj.toProtocolVariable());
                            }
                            catch (err) {
                                variables.push({
                                    name: variable.name,
                                    value: `<${err}>`,
                                    variablesReference: 0
                                });
                            }
                        }
                        else {
                            if (variable.valueStr !== undefined) {
                                let expanded = gdb_expansion_1.expandValue(createVariable, `{${variable.name}=${variable.valueStr})`, "", variable.raw);
                                if (expanded) {
                                    if (typeof expanded[0] == "string")
                                        expanded = [
                                            {
                                                name: "<value>",
                                                value: prettyStringArray(expanded),
                                                variablesReference: 0
                                            }
                                        ];
                                    variables.push(expanded[0]);
                                }
                            }
                            else
                                variables.push({
                                    name: variable.name,
                                    type: variable.type,
                                    value: "<unknown>",
                                    variablesReference: createVariable(variable.name)
                                });
                        }
                    }
                    response.body = {
                        variables: variables
                    };
                    this.sendResponse(response);
                }
                catch (err) {
                    this.sendErrorResponse(response, 1, `Could not expand variable: ${err}`);
                }
            }
            else if (typeof id == "string") {
                // Variable members
                let variable;
                try {
                    variable = yield this.miDebugger.evalExpression(JSON.stringify(id));
                    try {
                        let expanded = gdb_expansion_1.expandValue(createVariable, variable.result("value"), id, variable);
                        if (!expanded) {
                            this.sendErrorResponse(response, 2, `Could not expand variable`);
                        }
                        else {
                            if (typeof expanded[0] == "string")
                                expanded = [
                                    {
                                        name: "<value>",
                                        value: prettyStringArray(expanded),
                                        variablesReference: 0
                                    }
                                ];
                            response.body = {
                                variables: expanded
                            };
                            this.sendResponse(response);
                        }
                    }
                    catch (e) {
                        this.sendErrorResponse(response, 2, `Could not expand variable: ${e}`);
                    }
                }
                catch (err) {
                    this.sendErrorResponse(response, 1, `Could not expand variable: ${err}`);
                }
            }
            else if (typeof id == "object") {
                if (id instanceof backend_1.VariableObject) {
                    // Variable members
                    let children;
                    try {
                        children = yield this.miDebugger.varListChildren(id.name);
                        const vars = children.map(child => {
                            const varId = findOrCreateVariable(child);
                            child.id = varId;
                            return child.toProtocolVariable();
                        });
                        response.body = {
                            variables: vars
                        };
                        this.sendResponse(response);
                    }
                    catch (err) {
                        this.sendErrorResponse(response, 1, `Could not expand variable: ${err}`);
                    }
                }
                else if (id instanceof ExtendedVariable) {
                    let varReq = id;
                    if (varReq.options.arg) {
                        let strArr = [];
                        let argsPart = true;
                        let arrIndex = 0;
                        let submit = () => {
                            response.body = {
                                variables: strArr
                            };
                            this.sendResponse(response);
                        };
                        let addOne = () => __awaiter(this, void 0, void 0, function* () {
                            const variable = yield this.miDebugger.evalExpression(JSON.stringify(`${varReq.name}+${arrIndex})`));
                            try {
                                let expanded = gdb_expansion_1.expandValue(createVariable, variable.result("value"), varReq.name, variable);
                                if (!expanded) {
                                    this.sendErrorResponse(response, 15, `Could not expand variable`);
                                }
                                else {
                                    if (typeof expanded == "string") {
                                        if (expanded == "<nullptr>") {
                                            if (argsPart)
                                                argsPart = false;
                                            else
                                                return submit();
                                        }
                                        else if (expanded[0] != '"') {
                                            strArr.push({
                                                name: "[err]",
                                                value: expanded,
                                                variablesReference: 0
                                            });
                                            return submit();
                                        }
                                        strArr.push({
                                            name: `[${(arrIndex++)}]`,
                                            value: expanded,
                                            variablesReference: 0
                                        });
                                        addOne();
                                    }
                                    else {
                                        strArr.push({
                                            name: "[err]",
                                            value: expanded,
                                            variablesReference: 0
                                        });
                                        submit();
                                    }
                                }
                            }
                            catch (e) {
                                this.sendErrorResponse(response, 14, `Could not expand variable: ${e}`);
                            }
                        });
                        addOne();
                    }
                    else
                        this.sendErrorResponse(response, 13, `Unimplemented variable request options: ${JSON.stringify(varReq.options)}`);
                }
                else {
                    response.body = {
                        variables: id
                    };
                    this.sendResponse(response);
                }
            }
            else {
                response.body = {
                    variables: variables
                };
                this.sendResponse(response);
            }
        });
    }
    pauseRequest(response, args) {
        this.miDebugger.interrupt().then(done => {
            this.sendResponse(response);
        }, msg => {
            this.sendErrorResponse(response, 3, `Could not pause: ${msg}`);
        });
    }
    reverseContinueRequest(response, args) {
        this.miDebugger.continue(true).then(done => {
            this.sendResponse(response);
        }, msg => {
            this.sendErrorResponse(response, 2, `Could not continue: ${msg}`);
        });
    }
    continueRequest(response, args) {
        this.miDebugger.continue().then(done => {
            this.sendResponse(response);
        }, msg => {
            this.sendErrorResponse(response, 2, `Could not continue: ${msg}`);
        });
    }
    stepBackRequest(response, args) {
        this.miDebugger.step(true).then(done => {
            this.sendResponse(response);
        }, msg => {
            this.sendErrorResponse(response, 4, `Could not step back: ${msg} - Try running 'target record-full' before stepping back`);
        });
    }
    stepInRequest(response, args) {
        this.miDebugger.step().then(done => {
            this.sendResponse(response);
        }, msg => {
            this.sendErrorResponse(response, 4, `Could not step in: ${msg}`);
        });
    }
    stepOutRequest(response, args) {
        this.miDebugger.stepOut().then(done => {
            this.sendResponse(response);
        }, msg => {
            this.sendErrorResponse(response, 5, `Could not step out: ${msg}`);
        });
    }
    nextRequest(response, args) {
        this.miDebugger.next().then(done => {
            this.sendResponse(response);
        }, msg => {
            this.sendErrorResponse(response, 6, `Could not step over: ${msg}`);
        });
    }
    evaluateRequest(response, args) {
        if (args.context == "watch" || args.context == "hover")
            this.miDebugger.evalExpression(args.expression).then((res) => {
                response.body = {
                    variablesReference: 0,
                    result: res.result("value")
                };
                this.sendResponse(response);
            }, msg => {
                this.sendErrorResponse(response, 7, msg.toString());
            });
        else {
            this.miDebugger.sendUserInput(args.expression).then(output => {
                if (typeof output == "undefined")
                    response.body = {
                        result: "",
                        variablesReference: 0
                    };
                else
                    response.body = {
                        result: JSON.stringify(output),
                        variablesReference: 0
                    };
                this.sendResponse(response);
            }, msg => {
                this.sendErrorResponse(response, 8, msg.toString());
            });
        }
    }
}
exports.MI2DebugSession = MI2DebugSession;
function prettyStringArray(strings) {
    if (typeof strings == "object") {
        if (strings.length !== undefined)
            return strings.join(", ");
        else
            return JSON.stringify(strings);
    }
    else
        return strings;
}
//# sourceMappingURL=mibase.js.map