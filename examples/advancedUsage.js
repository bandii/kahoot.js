import Kahoot from "../src/kahoot";
import gameConsts from "../src/gameConsts";

let client = new Kahoot();
console.log("Joining kahoot...");

client.join(11223344 /* Or any other kahoot token */, "kahoot.js")
    .then(() => {
        console.log("joined quiz");

        client.on(gameConsts.QUIZ_START, quiz => {
        console.log("quiz " + quiz.name);
    });
        client.on(gameConsts.QUESTION, question => {
            console.log("Recieved a new question. waiting until it starts..");
        });
        client.on(gameConsts.QUESTION_START, question => {
            console.log("question started. answering answer id 1 (answer 2)");
            question.answer(1);
        });
        client.on(gameConsts.QUESTION_SUBMIT, event => {
            console.log("Submitted the answer. Kahoot says", event.message);
        });
        client.on(gameConsts.QUESTION_END, e => {
            console.log("the question ended.");
            if (e.correct) {
                console.log("i got the question right!");
            } else {
                console.log("my answer was incorrect. the correct answer is", e.correctAnswer);
            }
        });
        client.on(gameConsts.FINISH_TEXT, e => {
            console.log("the quiz is finishing, Kahoot says", e.firstMessage);
        });
        client.on(gameConsts.QUIZ_END, () => {
            console.log("the quiz ended");
        });
    })
    .catch(error => {
        console.error(error);
});
