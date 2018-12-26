import consts from "./tokenConsts";

class TokenJS {
    static _solveChallenge(challenge) {
        let solved = "";

        // Prevent any logging from the challenge, by default it logs some debug info
        challenge = challenge.replace("console.", "");

        // Make a few if-statements always return true as the functions are currently missing
        challenge = challenge.replace("this.angular.isObject(offset)", "true");
        challenge = challenge.replace("this.angular.isString(offset)", "true");
        challenge = challenge.replace("this.angular.isDate(offset)", "true");
        challenge = challenge.replace("this.angular.isArray(offset)", "true");

        (() => {
            // Concat the method needed in order to solve the challenge, then eval the string
            let solver = Function(consts.EVAL_ + challenge);
            // Execute the string, and get back the solved token
            solved = solver().toString();
        })();

        return solved;
    }

    static _decodeBase64(b64) {
        // for the session token
        return new Buffer(b64, "base64").toString("ascii");
    }

    static _concatTokens(headerToken, challengeToken) {
        // Combine the session token and the challenge token together to get the string needed to connect to the websocket endpoint
        let token = "";

        for (let i = 0; i < headerToken.length; i++) {
            let char = headerToken.charCodeAt(i);
            let mod = challengeToken.charCodeAt(i % challengeToken.length);
            let decodedChar = char ^ mod;
            token += String.fromCharCode(decodedChar);
        }

        return token;
    }

    static resolve(sessionID, callback) {
        let me = new TokenJS();

        me._requestToken(sessionID, (headerToken, challenge, responseCode, responseMessage) => {
            if (responseCode === consts.INNER_RESPONSES.OK
                && headerToken && challenge) {
                let token1 = TokenJS._decodeBase64(headerToken);
                let token2 = TokenJS._solveChallenge(challenge);
                let resolvedToken = TokenJS._concatTokens(token1, token2, responseCode, responseMessage);
                callback(resolvedToken, responseCode, responseMessage);
            } else {
                callback(null, responseCode, responseMessage);
            }
        });
    }

    _requestToken(sessionID, callback) {
        fetch(consts.ENDPOINT_URI + consts.TOKEN_ENDPOINT + sessionID, {
            method: 'get',
            headers: new Headers(consts.HEADERS)
        })
            .then((response) => {
                // The first token is the session token, which is given as a header by the server encoded in base64
                // Checking if the header is defined before continuing, basically checking if the room exists.
                if (response.status === 200) {
                    if (!response.headers || !response.headers.map || !response.headers.map['x-kahoot-session-token']) {
                        callback(null, null,
                            consts.INNER_RESPONSES.MISSING_HEADER,
                            "Kahoot session header is undefined. (This normally means that the room no longer exists.)");
                    }
                } else {
                    callback(null, null,
                        consts.INNER_RESPONSES.REQUEST_FAILED,
                        "Connection error happened when trying to connect to the game."
                        + response.statusText ? " \r\n" + response.statusText : "");
                }

                response.json().then((responseJson) => {
                    // The second token is given as a "challenge", which must be eval'd by the client to be decoded
                    callback(response.headers.map['x-kahoot-session-token'],
                        responseJson.challenge,
                        consts.INNER_RESPONSES.OK);
                });
            })
            .catch((error) => {
                new Error(error);
            });
    }
}

module.exports = TokenJS;
