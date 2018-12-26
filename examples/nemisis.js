import Kahoot from "../src/kahoot";
import gameConsts from "../src/gameConsts";

let client = new Kahoot();
console.log("Joining kahoot...");

client.join(11223344 /* Or any other kahoot token */, "kahoot.js")
    .then(() => {
        client.on(gameConsts.QUIZ_START, quiz => {
            console.log("the quiz started with name", quiz.name);
        });
        client.on(gameConsts.QUESTION_START, question => {
            console.log("A new question has started, answering the first answer.");
            question.answer(0);
        });
        client.on(gameConsts.QUESTION_END, event => {
            console.log("the question ended.");
            if (k.nemesis && k.nemesis.exists) {
                console.log("i have a nemesis with name", nemesis.name);
            } else {
                console.log("i dont have a nemesis.");
            }
        });
        client.on(gameConsts.QUIZ_END, () => {
            console.log("the quiz ended");
        });
    })
    .catch(error => {
        console.error(error);
});
