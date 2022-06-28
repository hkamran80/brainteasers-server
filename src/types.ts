export type QA = {
    id: string;
    category: string;
    question: string;
    answers: string[];
    correctAnswer: string;
};

export type TriviaAPIResponse = {
    category: string;
    id: string;
    correctAnswer: string;
    incorrectAnswers: string[];
    question: string;
    tags: string[];
    type: string;
    difficulty: string;
}[];
