import EventEmitter from "events";
import consts from "./wsConsts.js";
import gameConsts from "./gameConsts";

class WSHandler extends EventEmitter {
    constructor(session, token, kahoot) {
        super();
        this.kahoot = kahoot;
        this.msgID = 0;
        this.clientID = "_none_";
        this.connected = false;
        this.gameID = session;
        this.name = "";
        this.firstQuizEvent = false;

        this.ws = new WebSocket(consts.WSS_ENDPOINT + session + "/" + token);
        // Create anonymous callbacks to prevent an event emitter loop
        this.ws.onopen = () => {
            this.open();
        };
        this.ws.onmessage = msg => {
            this.message(msg);
        };
        this.ws.onclose = () => {
            this.connected = false;
            this.close();
        };
        this.ws.onerror = () => {
            this.emit(gameConsts.ERROR, data.data.error);
        };
        this.dataHandler = {
            1: (data, content) => {
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
            },
            2: (data, content) => {
                this.emit(gameConsts.QUESTION_START);
            },
            3: (data, content) => {
                this.emit(gameConsts.FINISH, {
                    playerCount: content.playerCount,
                    quizID: content.quizID,
                    rank: content.rank,
                    correct: content.correctCount,
                    incorrect: content.incorrectCount
                });
            },
            7: (data, content) => {
                this.emit(gameConsts.QUESTION_SUBMIT, content.primaryMessage);
            },
            8: (data, content) => {
                // console.log(data);
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
            },
            9: (data, content) => {
                if (!this.firstQuizEvent) {
                    this.firstQuizEvent = true;
                    this.emit(gameConsts.QUIZ_DATA, {
                        name: content.quizName,
                        type: content.quizType,
                        qCount: content.quizQuestionAnswers[0]
                    });
                }
            },
            10: (data, content) => {
                // The quiz has ended
                this.emit(gameConsts.QUIZ_END);
                try {
                    this.ws.close();
                } catch (e) {
                    // Most likely already closed
                }
            },
            13: (data, content) => {
                this.emit(gameConsts.FINISH_TEXT, {
                    metal: content.podiumMedalType,
                    msg1: content.primaryMessage,
                    msg2: content.secondaryMessage
                });
            }
        }
    }

    getPacket(packet) {
        var l = ((new Date).getTime() - packet.ext.timesync.tc - packet.ext.timesync.p) / 2;
        var o = (packet.ext.timesync.ts - packet.ext.timesync.tc - l);
        this.msgID++;
        return [{
            channel: packet.channel,
            clientId: this.clientID,
            ext: {
                ack: packet.ext.ack,
                timesync: {
                    l: l,
                    o: o,
                    tc: (new Date).getTime()
                }
            },
            id: this.msgID + ""
        }]
    }

    getSubmitPacket(questionChoice) {
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

    send(msg) {
        if (this.connected) {
            try {
                this.ws.send(JSON.stringify(msg));
            } catch (e) {
            }
        }
    }

    sendSubmit(questionChoice) {
        var packet = this.getSubmitPacket(questionChoice);
        this.send(packet);
    }

    open() {
        this.connected = true;
        this.emit("open");
        var r = [{
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
        this.send(r);
    }

    message(msg) {
        var data = JSON.parse(msg.data)[0];
        if (data.channel === consts.CHANNEL_HANDSHAKE && data.clientId) { // The server sent a handshake packet
            this.clientID = data.clientId;
            var r = this.getPacket(data)[0];
            r.ext.ack = undefined;
            r.channel = consts.CHANNEL_SUBSCR;
            r.clientId = this.clientID;
            r.subscription = consts.SERVICE_CONTROLLER;
            this.send(r);
        } else if (data.channel === consts.CHANNEL_SUBSCR) {
            if (data.subscription === consts.SERVICE_CONTROLLER && data.successful == true) {
                var playerSubscribe = this.getPacket(data)[0];
                playerSubscribe.channel = consts.CHANNEL_SUBSCR;
                playerSubscribe.clientId = this.clientID;
                playerSubscribe.subscription = consts.SERVICE_PLAYER;
                this.send(playerSubscribe);
                var connectionPacket = this.getPacket(data)[0];
                connectionPacket.channel = consts.CHANNEL_CONN;
                connectionPacket.clientId = this.clientID;
                connectionPacket.connectionType = "websocket";
                connectionPacket.advice = {
                    timeout: 0
                };
                this.send(connectionPacket);
                var statusSubscribe = this.getPacket(data)[0];
                statusSubscribe.channel = consts.CHANNEL_SUBSCR;
                statusSubscribe.clientId = this.clientID;
                statusSubscribe.subscription = consts.SERVICE_STATUS;
                this.send(statusSubscribe);
                this.emit(gameConsts.READY);
            }
        } else if (data.data) {
            if (data.data.error) {
                this.emit(gameConsts.ERROR, data.data.error);
                return;
            } else if (data.data.type === "loginResponse") {
                this.emit(gameConsts.JOINED);
            } else {
                if (data.data.content) {
                    var cont = JSON.parse(data.data.content);
                    if (this.dataHandler[data.data.id]) {
                        this.dataHandler[data.data.id](data, cont);
                    } else {
                        // console.log(data);
                    }
                }
            }
        }
        if (data.ext && data.channel !== consts.CHANNEL_SUBSCR && data.channel !== consts.CHANNEL_HANDSHAKE) {
            var m = this.getPacket(data);
            this.send(m);
        }
    }

    login(name) {
        this.name = name;
        var joinPacket = [{
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
        this.send(joinPacket);
    }

    close() {
        this.connected = false;
        this.ws.onclose = () => {
        };
        this.ws.close();
        this.emit(gameConsts.CLOSE);
    }
}

module.exports = WSHandler;
