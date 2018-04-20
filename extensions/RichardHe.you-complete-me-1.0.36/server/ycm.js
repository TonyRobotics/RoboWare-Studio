"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const net = require("net");
const crypto = require("crypto");
const childProcess = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const _ = require("lodash");
const utils_1 = require("./utils");
const ycmRequest_1 = require("./ycmRequest");
class Ycm {
    constructor(settings) {
        this.settings = settings;
    }
    findUnusedPort() {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.listen(0, () => {
                resolve(server.address().port);
                server.close();
            });
            server.on('error', (err) => reject(err));
        });
    }
    readDefaultOptions() {
        return new Promise((resolve, reject) => {
            fs.readFile(path.resolve(this.settings.ycmd.path, 'ycmd', 'default_settings.json'), { encoding: 'utf8' }, (err, data) => {
                if (err)
                    reject(err);
                else
                    resolve(JSON.parse(data));
            });
        });
    }
    generateRandomSecret() {
        return crypto.randomBytes(16);
    }
    processData([unusedPort, hmac, options]) {
        this.port = unusedPort;
        this.hmacSecret = hmac;
        options.hmac_secret = this.hmacSecret.toString('base64');
        options.global_ycm_extra_conf = this.settings.ycmd.global_extra_config;
        options.confirm_extra_conf = this.settings.ycmd.confirm_extra_conf;
        options.extra_conf_globlist = [];
        options.rustSrcPath = '';
        const optionsFile = path.resolve(os.tmpdir(), `VSCodeYcmOptions-${Date.now()}`);
        utils_1.logger(`processData: ${JSON.stringify(options)}`);
        return new Promise((resolve, reject) => {
            fs.writeFile(optionsFile, JSON.stringify(options), { encoding: 'utf8' }, (err) => {
                if (err)
                    reject(err);
                else
                    resolve(optionsFile);
            });
        });
    }
    _start(optionsFile) {
        return new Promise((resolve, reject) => {
            let cmd = this.settings.ycmd.python;
            let args = [
                path.resolve(this.settings.ycmd.path, 'ycmd'),
                `--port=${this.port}`,
                `--options_file=${optionsFile}`,
                `--idle_suicide_seconds=600`
            ];
            if (process.platform === 'win32') {
                args = args.map(it => `"${it.replace(/"/g, '\\"')}"`);
                cmd = `"${cmd.replace(/"/g, '\\"')}"`;
                args.unshift(cmd);
                args = ['/s', '/d', '/c', `"${args.join(' ')}"`];
                cmd = 'cmd.exe';
            }
            const options = {
                windowsVerbatimArguments: true,
                cwd: this.workingDir,
                env: process.env
            };
            utils_1.logger('_start', args);
            const cp = childProcess.spawn(cmd, args, options);
            utils_1.logger('_start', `process spawn success ${cp.pid}`);
            cp.stdout.on('data', (data) => utils_1.logger(`ycm stdout`, utils_1.crossPlatformBufferToString(data)));
            cp.stderr.on('data', (data) => utils_1.logger(`ycm stderr`, utils_1.crossPlatformBufferToString(data)));
            cp.on('error', (err) => {
                utils_1.logger('_start error', err);
            });
            cp.on('exit', (code) => {
                utils_1.logger('_start exit', code);
                this.process = null;
                switch (code) {
                    case 3: reject(new Error('Unexpected error while loading the YCM core library.'));
                    case 4: reject(new Error('YCM core library not detected; you need to compile YCM before using it. Follow the instructions in the documentation.'));
                    case 5: reject(new Error('YCM core library compiled for Python 3 but loaded in Python 2. Set the Python Executable config to a Python 3 interpreter path.'));
                    case 6: reject(new Error('YCM core library compiled for Python 2 but loaded in Python 3. Set the Python Executable config to a Python 2 interpreter path.'));
                    case 7: reject(new Error('YCM core library too old; PLEASE RECOMPILE by running the install.py script. See the documentation for more details.'));
                }
            });
            setTimeout(() => resolve(cp), 1000);
        });
    }
    static start(workingDir, settings, window) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ycm = new Ycm(settings);
                ycm.workingDir = workingDir;
                ycm.window = window;
                const data = yield Promise.all([ycm.findUnusedPort(), ycm.generateRandomSecret(), ycm.readDefaultOptions()]);
                utils_1.logger('start', `unused port: ${data[0]}`);
                utils_1.logger('start', `random secret: ${data[1].toString('hex')}`);
                utils_1.logger('start', `default options: ${JSON.stringify(data[2])}`);
                const optionsFile = yield ycm.processData(data);
                utils_1.logger('start', `optionsFile: ${optionsFile}`);
                ycm.process = yield ycm._start(optionsFile);
                utils_1.logger('start', `ycm started: ${ycm.process.pid}`);
                return ycm;
            }
            catch (err) {
                throw err;
            }
        });
    }
    static getInstance(workingDir, settings, window) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Ycm.Initializing)
                return new Promise((resolve, reject) => {
                    utils_1.logger('getInstance', 'ycm is initializing, delay 200ms...');
                    setTimeout(() => resolve(Ycm.getInstance(workingDir, settings, window)), 200);
                });
            if (!Ycm.Instance || Ycm.Instance.workingDir !== workingDir || !_.isEqual(Ycm.Instance.settings, settings) || !Ycm.Instance.process) {
                utils_1.logger('getInstance', `ycm is restarting`);
                if (!!Ycm.Instance)
                    yield Ycm.Instance.reset();
                try {
                    Ycm.Initializing = true;
                    Ycm.Instance = yield Ycm.start(workingDir, settings, window);
                }
                catch (err) {
                    throw err;
                }
                finally {
                    Ycm.Initializing = false;
                }
            }
            return Ycm.Instance;
        });
    }
    static reset() {
        if (!!Ycm.Instance) {
            Ycm.Instance.reset();
        }
    }
    reset() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!!this.process) {
                try {
                    const request = this.buildRequest(null);
                    yield request.request('shutdown');
                }
                catch (e) {
                    utils_1.logger('reset', e);
                }
                this.process = null;
                this.port = null;
                this.hmacSecret = null;
            }
        });
    }
    buildRequest(currentDocument, position = null, documents = null, event = null) {
        return new ycmRequest_1.default(this.window, this.port, this.hmacSecret, this.workingDir, currentDocument, position, documents, event);
    }
    runCompleterCommand(documentUri, position, documents, command) {
        return this.buildRequest(documentUri, position, documents, command).isCommand().request();
    }
    eventNotification(documentUri, position, documents, event) {
        return this.buildRequest(documentUri, position, documents, event).request();
    }
    getReady(documentUri, documents) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.eventNotification(documentUri, null, documents, 'BufferVisit');
            utils_1.logger(`getReady`, JSON.stringify(response));
        });
    }
    completion(documentUri, position, documents) {
        return __awaiter(this, void 0, void 0, function* () {
            const request = this.buildRequest(documentUri, position, documents);
            const response = yield request.request('completions');
            const completions = response['completions'];
            const res = utils_1.mapYcmCompletionsToLanguageServerCompletions(completions);
            utils_1.logger(`completion`, `ycm responsed ${res.length} items`);
            return res;
        });
    }
    getType(documentUri, position, documents, imprecise = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const type = yield this.runCompleterCommand(documentUri, position, documents, imprecise ? 'GetTypeImprecise' : 'GetType');
            utils_1.logger('getType', JSON.stringify(type));
            return utils_1.mapYcmTypeToHover(type, documents.get(documentUri).languageId);
        });
    }
    goTo(documentUri, position, documents) {
        return __awaiter(this, void 0, void 0, function* () {
            const definition = yield this.runCompleterCommand(documentUri, position, documents, 'GoTo');
            utils_1.logger('goTo', JSON.stringify(definition));
            return utils_1.mapYcmLocationToLocation(definition);
        });
    }
    getDoc(documentUri, position, documents) {
        return __awaiter(this, void 0, void 0, function* () {
            const doc = yield this.runCompleterCommand(documentUri, position, documents, 'GetDoc');
            utils_1.logger('getDoc', JSON.stringify(doc));
        });
    }
    getDetailedDiagnostic(documentUri, position, documents) {
        return __awaiter(this, void 0, void 0, function* () {
            const request = this.buildRequest(documentUri, position, documents);
            const response = yield request.request('detailed_diagnostic');
        });
    }
    readyToParse(documentUri, documents) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.eventNotification(documentUri, null, documents, 'FileReadyToParse');
                if (!_.isArray(response))
                    return [];
                utils_1.logger(`readyToParse`, `ycm responsed ${response.length} items`);
                const issues = response;
                const uri = utils_1.crossPlatformUri(documentUri);
                const [reported_issues, header_issues] = _.partition(issues, it => it.location.filepath === uri);
                // If there are issues we come across in files other than the
                // one we're looking at, it's probably from an included header.
                // Since they may be the root source of errors in the file
                // we're looking at, instead of filtering them all out, let's
                // just pick the first one to display and hard-code it to
                // show up on the first line, since the language
                // server diagnostic interface doesn't appear to be able to
                // report errors in different files.
                if (header_issues.length > 0) {
                    const issue = header_issues[0];
                    const relative = path.relative(path.parse(uri).dir, path.parse(issue.location.filepath).dir);
                    let location = issue.location.filepath;
                    if (relative.split(/[\/\\\\]/).length <= 1) {
                        location = path.normalize(`./${relative}/${path.parse(issue.location.filepath).base}`);
                    }
                    reported_issues.unshift(Object.assign({}, issue, { text: `${issue.text} in included file ${location}:${issue.location.line_num}`, location: Object.assign({}, issue.location, { column_num: 1, line_num: 1 }), location_extent: Object.assign({}, issue.location_extent, { start: Object.assign({}, issue.location_extent.start, { line_num: 1, column_num: 1 }), end: Object.assign({}, issue.location_extent.end, { line_num: 1, column_num: 1000 }) }) }));
                }
                utils_1.logger(`readyToParse->reported_issues`, JSON.stringify(reported_issues));
                return utils_1.mapYcmDiagnosticToLanguageServerDiagnostic(reported_issues).filter(it => !!it.range);
            }
            catch (err) {
                return [];
            }
        });
    }
    fixIt(documentUri, position, documents) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.runCompleterCommand(documentUri, position, documents, 'FixIt');
            const fixits = response.fixits;
            const uri = utils_1.crossPlatformUri(documentUri);
            fixits.forEach(it => {
                if (it.text.indexOf(uri) !== -1)
                    it.text = it.text.replace(`${uri}:`, '');
            });
            return fixits;
        });
    }
    currentIdentifierFinished(documentUri, documents) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.eventNotification(documentUri, null, documents, 'CurrentIdentifierFinished');
        });
    }
    insertLeave(documentUri, documents) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.eventNotification(documentUri, null, documents, 'InsertLeave');
        });
    }
}
Ycm.Initializing = false;
exports.default = Ycm;
//# sourceMappingURL=ycm.js.map
