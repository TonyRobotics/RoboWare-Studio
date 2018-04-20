"use strict";
const mibase_1 = require("./mibase");
const vscode_debugadapter_1 = require("vscode-debugadapter");
const mi2mago_1 = require("./backend/mi2/mi2mago");
class MagoDebugSession extends mibase_1.MI2DebugSession {
    constructor(debuggerLinesStartAt1, isServer = false) {
        super(debuggerLinesStartAt1, isServer, 0);
    }
    initializeRequest(response, args) {
        response.body.supportsHitConditionalBreakpoints = true;
        response.body.supportsConfigurationDoneRequest = true;
        response.body.supportsConditionalBreakpoints = true;
        response.body.supportsFunctionBreakpoints = true;
        response.body.supportsEvaluateForHovers = true;
        this.sendResponse(response);
    }
    getThreadID() {
        return 0;
    }
    launchRequest(response, args) {
        this.miDebugger = new mi2mago_1.MI2_Mago(args.magomipath || "mago-mi", ["-q"], args.debugger_args, args.env);
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
    attachRequest(response, args) {
        this.miDebugger = new mi2mago_1.MI2_Mago(args.magomipath || "mago-mi", [], args.debugger_args, args.env);
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
vscode_debugadapter_1.DebugSession.run(MagoDebugSession);
//# sourceMappingURL=mago.js.map