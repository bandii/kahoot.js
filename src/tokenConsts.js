module.exports = {
    ENDPOINT_URI: "https://kahoot.it",
    TOKEN_ENDPOINT: "/reserve/session/",
    EVAL_: "var _ = {" +
        "	replace: function() {" +
        "		var args = arguments;" +
        "		var str = arguments[0];" +
        "		return str.replace(args[1], args[2]);" +
        "	}" +
        "}; " +
        "var log = function(){};" +
        "return ",
    HEADERS: {
        "user-agent": "kahoot.js",
        "host": "kahoot.it",
        "referer": "https://kahoot.it/",
        "accept-language": "en-US,en;q=0.8",
        "accept": "*/*"
    },
    INNER_RESPONSES: {
        "OK": "ok",
        "MISSING_HEADER": "missingHeader",
        "REQUEST_FAILED": "requestFailed"
    }
};
