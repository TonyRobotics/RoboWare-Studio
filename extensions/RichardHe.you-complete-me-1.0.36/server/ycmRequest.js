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
const crypto = require("crypto");
const url = require("url");
const _ = require("lodash");
const http = require("http");
const qs = require("querystring");
const utils_1 = require("./utils");
const utils_2 = require("./utils");
class YcmRequest {
    constructor(window, port, secret, workingDir, currentDocument, position = null, documents = null, event = null) {
        this.workingDir = workingDir;
        this.documentUri = currentDocument;
        this.position = position;
        this.documents = documents;
        this.event = event;
        this.port = port;
        this.secret = secret;
        this.window = window;
    }
    isCommand() {
        this.command = this.event;
        this.event = null;
        return this;
    }
    _request(endpoint, params, method = 'POST') {
        return new Promise((resolve, reject) => {
            utils_2.logger('_request', JSON.stringify(params));
            const path = url.resolve('/', endpoint);
            let payload;
            const message = {
                port: this.port,
                host: 'localhost',
                method: method,
                path: path,
                headers: {}
            };
            if (method === 'GET') {
                message.path = `${message.path}?${qs.stringify(params)}`;
            }
            else {
                payload = this.escapeUnicode(JSON.stringify(params));
                this.signMessage(message, path, payload);
                message.headers['Content-Type'] = 'application/json';
                message.headers['Content-Length'] = payload.length;
            }
            const req = http.request(message, (res) => {
                try {
                    utils_2.logger('_request', `status code: ${res.statusCode}`);
                    res.setEncoding('utf8');
                    const mac = res.headers['x-ycm-hmac'];
                    let response = '';
                    res.on('data', (chunk) => {
                        response += chunk;
                    });
                    res.on('end', () => {
                        utils_2.logger('_request', response);
                        if (!this.verifyHmac(response, mac))
                            reject(new Error('Hmac check failed.'));
                        else {
                            try {
                                const body = JSON.parse(response);
                                this.checkUnknownExtraConf(body);
                                resolve(body);
                            }
                            catch (e) {
                                reject(e);
                            }
                        }
                    });
                    res.on('error', (err) => {
                        reject(err);
                    });
                }
                catch (e) {
                    utils_2.logger('_request http.request', e);
                }
            });
            if (!!payload)
                req.write(payload);
            req.end();
            utils_2.logger('_request', 'req.end called');
        });
    }
    request(endpoint = null, method = 'POST') {
        return __awaiter(this, void 0, void 0, function* () {
            if (!endpoint) {
                if (!!this.event)
                    endpoint = 'event_notification';
                if (!!this.command)
                    endpoint = 'run_completer_command';
                if (!this.event && !this.command)
                    throw new Error('endpoint could not be determained');
            }
            const params = this.buildRequest();
            const res = yield this._request(endpoint, params);
            return res;
        });
    }
    checkUnknownExtraConf(body) {
        if (!body || !body.exception)
            return;
        const error = body;
        const type = body.exception.TYPE;
        if (type === 'UnknownExtraConf') {
            const req = { filepath: error.exception.extra_conf_file };
            // this.window.showInformationMessage(`[Ycm] Found ${error.exception.extra_conf_file}. Load? `, {
            //     title: 'Load',
            //     path: error.exception.extra_conf_file
            // }, {
            //     title: 'Ignore',
            //     path: error.exception.extra_conf_file
            // }).then(it => {
            //     if (it.title === 'Load') {
                    this._request('/load_extra_conf_file', req);
            //     }
            //     else {
            //         this._request('/ignore_extra_conf_file', req);
            //     }
            // });
            throw new Error('ExtraConfFile question found.');
        }
        if (body.exception.TYPE === 'NoExtraConfDetected') {
            this.window.showErrorMessage('[Ycm] No .ycm_extra_conf.py file detected, please read ycmd docs for more details.');
            throw new Error('NoExtraConfDetected');
        }
        throw error;
    }
    buildRequest() {
        const url = utils_2.crossPlatformUri(this.documentUri);
        // const url = document.uri
        utils_2.logger(`buildRequest`, `document, ${url}; position: ${this.position}; event: ${this.event}`);
        const params = {
            filepath: url,
            working_dir: this.workingDir,
            file_data: {}
        };
        if (this.documents) {
            this.documents.all().forEach(it => {
                const url = utils_2.crossPlatformUri(it.uri);
                const type = utils_1.mapVSCodeLanguageIdToYcmFileType(it.languageId);
                params.file_data[url] = {
                    contents: it.getText(),
                    filetypes: [type]
                };
            });
        }
        if (!!this.position) {
            params.line_num = this.position.line + 1;
            params.column_num = this.position.character + 1;
        }
        else {
            params.line_num = 1;
            params.column_num = 1;
        }
        if (!!this.event) {
            params.event_name = this.event;
        }
        if (!!this.command) {
            params.command_arguments = [this.command];
            params.completer_target = 'filetype_default';
        }
        return params;
    }
    generateHmac(data, encoding = null) {
        return crypto.createHmac('sha256', this.secret).update(data).digest(encoding);
    }
    verifyHmac(data, hmac) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const hmac2 = yield this.generateHmac(data, 'base64');
                if (!_.isString(hmac) || !_.isString(hmac2))
                    return false;
                return hmac === hmac2;
            }
            catch (e) {
                utils_2.logger('verifyHmac', e);
            }
        });
    }
    signMessage(message, path, payload) {
        const hmac = this.generateHmac(Buffer.concat([
            this.generateHmac(message.method),
            this.generateHmac(path),
            this.generateHmac(payload)
        ]), 'base64');
        message.headers['X-Ycm-Hmac'] = hmac;
    }
    escapeUnicode(str) {
        const result = [];
        for (const i of _.range(str.length)) {
            const char = str.charAt(i);
            const charCode = str.charCodeAt(i);
            if (charCode < 0x80)
                result.push(char);
            else
                result.push(('\\u' + ('0000' + charCode.toString(16)).substr(-4)));
        }
        return result.join('');
    }
}
exports.default = YcmRequest;
//# sourceMappingURL=ycmRequest.js.map