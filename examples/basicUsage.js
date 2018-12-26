import Kahoot from "../src/kahoot";
import gameConsts from "../src/gameConsts";

let client = new Kahoot();
console.log("Joining kahoot...");

client.join(11223344 /* Or any other kahoot token */, "kahoot.js")
    .then(() => {
        console.log("joined quiz");

        client.on(gameConsts.JOINED, () => {
            console.log("I joined the Kahoot!");
        });
        client.on(gameConsts.QUIZ_START, quiz => {
            console.log("The quiz has started! The quiz's name is:", quiz.name);
        });
        client.on(gameConsts.QUESTION_START, question => {
            console.log("A new question has started, answering the first answer.");
            question.answer(0);
        });
        client.on(gameConsts.QUIZ_END, () => {
            console.log("The quiz has ended.");
        });
    })
    .catch(error => {
        console.error(error);
    });