import type { Server as SocketIOServer } from "socket.io";
import { db } from "../db.js";
import { config } from "../config.js";
import { computeScore, buildLeaderboard } from "./scoring.js";
import { buildRewardsTree } from "./merkle.js";
import { finalizeOnchain, getOnchainGame } from "./chain.js";

const ROUND_SECONDS = config.photoSeconds + config.questionSeconds;

export type Phase =
  | { phase: "waiting"; secondsToStart: number }
  | { phase: "photo" | "question"; roundIndex: number; secondsRemaining: number }
  | { phase: "finished" };

export function getPhase(startTimeMs: number, nowMs: number): Phase {
  if (nowMs < startTimeMs) {
    return { phase: "waiting", secondsToStart: Math.ceil((startTimeMs - nowMs) / 1000) };
  }
  const elapsed = (nowMs - startTimeMs) / 1000;
  const totalRounds = config.maxRounds;
  if (elapsed >= totalRounds * ROUND_SECONDS) {
    return { phase: "finished" };
  }
  const roundIndex = Math.floor(elapsed / ROUND_SECONDS);
  const withinRound = elapsed - roundIndex * ROUND_SECONDS;
  if (withinRound < config.photoSeconds) {
    return { phase: "photo", roundIndex, secondsRemaining: Math.ceil(config.photoSeconds - withinRound) };
  }
  return {
    phase: "question",
    roundIndex,
    secondsRemaining: Math.ceil(ROUND_SECONDS - withinRound)
  };
}

/**
 * Starts the server-side clock: promotes games to 'live' at start_time, broadcasts
 * phase ticks over Socket.IO so a page refresh never restarts the game, and finalizes
 * a game (grades, builds the rewards Merkle tree, publishes it on-chain) once its
 * last round ends.
 */
export function startScheduler(io: SocketIOServer) {
  setInterval(async () => {
    const now = Date.now();

    const dueToStart = db
      .prepare("SELECT id FROM games WHERE status = 'scheduled' AND start_time * 1000 <= ?")
      .all(now) as { id: string }[];
    for (const { id } of dueToStart) {
      db.prepare("UPDATE games SET status = 'live' WHERE id = ?").run(id);
    }

    const liveGames = db.prepare("SELECT * FROM games WHERE status = 'live'").all() as any[];
    for (const game of liveGames) {
      const phase = getPhase(game.start_time * 1000, now);
      io.to(`game:${game.id}`).emit("phase", phase);

      if (phase.phase === "finished" && !game.finalized) {
        await finalizeGame(game).catch((err) => console.error(`finalize ${game.id} failed`, err));
      }
    }
  }, 1000);
}

async function finalizeGame(game: any) {
  const participants = db
    .prepare("SELECT account_id as accountId, wallet_address as walletAddress FROM game_participants WHERE game_id = ?")
    .all(game.id) as { accountId: string; walletAddress: string }[];

  for (const p of participants) {
    const score = computeScore(game.id, p.accountId);
    db.prepare("UPDATE game_participants SET score = ? WHERE game_id = ? AND account_id = ?").run(
      score,
      game.id,
      p.accountId
    );
  }

  const perfectScorers = participants.filter(
    (p) => computeScore(game.id, p.accountId) === config.maxRounds
  );

  let poolWei = 0n;
  try {
    if (config.contractAddress && game.onchain_game_id !== null) {
      const onchain = await getOnchainGame(BigInt(game.onchain_game_id));
      poolWei = onchain[1]; // pool
    }
  } catch (err) {
    console.warn(`Could not read on-chain pool for game ${game.id}:`, err);
  }

  const rewardPerWinner = perfectScorers.length > 0 ? poolWei / BigInt(perfectScorers.length) : 0n;

  const entries = perfectScorers.map((p) => ({
    wallet: p.walletAddress as `0x${string}`,
    amountWei: rewardPerWinner
  }));

  if (entries.length > 0) {
    const { root, proofFor } = buildRewardsTree(entries);
    for (const e of entries) {
      const p = perfectScorers.find((x) => x.walletAddress === e.wallet)!;
      db.prepare("UPDATE game_participants SET reward_amount_wei = ? WHERE game_id = ? AND account_id = ?").run(
        e.amountWei.toString(),
        game.id,
        p.accountId
      );
    }

    try {
      if (config.contractAddress && game.onchain_game_id !== null) {
        await finalizeOnchain(BigInt(game.onchain_game_id), root);
      }
    } catch (err) {
      console.error(`On-chain finalize failed for game ${game.id} (root ${root}):`, err);
    }

    // Proofs are recomputed on demand by the claim endpoint via proofFor(), not stored.
  }

  db.prepare("UPDATE games SET status = 'finished', finalized = 1 WHERE id = ?").run(game.id);
}
