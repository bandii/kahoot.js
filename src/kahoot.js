import EventEmitter from "events";
import Promise from "promise";
import Assets from "./assets.js";
import WSHandler from "./wsHandler.js";
import token from "./token";
import consts from "./tokenConsts";
import gameConsts from "./gameConsts";
import wsConsts from "./wsConsts";

global.Buffer = require('buffer').Buffer;

class Kahoot extends EventEmitter {
    constructor() {
        super();
        this._wsHandler = null;
        this._qFulfill = null;
        this.sendingAnswer = false;
        this.token = null;
        this.sessionID = null;
        this.name = null;
        this.quiz = null;
        this.nemesis = null;
        this.nemeses = [];
    }

    join(session, name) {
        if (!session || !name) {
            return new Promise((fulfill, reject) => {
                reject("Unable to start kahoot! Missing parameters!");
            });
        }

        return new Promise((fulfill, reject) => {
            if (!session) {
                reject("You need a sessionID to connect to a Kahoot!");
                return;
            }
            if (!name) {
                reject("You need a name to connect to a Kahoot!");
                return;
            }

            this.sessionID = session;
            this.name = name;

            token.resolve(session, (resolvedToken,
                                    responseCode,
                                    responseMessage) => {
                if (responseCode !== consts.INNER_RESPONSES.OK) {
                    //console.error(responseMessage);
                    reject("Error happened while connecting to the server!");
                    this.leave();
                    return;
                }
                if (!resolvedToken) {
                    //console.error(responseMessage);
                    reject("Could not get a valid token!");
                    this.leave();
                    return;
                }

                this.token = resolvedToken;

                this._wsHandler = new WSHandler(this.sessionID, this.token, this);
                this._wsHandler.on(gameConsts.READY, () => {
                    this._wsHandler.login(this.name);
                });
                this._wsHandler.on(gameConsts.JOINED, () => {
                    this.emit(gameConsts.READY);
                    this.emit(gameConsts.JOINED);
                    fulfill();
                });
                this._wsHandler.on(gameConsts.QUIZ_DATA, quizInfo => {
                    this.quiz = new Assets.Quiz(quizInfo.name, quizInfo.type, quizInfo.qCount, this);
                    this.emit(gameConsts.QUIZ_START, this.quiz);
                });
                this._wsHandler.on(gameConsts.QUIZ_UPDATE, updateInfo => {
                    this.quiz.currentQuestion = new Assets.Question(updateInfo, this);
                    this.emit(gameConsts.QUESTION, this.quiz.currentQuestion);
                });
                this._wsHandler.on(gameConsts.QUESTION_END, endInfo => {
                    this.emit(gameConsts.QUESTION_END, new Assets.QuestionEndEvent(endInfo, this));
                });
                this._wsHandler.on(gameConsts.QUIZ_END, () => {
                    this.emit(gameConsts.QUIZ_END);
                    this.emit(gameConsts.DISCONNECT);
                });
                this._wsHandler.on(gameConsts.QUESTION_START, () => {
                    this.emit(gameConsts.QUESTION_START, this.quiz.currentQuestion);
                });
                this._wsHandler.on(gameConsts.QUESTION_SUBMIT, message => {
                    this.sendingAnswer = false;
                    let e = new Assets.QuestionSubmitEvent(message, this);
                    this.emit(gameConsts.QUESTION_SUBMIT, e);
                    try {
                        this._qFulfill(e);
                    } catch (e) {
                        //console.error(e.message);
                        this.emit(gameConsts.ERROR, e.message);
                        this.leave();
                    }
                });
                this._wsHandler.on(gameConsts.FINISH_TEXT, data => {
                    this.emit(gameConsts.FINISH_TEXT, new Assets.FinishTextEvent(data));
                });
                this._wsHandler.on(gameConsts.FINISH, data => {
                    this.emit(gameConsts.FINISH, new Assets.QuizFinishEvent(data, this));
                });
                this._wsHandler.on(gameConsts.GAME_INFO, data => {
                    if (this.quiz) {
                        this.quiz.playerName = data.playerName;
                        this.quiz.type = data.quizType;
                    }
                    this.emit(gameConsts.GAME_INFO, this.quiz);
                });
                this._wsHandler.on(wsConsts.ERROR, errorMessage => {
                    // this.emit(gameConsts.ERROR, errorMessage);
                    // Every error should be handled in one place
                    reject(errorMessage);
                    this.leave();
                });
            });
        });
    }

    answerQuestion(id) {
        return new Promise((fulfill, reject) => {
            this._qFulfill = fulfill;
            this.sendingAnswer = true;
            this._wsHandler.sendSubmit(id);
        });
    }

    leave() {
        return new Promise((fulfill, reject) => {
            this._wsHandler.close();
            this._wsHandler = null;
            fulfill();
        });
    }
}

module.exports = Kahoot;
