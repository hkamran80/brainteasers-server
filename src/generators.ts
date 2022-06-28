const alphabet = "abcdefghijklmnopqrstuvwxyz";
const numbers = "0123456789";

const generateRandomLetter = () =>
    alphabet[Math.floor(Math.random() * alphabet.length)];
const generateRandomNumber = () =>
    numbers[Math.floor(Math.random() * numbers.length)];

export const generateGameId = () =>
    generateRandomLetter() +
    generateRandomLetter() +
    generateRandomLetter() +
    generateRandomNumber() +
    generateRandomLetter();
