import { db } from "../db.js";

export function computeScore(gameId: string, accountId: string): number {
  const rounds = db
    .prepare("SELECT round_index, correct_option_index FROM game_rounds WHERE game_id = ?")
    .all(gameId) as { round_index: number; correct_option_index: number }[];

  const answers = db
    .prepare("SELECT round_index, selected_option_index FROM game_answers WHERE game_id = ? AND account_id = ?")
    .all(gameId, accountId) as { round_index: number; selected_option_index: number }[];

  const answerMap = new Map(answers.map((a) => [a.round_index, a.selected_option_index]));

  let score = 0;
  for (const r of rounds) {
    if (answerMap.get(r.round_index) === r.correct_option_index) score += 1;
  }
  return score;
}

export interface LeaderboardEntry {
  accountId: string;
  nickname: string;
  score: number;
  rank: number;
}

export function buildLeaderboard(gameId: string): LeaderboardEntry[] {
  const participants = db
    .prepare(
      `SELECT gp.account_id as accountId, a.nickname as nickname, gp.score as score
       FROM game_participants gp JOIN accounts a ON a.id = gp.account_id
       WHERE gp.game_id = ? ORDER BY gp.score DESC`
    )
    .all(gameId) as { accountId: string; nickname: string; score: number }[];

  let rank = 0;
  let lastScore: number | null = null;
  let seen = 0;

  return participants.map((p) => {
    seen += 1;
    if (p.score !== lastScore) {
      rank = seen;
      lastScore = p.score;
    }
    return { ...p, rank };
  });
}
