"use strict";
const mi_parse_1 = require("./mi_parse");
class VariableObject {
    constructor(node) {
        this.name = mi_parse_1.MINode.valueOf(node, "name");
        this.exp = mi_parse_1.MINode.valueOf(node, "exp");
        this.numchild = parseInt(mi_parse_1.MINode.valueOf(node, "numchild"));
        this.type = mi_parse_1.MINode.valueOf(node, "type");
        this.value = mi_parse_1.MINode.valueOf(node, "value");
        this.threadId = mi_parse_1.MINode.valueOf(node, "thread-id");
        this.frozen = !!mi_parse_1.MINode.valueOf(node, "frozen");
        this.dynamic = !!mi_parse_1.MINode.valueOf(node, "dynamic");
        this.displayhint = mi_parse_1.MINode.valueOf(node, "displayhint");
        // TODO: use has_more when it's > 0
        this.has_more = !!mi_parse_1.MINode.valueOf(node, "has_more");
    }
    applyChanges(node) {
        this.value = mi_parse_1.MINode.valueOf(node, "value");
        if (!!mi_parse_1.MINode.valueOf(node, "type_changed")) {
            this.type = mi_parse_1.MINode.valueOf(node, "new_type");
        }
        this.dynamic = !!mi_parse_1.MINode.valueOf(node, "dynamic");
        this.displayhint = mi_parse_1.MINode.valueOf(node, "displayhint");
        this.has_more = !!mi_parse_1.MINode.valueOf(node, "has_more");
    }
    isCompound() {
        return this.numchild > 0 ||
            this.value === "{...}" ||
            (this.dynamic && (this.displayhint === "array" || this.displayhint === "map"));
    }
    toProtocolVariable() {
        let res = {
            name: this.exp,
            evaluateName: this.name,
            value: (this.value === void 0) ? "<unknown>" : this.value,
            type: this.type,
            // kind: this.displayhint,
            variablesReference: this.id
        };
        if (this.displayhint) {
            res.kind = this.displayhint;
        }
        return res;
    }
}
exports.VariableObject = VariableObject;
;
exports.MIError = class MIError {
    constructor(message, source) {
        Object.defineProperty(this, 'name', {
            get: () => this.constructor.name,
        });
        Object.defineProperty(this, 'message', {
            get: () => message,
        });
        Object.defineProperty(this, 'source', {
            get: () => source,
        });
        Error.captureStackTrace(this, this.constructor);
    }
    toString() {
        return `${this.message} (from ${this.source})`;
    }
};
Object.setPrototypeOf(exports.MIError, Object.create(Error.prototype));
exports.MIError.prototype.constructor = exports.MIError;
//# sourceMappingURL=backend.js.map