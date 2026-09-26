import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db.js";

export const adminRouter = Router();

const ADMIN_KEY = process.env.ADMIN_KEY ?? "dev-admin-key";

function requireAdmin(req: any, res: any, next: any) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

const roundSchema = z.object({
  photoUrl: z.string().url(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correctOptionIndex: z.number().int().min(0)
});

const createGameSchema = z.object({
  name: z.string(),
  startTime: z.number().int(), // unix seconds
  onchainGameId: z.number().int().optional(),
  rounds: z.array(roundSchema).min(1).max(5)
});

// Creates the off-chain game record + its photo/question content.
// The organizer separately calls createGame() on-chain to fund the pool and
// passes back the resulting onchainGameId here (or via PATCH).
adminRouter.post("/games", requireAdmin, (req, res) => {
  const body = createGameSchema.parse(req.body);
  const gameId = nanoid();

  db.prepare(
    "INSERT INTO games (id, onchain_game_id, name, start_time, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(gameId, body.onchainGameId ?? null, body.name, body.startTime, Date.now());

  const insertRound = db.prepare(
    `INSERT INTO game_rounds (id, game_id, round_index, photo_url, question_text, options_json, correct_option_index)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  body.rounds.forEach((r, i) => {
    insertRound.run(nanoid(), gameId, i, r.photoUrl, r.question, JSON.stringify(r.options), r.correctOptionIndex);
  });

  res.json({ id: gameId });
});

adminRouter.patch("/games/:gameId/onchain-id", requireAdmin, (req, res) => {
  const { onchainGameId } = z.object({ onchainGameId: z.number().int() }).parse(req.body);
  db.prepare("UPDATE games SET onchain_game_id = ? WHERE id = ?").run(onchainGameId, req.params.gameId);
  res.json({ ok: true });
});
