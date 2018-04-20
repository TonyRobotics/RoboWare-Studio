/*
    {
        quit = false,
        _views = {
            {
                view = 0x7ffff7ece1e8,
                renderer = 0x7ffff7eccc50,
                world = 0x7ffff7ece480
            }
        },
        deltaTimer = {
            _flagStarted = false,
            _timeStart = {length = 0},
            _timeMeasured = {length = 0}
        },
        _start = {callbacks = 0x0},
        _stop = {callbacks = 0x0}
    }
*/
var resultRegex = /^([a-zA-Z_\-][a-zA-Z0-9_\-]*)\s*=\s*/;
var variableRegex = /^[a-zA-Z_\-][a-zA-Z0-9_\-]*/;
var referenceRegex = /^0x[0-9a-fA-F]+/;
var numberRegex = /^[0-9]+/;
function expandValue(variableCreate, value) {
    var parseCString = function () {
        value = value.trim();
        if (value[0] != '"')
            return "";
        var stringEnd = 1;
        var inString = true;
        var remaining = value.substr(1);
        var escaped = false;
        while (inString) {
            if (escaped)
                escaped = false;
            else if (remaining[0] == '\\')
                escaped = true;
            else if (remaining[0] == '"')
                inString = false;
            remaining = remaining.substr(1);
            stringEnd++;
        }
        var str = value.substr(0, stringEnd).trim();
        value = value.substr(stringEnd).trim();
        return str;
    };
    var parseValue, parseCommaResult, parseCommaValue, parseResult;
    var parseTupleOrList = function () {
        value = value.trim();
        if (value[0] != '{')
            return undefined;
        var oldContent = value;
        value = value.substr(1).trim();
        if (value[0] == '}')
            return [];
        var eqPos = value.indexOf("=");
        var newValPos1 = value.indexOf("{");
        var newValPos2 = value.indexOf(",");
        var newValPos = newValPos1;
        if (newValPos2 != -1 && newValPos2 < newValPos1)
            newValPos = newValPos2;
        if (newValPos != -1 && eqPos > newValPos || eqPos == -1) {
            var values = [];
            var val = parseValue();
            values.push(val);
            var remaining = value;
            while (val = parseCommaValue())
                values.push(val);
            value = value.substr(1).trim(); // }
            return values;
        }
        var result = parseResult();
        if (result) {
            var results = [];
            results.push(result);
            while (result = parseCommaResult())
                results.push(result);
            value = value.substr(1).trim(); // }
            return results;
        }
        return undefined;
    };
    var parsePrimitive = function () {
        var primitive;
        var match;
        value = value.trim();
        if (value.length == 0)
            primitive = undefined;
        else if (value.startsWith("true")) {
            primitive = true;
            value = value.substr(4).trim();
        }
        else if (value.startsWith("false")) {
            primitive = false;
            value = value.substr(5).trim();
        }
        else if (value.startsWith("0x0")) {
            primitive = "<nullptr>";
            value = value.substr(3).trim();
        }
        else if (match = referenceRegex.exec(value)) {
            primitive = "*" + match[0];
            value = value.substr(match[0].length).trim();
        }
        else if (match = numberRegex.exec(value)) {
            primitive = parseInt(match[0]);
            value = value.substr(match[0].length).trim();
        }
        else if (match = variableRegex.exec(value)) {
            primitive = match[0];
            value = value.substr(match[0].length).trim();
        }
        else {
            primitive = "<???>";
        }
        return primitive;
    };
    parseValue = function () {
        value = value.trim();
        if (value[0] == '"')
            return parseCString();
        else if (value[0] == '{')
            return parseTupleOrList();
        else
            return parsePrimitive();
    };
    parseResult = function () {
        value = value.trim();
        var variableMatch = resultRegex.exec(value);
        if (!variableMatch)
            return undefined;
        value = value.substr(variableMatch[0].length).trim();
        var variable = variableMatch[1];
        var val = parseValue();
        var ref = 0;
        if (typeof val == "object") {
            ref = variableCreate(val);
            val = "Object";
        }
        if (typeof val == "string" && val.startsWith("*0x")) {
            ref = variableCreate(val);
            val = "reference";
        }
        return {
            name: variable,
            value: val,
            variablesReference: ref
        };
    };
    parseCommaValue = function () {
        value = value.trim();
        if (value[0] != ',')
            return undefined;
        value = value.substr(1).trim();
        return parseValue();
    };
    parseCommaResult = function () {
        value = value.trim();
        if (value[0] != ',')
            return undefined;
        value = value.substr(1).trim();
        return parseResult();
    };
    value = value.trim();
    return parseValue();
}
exports.expandValue = expandValue;
//# sourceMappingURL=gdb.js.map