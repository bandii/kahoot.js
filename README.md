# About
**This fork is about to make the parent project work within ReactNative apps. This fork is a kind of a test project, so you can use it only on your own risk!**

Kahoot.js is a library to interact with the Kahoot API. Currently kahoot.js supports joining and interacting with quizzes.

# Basic Example
```js
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
```

## Documentation / How to use
See [Documentation.md](Documentation.md).

## Examples
See the `examples/`.
