import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { getOnchainGame } from "../services/chain.js";
import { getPhase } from "../services/scheduler.js";
import { config } from "../config.js";

export const gamesRouter = Router();

// List upcoming/live/finished games for the Games screen.
gamesRouter.get("/", async (_req, res) => {
  const games = db.prepare("SELECT * FROM games ORDER BY start_time ASC").all() as any[];

  const enriched = await Promise.all(
    games.map(async (g) => {
      let poolWei = "0";
      let participantCountOnchain = 0;
      if (config.contractAddress && g.onchain_game_id !== null) {
        try {
          const onchain = await getOnchainGame(BigInt(g.onchain_game_id));
          poolWei = onchain[1].toString();
          participantCountOnchain = onchain[3];
        } catch {
          // fall back to off-chain count below
        }
      }
      const offchainCount = (
        db.prepare("SELECT COUNT(*) as c FROM game_participants WHERE game_id = ?").get(g.id) as { c: number }
      ).c;

      return {
        id: g.id,
        name: g.name,
        startTime: g.start_time,
        status: g.status,
        poolWei,
        participantCount: participantCountOnchain || offchainCount
      };
    })
  );

  res.json({ games: enriched });
});

gamesRouter.get("/:gameId", requireAuth, (req: AuthedRequest, res) => {
  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(req.params.gameId) as any;
  if (!game) return res.status(404).json({ error: "Game not found" });

  const registered = db
    .prepare("SELECT 1 FROM game_participants WHERE game_id = ? AND account_id = ?")
    .get(game.id, req.accountId);

  res.json({
    id: game.id,
    name: game.name,
    startTime: game.start_time,
    status: game.status,
    joined: !!registered,
    phase: getPhase(game.start_time * 1000, Date.now())
  });
});

// Called after the player's joinGame() transaction confirms on-chain.
gamesRouter.post("/:gameId/join", requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({ txHash: z.string().optional() });
  schema.parse(req.body);

  const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.accountId) as any;
  if (!account?.email_verified) return res.status(403).json({ error: "Email not verified" });
  if (!account?.wallet_address) return res.status(403).json({ error: "Wallet not connected" });

  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(req.params.gameId) as any;
  if (!game) return res.status(404).json({ error: "Game not found" });
  if (Date.now() >= game.start_time * 1000) return res.status(400).json({ error: "Registration closed" });

  db.prepare(
    "INSERT OR IGNORE INTO game_participants (game_id, account_id, wallet_address, joined_at) VALUES (?, ?, ?, ?)"
  ).run(game.id, req.accountId, account.wallet_address, Date.now());

  res.json({ ok: true });
});

// Current round's photo or question, released only once the server-side clock reaches it.
gamesRouter.get("/:gameId/round", requireAuth, (req: AuthedRequest, res) => {
  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(req.params.gameId) as any;
  if (!game) return res.status(404).json({ error: "Game not found" });

  const joined = db
    .prepare("SELECT 1 FROM game_participants WHERE game_id = ? AND account_id = ?")
    .get(game.id, req.accountId);
  if (!joined) return res.status(403).json({ error: "Not registered for this game" });

  const phase = getPhase(game.start_time * 1000, Date.now());
  if (phase.phase === "waiting" || phase.phase === "finished") {
    return res.json({ phase });
  }

  const round = db
    .prepare("SELECT * FROM game_rounds WHERE game_id = ? AND round_index = ?")
    .get(game.id, phase.roundIndex) as any;
  if (!round) return res.status(404).json({ error: "Round content missing" });

  if (phase.phase === "photo") {
    return res.json({ phase, photoUrl: round.photo_url });
  }

  // question phase: never send correct_option_index to the client
  return res.json({
    phase,
    question: round.question_text,
    options: JSON.parse(round.options_json)
  });
});

gamesRouter.post("/:gameId/answer", requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({ roundIndex: z.number().int().min(0), selectedOptionIndex: z.number().int().min(0) });
  const { roundIndex, selectedOptionIndex } = schema.parse(req.body);

  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(req.params.gameId) as any;
  if (!game) return res.status(404).json({ error: "Game not found" });

  const phase = getPhase(game.start_time * 1000, Date.now());
  if (phase.phase !== "question" || phase.roundIndex !== roundIndex) {
    return res.status(400).json({ error: "Not accepting answers for that round right now" });
  }

  db.prepare(
    `INSERT INTO game_answers (game_id, account_id, round_index, selected_option_index, answered_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(game_id, account_id, round_index) DO UPDATE SET selected_option_index = excluded.selected_option_index`
  ).run(game.id, req.accountId, roundIndex, selectedOptionIndex, Date.now());

  res.json({ ok: true });
});

gamesRouter.get("/:gameId/leaderboard", async (req, res) => {
  const { buildLeaderboard } = await import("../services/scoring.js");
  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(req.params.gameId) as any;
  if (!game) return res.status(404).json({ error: "Game not found" });

  const leaderboard = buildLeaderboard(game.id);
  res.json({ status: game.status, leaderboard });
});

// Reward + Merkle proof a finished participant needs to call claimReward() on-chain.
gamesRouter.get("/:gameId/claim-info", requireAuth, async (req: AuthedRequest, res) => {
  const { buildRewardsTree } = await import("../services/merkle.js");
  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(req.params.gameId) as any;
  if (!game || !game.finalized) return res.status(400).json({ error: "Game not finalized" });

  const winners = db
    .prepare(
      "SELECT account_id as accountId, wallet_address as walletAddress, reward_amount_wei as rewardWei FROM game_participants WHERE game_id = ? AND reward_amount_wei IS NOT NULL"
    )
    .all(game.id) as { accountId: string; walletAddress: string; rewardWei: string }[];

  const me = winners.find((w) => w.accountId === req.accountId);
  if (!me) return res.json({ eligible: false });

  const entries = winners.map((w) => ({ wallet: w.walletAddress as `0x${string}`, amountWei: BigInt(w.rewardWei) }));
  const { proofFor } = buildRewardsTree(entries);
  const proof = proofFor({ wallet: me.walletAddress as `0x${string}`, amountWei: BigInt(me.rewardWei) });

  res.json({
    eligible: true,
    onchainGameId: game.onchain_game_id,
    amountWei: me.rewardWei,
    proof
  });
});
