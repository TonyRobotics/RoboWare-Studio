"use strict";
const mibase_1 = require("./mibase");
const vscode_debugadapter_1 = require("vscode-debugadapter");
const mi2lldb_1 = require("./backend/mi2/mi2lldb");
class LLDBDebugSession extends mibase_1.MI2DebugSession {
    initializeRequest(response, args) {
        response.body.supportsHitConditionalBreakpoints = true;
        response.body.supportsConfigurationDoneRequest = true;
        response.body.supportsConditionalBreakpoints = true;
        response.body.supportsFunctionBreakpoints = true;
        response.body.supportsEvaluateForHovers = true;
        this.sendResponse(response);
    }
    launchRequest(response, args) {
        this.miDebugger = new mi2lldb_1.MI2_LLDB(args.lldbmipath || "lldb-mi", [], args.debugger_args, args.env);
        this.initDebugger();
        this.quit = false;
        this.attached = false;
        this.needContinue = false;
        this.isSSH = false;
        this.started = false;
        this.crashed = false;
        this.debugReady = false;
        this.setValuesFormattingMode(args.valuesFormatting);
        this.miDebugger.printCalls = !!args.printCalls;
        this.miDebugger.debugOutput = !!args.showDevDebugOutput;
        if (args.ssh !== undefined) {
            if (args.ssh.forwardX11 === undefined)
                args.ssh.forwardX11 = true;
            if (args.ssh.port === undefined)
                args.ssh.port = 22;
            if (args.ssh.x11port === undefined)
                args.ssh.x11port = 6000;
            if (args.ssh.x11host === undefined)
                args.ssh.x11host = "localhost";
            if (args.ssh.remotex11screen === undefined)
                args.ssh.remotex11screen = 0;
            this.isSSH = true;
            this.trimCWD = args.cwd.replace(/\\/g, "/");
            this.switchCWD = args.ssh.cwd;
            this.miDebugger.ssh(args.ssh, args.ssh.cwd, args.target, args.arguments, undefined, false).then(() => {
                if (args.autorun)
                    args.autorun.forEach(command => {
                        this.miDebugger.sendUserInput(command);
                    });
                setTimeout(() => {
                    this.miDebugger.emit("ui-break-done");
                }, 50);
                this.sendResponse(response);
                this.miDebugger.start().then(() => {
                    this.started = true;
                    if (this.crashed)
                        this.handlePause(undefined);
                });
            });
        }
        else {
            this.miDebugger.load(args.cwd, args.target, args.arguments, undefined).then(() => {
                if (args.autorun)
                    args.autorun.forEach(command => {
                        this.miDebugger.sendUserInput(command);
                    });
                setTimeout(() => {
                    this.miDebugger.emit("ui-break-done");
                }, 50);
                this.sendResponse(response);
                this.miDebugger.start().then(() => {
                    this.started = true;
                    if (this.crashed)
                        this.handlePause(undefined);
                });
            });
        }
    }
    attachRequest(response, args) {
        this.miDebugger = new mi2lldb_1.MI2_LLDB(args.lldbmipath || "lldb-mi", [], args.debugger_args, args.env);
        this.initDebugger();
        this.quit = false;
        this.attached = true;
        this.needContinue = true;
        this.isSSH = false;
        this.debugReady = false;
        this.setValuesFormattingMode(args.valuesFormatting);
        this.miDebugger.printCalls = !!args.printCalls;
        this.miDebugger.debugOutput = !!args.showDevDebugOutput;
        this.miDebugger.attach(args.cwd, args.executable, args.target).then(() => {
            if (args.autorun)
                args.autorun.forEach(command => {
                    this.miDebugger.sendUserInput(command);
                });
            this.sendResponse(response);
        });
    }
}
vscode_debugadapter_1.DebugSession.run(LLDBDebugSession);
//# sourceMappingURL=lldb.js.map