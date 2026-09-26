# backend

Express + Socket.IO API that handles everything the smart contract can't: email verification, nickname/account linking, the synchronized reveal timer, grading answers, and computing the final reward split it publishes to `MemoryGame.sol`.

## Setup

```bash
npm install
cp .env.example .env   # fill in JWT secret, RPC url, contract address, operator key, RESEND_API_KEY
npm run dev            # starts on http://localhost:4000
npm run seed           # optional: creates a demo game starting in 2 minutes
```

SQLite database file (`data.sqlite`) is created automatically on first run.

> **Note:** `better-sqlite3` needs real POSIX file locking. If you run this from a folder that's synced/mounted over a network (a cloud-drive folder, or this project opened through a remote bridge), you may see `SQLITE_IOERR_DELETE`. Run it from a normal local folder, or point `DATABASE_PATH` at one, if that happens.

## API summary

- `POST /auth/register` — email → sends a 6-digit verification code.
- `POST /auth/verify` — code → session JWT.
- `POST /auth/nickname` — set a unique nickname (auth required).
- `POST /auth/wallet/nonce` / `POST /auth/wallet/link` — SIWE-style wallet linking: sign a nonce, verify with `viem`.
- `GET /auth/me` — nickname, wallet address, live MON balance (read from chain), total rewards won.
- `GET /games` — list of games with schedule, pool, participant count (from chain when configured).
- `GET /games/:id` — single game + current phase.
- `POST /games/:id/join` — record that the player's `joinGame()` tx confirmed.
- `GET /games/:id/round` — the currently-revealed photo or question, computed server-side from `start_time` (never trusts the client's clock).
- `POST /games/:id/answer` — submit an answer for the round currently open.
- `GET /games/:id/leaderboard` — ranked nicknames + scores, ties share a rank.
- `GET /games/:id/claim-info` — reward amount + Merkle proof for `claimReward()` on the contract.
- `POST /admin/games` (header `x-admin-key`) — organizer tool to create a game's photos/questions off-chain.

Socket.IO: clients `join-game-room` with a game id and receive `phase` ticks (`waiting` → `photo` → `question` → repeat → `finished`) once per second, driven entirely by the server clock.

## Reward flow

1. When a game's last round ends, the scheduler grades every participant, finds everyone who scored 5/5, and splits the on-chain pool equally among them.
2. It builds a Merkle tree over `(wallet, amount)` and calls `finalizeGame(gameId, root)` on the contract using the operator key.
3. `GET /games/:id/claim-info` recomputes that same tree from the DB and returns the caller's proof, which the frontend passes to `claimReward()`.

This means the backend never moves funds itself — it only publishes *who gets how much*, and the contract enforces the payout.

## Deploying — a note if you're using Vercel

Vercel is a great fit for the **frontend** (it's a static Vite build). The **backend** is a poor fit for Vercel's serverless functions as-is, because it:
- keeps a live Socket.IO connection open per player (serverless functions are short-lived, request/response only)
- runs a `setInterval` game-clock scheduler that must keep ticking every second (nothing persists between serverless invocations)
- writes to a local SQLite file (serverless filesystems are ephemeral/read-only)

For a real deployment, run the backend somewhere that supports a long-lived Node process — Railway, Render, Fly.io, or a small VM all work with zero code changes. Point the frontend's `VITE_API_URL` at that backend's URL, deploy the frontend to Vercel as normal, and set `FRONTEND_ORIGIN` on the backend to the Vercel URL for CORS.

Email (Resend) works fine wherever the backend runs, including if you later split gameplay-grading into actual Vercel serverless functions — that's exactly the kind of stateless HTTP call Resend's API is built for.
