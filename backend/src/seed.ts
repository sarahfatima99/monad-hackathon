// Quick local demo seed: creates one game starting 2 minutes from now with 3 rounds.
// Run with: npm run seed
import { nanoid } from "nanoid";
import { db } from "./db.js";

const gameId = nanoid();
const startTime = Math.floor(Date.now() / 1000) + 120;

db.prepare(
  "INSERT INTO games (id, onchain_game_id, name, start_time, created_at) VALUES (?, NULL, ?, ?, ?)"
).run(gameId, "Memory Challenge #1 (demo)", startTime, Date.now());

const rounds = [
  {
    photoUrl: "https://picsum.photos/seed/monad1/600/400",
    question: "What color was the dominant object in the photo?",
    options: ["Red", "Blue", "Green", "Yellow"],
    correctOptionIndex: 1
  },
  {
    photoUrl: "https://picsum.photos/seed/monad2/600/400",
    question: "How many people appeared in the photo?",
    options: ["0", "1", "2", "3+"],
    correctOptionIndex: 2
  },
  {
    photoUrl: "https://picsum.photos/seed/monad3/600/400",
    question: "Was the scene indoors or outdoors?",
    options: ["Indoors", "Outdoors"],
    correctOptionIndex: 0
  }
];

const insertRound = db.prepare(
  `INSERT INTO game_rounds (id, game_id, round_index, photo_url, question_text, options_json, correct_option_index)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
rounds.forEach((r, i) => {
  insertRound.run(nanoid(), gameId, i, r.photoUrl, r.question, JSON.stringify(r.options), r.correctOptionIndex);
});

console.log(`Seeded game ${gameId}, starting at ${new Date(startTime * 1000).toISOString()}`);
