import Kahoot from "../src/kahoot";
import gameConsts from "../src/gameConsts";

let client = new Kahoot();
console.log("Joining kahoot...");

client.join(11223344 /* Or any other kahoot token */, "kahoot.js")
    .then(() => {
	console.log("Joined the kahoot. Waiting for it to start.");
        client.on(gameConsts.QUIZ, quiz => {
		console.log("The quiz has started!");
		console.log("Quiz name:", quiz.name);
		console.log("Quiz type:", quiz.type);
		// Leave the Kahoot after the info has been printed
            client.leave();
	});
})
    .catch(error => {
        console.error(error);
});
