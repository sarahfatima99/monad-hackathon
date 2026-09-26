import Database from "better-sqlite3";
import { config } from "./config.js";

export const db = new Database(config.databasePath);
try {
  db.pragma("journal_mode = WAL");
} catch {
  // Some filesystems (e.g. network/bridge mounts) don't support WAL's shared-memory
  // file; fall back to the default rollback journal, which works everywhere.
}

db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verification_code TEXT,
  verification_expires_at INTEGER,
  nickname TEXT UNIQUE,
  wallet_address TEXT UNIQUE,
  wallet_nonce TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  onchain_game_id INTEGER,
  name TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | finished | cancelled
  finalized INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game_rounds (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  round_index INTEGER NOT NULL, -- 0-based, up to 5
  photo_url TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options_json TEXT NOT NULL, -- JSON array of option strings
  correct_option_index INTEGER NOT NULL,
  UNIQUE(game_id, round_index)
);

CREATE TABLE IF NOT EXISTS game_participants (
  game_id TEXT NOT NULL REFERENCES games(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  wallet_address TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  score INTEGER,
  reward_amount_wei TEXT,
  PRIMARY KEY (game_id, account_id)
);

CREATE TABLE IF NOT EXISTS game_answers (
  game_id TEXT NOT NULL REFERENCES games(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  round_index INTEGER NOT NULL,
  selected_option_index INTEGER NOT NULL,
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (game_id, account_id, round_index)
);
`);
