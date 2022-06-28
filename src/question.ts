import fetch from "node-fetch";
import type { QA, TriviaAPIResponse } from "./types";

export const pickQA = async (categories: string[]): Promise<QA> => {
    const triviaQuestion = (await (
        await fetch(
            `https://the-trivia-api.com/api/questions?categories=${categories.join(
                ",",
            )}&limit=1`,
        )
    ).json()) as TriviaAPIResponse;

    const { category, question, correctAnswer, incorrectAnswers } =
        triviaQuestion[0];

    return {
        category,
        question,
        answers: shuffle([correctAnswer, ...incorrectAnswers]),
        correctAnswer,
    };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shuffle = (array: any[]) => {
    let currentIndex = array.length,
        randomIndex;

    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex],
            array[currentIndex],
        ];
    }

    return array;
};
