import EventEmitter from "events";
import consts from "./wsConsts.js";
import gameConsts from "./gameConsts";

class WsHandler extends EventEmitter {
    constructor(session, token, kahoot) {
        super();
        this.kahoot = kahoot;
        this.msgID = 0;
        this.clientID = "_none_";
        this.connected = false;
        this.gameID = session;
        this.name = "";
        this.firstQuizEvent = false;

        this._initWS(session, token);
    }

    _initWS(session, token) {
        this.ws = new WebSocket(consts.WSS_ENDPOINT + session + "/" + token);
        // Create anonymous callbacks to prevent an event emitter loop
        this.ws.onopen = () => {
            this._open();
        };
        this.ws.onmessage = msg => {
            this._message(msg);
        };
        this.ws.onclose = () => {
            this.connected = false;
            this.close();
        };
        this.ws.onerror = () => {
            this.emit(consts.ERROR, "Error happened while trying to connect to the server.");
            this.close();
        };
    }

    _getPacketWithoutTimeSync(packet) {
        this.msgID++;
        return [{
            channel: packet.channel,
            clientId: this.clientID,
            ext: {
                ack: packet.ext.ack,
            },
            id: this.msgID + ""
        }]
    }

    _getPacket(packet) {
        let ret = this._getPacketWithoutTimeSync(packet);

        if (packet.ext && packet.ext.timesync) {
            let l = ((new Date).getTime() - packet.ext.timesync.tc - packet.ext.timesync.p) / 2;
            let o = (packet.ext.timesync.ts - packet.ext.timesync.tc - l);

            ret[0].ext.timesync = {
                l: l,
                o: o,
                tc: (new Date).getTime()
            };
        }

        return ret;
    }

    _getSubmitPacket(questionChoice) {
        this.msgID++;
        return [{
            channel: consts.SERVICE_CONTROLLER,
            clientId: this.clientID,
            data: {
                content: JSON.stringify({
                    choice: questionChoice,
                    meta: {
                        lag: 30,
                        device: {
                            userAgent: consts.USER_AGENT,
                            screen: {
                                width: 1920,
                                height: 1050
                            }
                        }
                    }
                }),
                gameid: this.gameID,
                host: consts.ENDPOINT_URI,
                id: 6,
                type: "message"
            },
            id: this.msgID + ""
        }]
    }

    _send(msg) {
        if (this.connected) {
            try {
                this.ws.send(JSON.stringify(msg));
            } catch (e) {
                this.emit(consts.ERROR, e.message);
                this.close();
            }
        }
    }

    sendSubmit(questionChoice) {
        let packet = this._getSubmitPacket(questionChoice);
        if (packet) {
            this._send(packet);
        }
    }

    _open() {
        this.connected = true;
        let r = [{
            advice: {
                interval: 0,
                timeout: 60000
            },
            channel: consts.CHANNEL_HANDSHAKE,
            ext: {
                ack: true,
                timesync: {
                    l: 0,
                    o: 0,
                    tc: (new Date).getTime()
                },
                id: "1",
                minimumVersion: "1.0",
                supportedConnectionTypes: [
                    "websocket",
                    "long-polling"
                ],
                version: "1.0"
            }
        }];
        this.msgID++;
        this._send(r);
    }

    _message(msg) {
        let data = JSON.parse(msg.data)[0];
        if (data.channel === consts.CHANNEL_HANDSHAKE && data.clientId) { // The server sent a handshake packet
            this.clientID = data.clientId;
            let r = this._getPacket(data)[0];
            r.ext.ack = undefined;
            r.channel = consts.CHANNEL_SUBSCR;
            r.clientId = this.clientID;
            r.subscription = consts.SERVICE_CONTROLLER;
            this._send(r);
        } else if (data.channel === consts.CHANNEL_SUBSCR) {
            if (data.subscription === consts.SERVICE_CONTROLLER && data.successful == true) {
                let playerSubscribe = this._getPacket(data)[0];
                playerSubscribe.channel = consts.CHANNEL_SUBSCR;
                playerSubscribe.clientId = this.clientID;
                playerSubscribe.subscription = consts.SERVICE_PLAYER;
                this._send(playerSubscribe);
                let connectionPacket = this._getPacket(data)[0];
                connectionPacket.channel = consts.CHANNEL_CONN;
                connectionPacket.clientId = this.clientID;
                connectionPacket.connectionType = "websocket";
                connectionPacket.advice = {
                    timeout: 0
                };
                this._send(connectionPacket);
                let statusSubscribe = this._getPacket(data)[0];
                statusSubscribe.channel = consts.CHANNEL_SUBSCR;
                statusSubscribe.clientId = this.clientID;
                statusSubscribe.subscription = consts.SERVICE_STATUS;
                this._send(statusSubscribe);
                this.emit(gameConsts.READY);
            }
        } else if (data.data) {
            if (data.data.error) {
                this.emit(consts.ERROR, data.data.error);
                this.close();
                return;
            } else if (data.data.type === "loginResponse") {
                this.emit(gameConsts.JOINED);
            } else {
                if (data.data.content) {
                    this._handleData(data.data.id, data, JSON.parse(data.data.content));
                }
            }
        }
        if (data.ext && data.channel !== consts.CHANNEL_SUBSCR && data.channel !== consts.CHANNEL_HANDSHAKE) {
            let m = this._getPacket(data);
            this._send(m);
        }
    }

    _handleData(dataId, data, content) {
        console.log("kahoot dataId: " + dataId + "\r\ndata: " + JSON.stringify(content));

        switch (dataId) {
            case 1:
                if (!this.kahoot.quiz.currentQuestion) {
                    this.emit(gameConsts.QUIZ_UPDATE, {
                        questionIndex: content.questionIndex,
                        timeLeft: content.timeLeft,
                        type: content.gameBlockType,
                        useStoryBlocks: content.canAccessStoryBlocks,
                        ansMap: content.answerMap
                    });
                } else if (content.questionIndex > this.kahoot.quiz.currentQuestion.index) {
                    this.emit(gameConsts.QUIZ_UPDATE, {
                        questionIndex: content.questionIndex,
                        timeLeft: content.timeLeft,
                        type: content.gameBlockType,
                        useStoryBlocks: content.canAccessStoryBlocks,
                        ansMap: content.answerMap
                    });
                }

                break;
            case 2:
                this.emit(gameConsts.QUESTION_START);

                break;
            case 3:
                this.emit(gameConsts.FINISH, {
                    playerCount: content.playerCount,
                    quizID: content.quizID,
                    rank: content.rank,
                    correct: content.correctCount,
                    incorrect: content.incorrectCount
                });

                break;
            case 7:
                this.emit(gameConsts.QUESTION_SUBMIT, content.primaryMessage);

                break;
            case 8:
                this.emit(gameConsts.QUESTION_END, {
                    correctAnswers: content.correctAnswers,
                    correct: content.isCorrect,
                    points: content.points,
                    pointsData: content.pointsData,
                    rank: content.rank,
                    nemesis: content.nemesis,
                    hasNemesis: content.nemisisIsGhost,
                    text: content.text
                });

                break;
            case 9:
                if (!this.firstQuizEvent) {
                    this.firstQuizEvent = true;
                    this.emit(gameConsts.QUIZ_DATA, {
                        name: content.quizName,
                        type: content.quizType,
                        qCount: content.quizQuestionAnswers[0]
                    });
                }

                break;
            case 10:
                // The quiz has ended
                this.emit(gameConsts.QUIZ_END);
                try {
                    this.close();
                } catch (e) {
                    // Most likely already closed
                }

                break;
            case 13:
                this.emit(gameConsts.FINISH_TEXT, {
                    metal: content.podiumMedalType,
                    msg1: content.primaryMessage,
                    msg2: content.secondaryMessage
                });

                break;
            case 14:
                this.emit(gameConsts.GAME_INFO, content);

                break;
            default:
                break;
        }
    }

    login(name) {
        this.name = name;
        let joinPacket = [{
            channel: consts.SERVICE_CONTROLLER,
            clientId: this.clientID,
            data: {
                gameid: this.gameID,
                host: consts.ENDPOINT_URI,
                name: name,
                type: "login"
            },
            id: this.msgID + ""
        }];
        this.msgID++;
        this._send(joinPacket);
    }

    close() {
        this.connected = false;
        if (this.ws) {
            this.ws.onclose = () => {
            };
            this.ws.close();
            this.emit(gameConsts.CLOSE);
            this.ws = null;
        }
    }
}

module.exports = WsHandler;
