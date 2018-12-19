var consts = require("./consts");

class TokenJS {
    onResponse;

    static solveChallenge(challenge) {
        var solved = "";
        // Prevent any logging from the challenge, by default it logs some debug info
        challenge = challenge.replace("console.", "");
        // Make a few if-statements always return true as the functions are currently missing
        challenge = challenge.replace("this.angular.isObject(offset)", "true");
        challenge = challenge.replace("this.angular.isString(offset)", "true");
        challenge = challenge.replace("this.angular.isDate(offset)", "true");
        challenge = challenge.replace("this.angular.isArray(offset)", "true");
        (() => {
            // Concat the method needed in order to solve the challenge, then eval the string
            var solver = Function(consts.EVAL_ + challenge);
            // Execute the string, and get back the solved token
            solved = solver().toString();
        })();
        return solved;
    }

    static decodeBase64(b64) {
        // for the session token
        return new Buffer(b64, "base64").toString("ascii");
    }

    static concatTokens(headerToken, challengeToken) {
        // Combine the session token and the challenge token together to get the string needed to connect to the websocket endpoint
        for (var token = "", i = 0; i < headerToken.length; i++) {
            var char = headerToken.charCodeAt(i);
            var mod = challengeToken.charCodeAt(i % challengeToken.length);
            var decodedChar = char ^ mod;
            token += String.fromCharCode(decodedChar);
        }
        return token;
    }

    static resolve(sessionID, callback) {
        let me = new TokenJS();
        me.requestToken(sessionID, (headerToken, challenge) => {
            let token1 = this.decodeBase64(headerToken);
            let token2 = this.solveChallenge(challenge);
            let resolvedToken = this.concatTokens(token1, token2);
            callback(resolvedToken);
        });
    }

    requestToken(sessionID, callback) {
        this.onResponse = callback;

        fetch(consts.ENDPOINT_URI + "/reserve/session/" + sessionID, {
            method: 'get',
            headers: new Headers({
                "user-agent": "kahoot.js",
                "host": "kahoot.it",
                "referer": "https://kahoot.it/",
                "accept-language": "en-US,en;q=0.8",
                "accept": "*/*"
            })
        })
            .then((response) => {
                // The first token is the session token, which is given as a header by the server encoded in base64
                // Checking if the header is defined before continuing, basically checking if the room exists.
                if (!response.headers || !response.headers.map || !response.headers.map['x-kahoot-session-token']) {
                    return console.log("request error:", "Kahoot session header is undefined. (This normally means that the room no longer exists.)")
                }

                let token1 = response.headers.map['x-kahoot-session-token'];
                response.json().then((responseJson) => {
                    // The second token is given as a "challenge", which must be eval'd by the client to be decoded
                    let challenge = responseJson.challenge;
                    this.onResponse(token1, challenge);

                    console.log("Response json: " + response);
                });

                console.log("Response object: " + response);
            })
            .catch((error) => {
                console.error(error);
            });
    }
}

module.exports = TokenJS;
