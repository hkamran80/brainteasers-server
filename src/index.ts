/* eslint-disable @typescript-eslint/no-non-null-assertion */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { generateGameId } from "./generators";
import { pickQA } from "./question";
import type { QA } from "./types";

const PORT = process.env.PORT || 3001;

const app = express();
const server = createServer(app);

// TODO: Change CORS to custom header
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "https://brainteasers.hkamran.com"],
    },
});

const games: {
    [gameRoomId: string]: {
        categories: string[];
        maxScore: number;
        autoAdvance: boolean;
        scores: { [socketId: string]: number };
        questionIds: string[];
        inGame: {
            current: QA;
            lockQuestion: boolean;
            playerAnswers: { [socketId: string]: string };
        } | null;
    };
} = {};

const usernames: { [socketId: string]: string } = {};

io.on("connection", (socket) => {
    console.debug("Client connected!");
    usernames[socket.id] = "Glizzard";

    socket.on("setUsername", (newUsername: string) => {
        usernames[socket.id] = newUsername;
    });

    socket.on(
        "createGame",
        (categories: string[], maxScore: number, autoAdvance: boolean) => {
            const gameRoomId = `game/${generateGameId()}`;

            games[gameRoomId] = {
                categories,
                maxScore,
                autoAdvance,
                scores: {},
                questionIds: [],
                inGame: null,
            };

            socket.emit("gameCreated", gameRoomId);
        },
    );

    socket.on("joinGame", (gameId: string) => {
        const gameRoomId = `game/${gameId}`;

        if (Object.keys(games).indexOf(gameRoomId) === -1) {
            console.debug("Game not found");
            socket.emit("gameError", "Game not found");
        } else {
            console.debug("Game found!");

            games[gameRoomId].scores[socket.id] = 0;
            socket.join(gameRoomId);

            const scoreObject = Object.fromEntries(
                Object.keys(games[gameRoomId].scores).map((socketId) => [
                    usernames[socketId],
                    0,
                ]),
            );

            io.in(gameRoomId).emit(
                "joinSuccessful",
                games[gameRoomId].categories,
                games[gameRoomId].maxScore,
                games[gameRoomId].autoAdvance,
                scoreObject,
            );
        }
    });

    socket.on("nextQuestion", async (gameId: string) => {
        const gameRoomId = `game/${gameId}`;

        if (Object.keys(games).indexOf(gameRoomId) !== -1) {
            let qa = await pickQA(games[gameRoomId].categories);
            while (games[gameRoomId].questionIds.indexOf(qa.id) !== -1) {
                qa = await pickQA(games[gameRoomId].categories);
            }

            games[gameRoomId].questionIds.push(qa.id);

            if (
                games[gameRoomId].inGame &&
                !games[gameRoomId].inGame!.lockQuestion
            ) {
                games[gameRoomId].inGame = {
                    current: qa,
                    lockQuestion: true,
                    playerAnswers: {},
                };

                io.in(gameRoomId).emit("question", {
                    category: qa.category,
                    question: qa.question,
                    answers: qa.answers,
                });
            } else if (games[gameRoomId].inGame === null) {
                games[gameRoomId].inGame = {
                    current: qa,
                    lockQuestion: true,
                    playerAnswers: {},
                };

                io.in(gameRoomId).emit("question", {
                    category: qa.category,
                    question: qa.question,
                    answers: qa.answers,
                });
            }
        } else {
            console.debug("Game not found");
            socket.emit("gameError", "Game not found");
        }
    });

    socket.on("answer", (gameId: string, answer: string) => {
        const gameRoomId = `game/${gameId}`;

        if (games[gameRoomId].inGame !== null) {
            games[gameRoomId].inGame!.playerAnswers[socket.id] = answer;

            if (
                Object.keys(games[gameRoomId].scores).length ===
                Object.keys(games[gameRoomId].inGame!.playerAnswers).length
            ) {
                const playerScoreUpdates: { [socketId: string]: number } = {};

                Object.entries(games[gameRoomId].inGame!.playerAnswers).map(
                    ([socketId, answer]) => {
                        if (
                            answer ===
                            (games[gameRoomId].inGame?.current
                                .correctAnswer as string)
                        ) {
                            playerScoreUpdates[socketId] = 100;
                            games[gameRoomId].scores[socketId] += 100;
                        } else {
                            playerScoreUpdates[socketId] = 0;
                        }

                        if (games[gameRoomId].maxScore !== 0) {
                            const maxScorers = Object.entries(
                                games[gameRoomId].scores,
                            ).filter(
                                ([, score]) =>
                                    score >= games[gameRoomId].maxScore,
                            );

                            if (maxScorers.length > 0) {
                                io.in(gameRoomId).emit(
                                    "gameOver",
                                    Object.entries(
                                        games[gameRoomId].scores,
                                    ).map(([socketId, score]) => {
                                        return {
                                            name: usernames[socketId],
                                            score,
                                        };
                                    }),
                                    maxScorers.map(([socketId, score]) => {
                                        return {
                                            name: usernames[socketId],
                                            score,
                                        };
                                    }),
                                );

                                delete games[gameRoomId];
                            } else {
                                io.in(gameRoomId).emit(
                                    "results",
                                    games[gameRoomId].inGame!.current.question,
                                    games[gameRoomId].inGame!.current
                                        .correctAnswer,
                                    Object.entries(
                                        games[gameRoomId].scores,
                                    ).map(([socketId, score]) => {
                                        return {
                                            name: usernames[socketId],
                                            score,
                                            difference:
                                                playerScoreUpdates[socketId],
                                        };
                                    }),
                                );

                                games[gameRoomId].inGame!.lockQuestion = false;
                            }
                        } else {
                            io.in(gameRoomId).emit(
                                "results",
                                games[gameRoomId].inGame!.current.question,
                                games[gameRoomId].inGame!.current.correctAnswer,
                                Object.entries(games[gameRoomId].scores).map(
                                    ([socketId, score]) => {
                                        return {
                                            name: usernames[socketId],
                                            score,
                                            difference:
                                                playerScoreUpdates[socketId],
                                        };
                                    },
                                ),
                            );

                            games[gameRoomId].inGame!.lockQuestion = false;
                        }
                    },
                );
            }
        }
    });

    socket.on("endGame", (gameId: string) => {
        const gameRoomId = `game/${gameId}`;

        io.in(gameRoomId).emit(
            "gameOver",
            Object.entries(games[gameRoomId].scores).map(
                ([socketId, score]) => {
                    return {
                        name: usernames[socketId],
                        score,
                    };
                },
            ),
            [],
        );

        delete games[gameRoomId];
    });

    socket.on("disconnect", (reason) => {
        const reasons = [
            "server namespace disconnect",
            "client namespace disconnect",
            "server shutting down",
        ];

        if (reasons.indexOf(reason) !== -1) {
            delete usernames[socket.id];

            Object.entries(games)
                .filter(
                    ([, { scores }]) =>
                        Object.keys(scores).indexOf(socket.id) !== -1,
                )
                .forEach(([gameId]) => delete games[gameId].scores[socket.id]);

            Object.entries(games).forEach(([gameId, { scores }]) => {
                if (Object.keys(scores).length === 0) {
                    delete games[gameId];
                }
            });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Running at 0.0.0.0:${PORT}`);
});
