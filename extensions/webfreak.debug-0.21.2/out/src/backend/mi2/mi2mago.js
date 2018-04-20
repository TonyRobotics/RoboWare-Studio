"use strict";
const mi2lldb_1 = require("./mi2lldb");
const mi_parse_1 = require("../mi_parse");
class MI2_Mago extends mi2lldb_1.MI2_LLDB {
    getStack(maxLevels) {
        return new Promise((resolve, reject) => {
            let command = "stack-list-frames";
            this.sendCommand(command).then((result) => {
                let stack = result.resultRecords.results;
                let ret = [];
                let remaining = [];
                let addToStack = (element) => {
                    let level = mi_parse_1.MINode.valueOf(element, "frame.level");
                    let addr = mi_parse_1.MINode.valueOf(element, "frame.addr");
                    let func = mi_parse_1.MINode.valueOf(element, "frame.func");
                    let filename = mi_parse_1.MINode.valueOf(element, "file");
                    let file = mi_parse_1.MINode.valueOf(element, "fullname");
                    let line = 0;
                    let lnstr = mi_parse_1.MINode.valueOf(element, "line");
                    if (lnstr)
                        line = parseInt(lnstr);
                    let from = parseInt(mi_parse_1.MINode.valueOf(element, "from"));
                    ret.push({
                        address: addr,
                        fileName: filename || "",
                        file: file || "<unknown>",
                        function: func || from || "<unknown>",
                        level: level,
                        line: line
                    });
                };
                stack.forEach(element => {
                    if (element)
                        if (element[0] == "stack") {
                            addToStack(element[1]);
                        }
                        else
                            remaining.push(element);
                });
                if (remaining.length)
                    addToStack(remaining);
                resolve(ret);
            }, reject);
        });
    }
}
exports.MI2_Mago = MI2_Mago;
//# sourceMappingURL=mi2mago.js.map