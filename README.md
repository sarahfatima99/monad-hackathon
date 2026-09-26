# Monad Memory Challenge

A scheduled, multiplayer memory-matching mini-game with on-chain prize pools on **Monad**. Players register with email + nickname, connect a wallet, join a scheduled game, watch 5 photos and answer 5 questions about them in sync with every other player, then split a MON prize pool if they score a perfect 5/5.

This repo is the first version described in `docs/plan.md`-style spec: simple enough to ship, but with the wallet/prize logic enforced by a smart contract rather than trusted to the backend.

## How it works

1. **Register** — email + verification link/code, unique nickname, then connect a wallet and sign a message to prove ownership. Email is never written on-chain.
2. **Browse games** — the Games screen lists scheduled "Memory Challenge" games with a live countdown, registered player count, and prize pool, pulled from the contract.
3. **Join** — clicking Join sends a wallet transaction (`joinGame`) that registers the wallet on-chain before the scheduled start. The button becomes "Enter lobby".
4. **Play** — at the scheduled time the backend releases photo 1 (5s), then question 1 (5s), and so on for up to 5 rounds. Timing is server-driven so a refresh never restarts the game, and everyone sees the same content with randomized answer order.
5. **Results** — a leaderboard ranks nicknames by score (ties share a rank). Anyone who scored 5/5 splits the funded pool equally. The backend computes/publishes the allocation, the contract enforces payout and blocks double-claims.

## 🟣 Built on Monad — where it's actually used

This is a Monad-hackathon project, so to be explicit: **Monad is the blockchain the whole money/ownership layer of the game runs on.** Here's exactly where it shows up:

1. **The smart contract lives there** (`contracts/MemoryGame.sol`). Deployed to Monad testnet, it's the only place that touches actual funds: it holds each game's prize pool, tracks who registered, and pays out claims. It's EVM-compatible, so it's ordinary Solidity — Monad's pitch is just doing that faster/cheaper than Ethereum mainnet.
2. **Joining a game = a Monad transaction.** When a player clicks "Join game," the frontend calls `joinGame(gameId)` directly on the contract via their wallet (MetaMask or similar, connected through wagmi/viem). That's a real on-chain transaction with a small gas fee, per the spec — even for free games.
3. **Reading balances directly from the chain.** The player's MON wallet balance and each game's prize pool are read live from Monad (via `viem`'s public client) rather than trusted from the backend — so a player can verify the numbers independently instead of taking the app's word for it.
4. **Finalizing and paying rewards.** After a game ends, the backend computes who scored 5/5, builds a Merkle tree of `(wallet, amount)`, and calls `finalizeGame()` on the contract using an operator wallet — this is a Monad transaction too. Winners then call `claimReward()` themselves (another transaction) with a Merkle proof, and the contract verifies and pays out in MON, blocking double-claims.

**Where Monad is *not* involved:** the backend (email verification, nicknames, revealing photos/questions on schedule, grading) is off-chain — a contract can't send emails or keep quiz answers secret, so that stays in the small Express/SQLite service, and it only ever tells the contract *who gets paid how much*, never moves funds itself.

**In short:** registration/join/claim are wallet-signed Monad transactions, and balances/pool amounts are read straight off Monad — everything else (content, timing, scoring) is regular backend logic that feeds the contract a final answer.

## Architecture

```
┌────────────┐        ┌──────────────────┐        ┌───────────────────────┐
│  Frontend  │──HTTP─▶│      Backend       │──tx──▶│   MemoryGame.sol      │
│ React/Vite │◀─WS────│  Express + SQLite  │◀─read─│   (Monad testnet)     │
└────────────┘        └──────────────────┘        └───────────────────────┘
     │  reads chain directly for balances/prize pool via viem  ──────────────┘
```

- **Smart contract is the source of truth for money**: game schedule, funded prize pool, wallet registration, and reward claims all live on-chain, so a player can verify payouts independently of the backend.
- **Backend is the source of truth for gameplay content**: it is the only place that knows the questions/answers before they're revealed, it verifies email addresses, links accounts to wallets, drives the synchronized reveal timer, grades answers, computes scores, and signs off on the final reward split that gets published to the contract.
- **Frontend** is a thin client: it never sees unrevealed questions before the server sends them, and it reads wallet balance / prize pool directly from the chain (via a public RPC) rather than trusting the backend for money numbers.

## Technology

| Layer | Choice | Why |
|---|---|---|
| Blockchain | **Monad testnet** (EVM-compatible) | Contract logic per the spec; cheap/fast for a hackathon-style game loop. |
| Smart contract | **Solidity 0.8.x + Hardhat** | Standard, well-tooled EVM stack; Hardhat gives local testing + testnet deploy scripts. |
| Contract library | **OpenZeppelin** (`Ownable`, `ReentrancyGuard`) | Battle-tested access-control and reentrancy protection for `claimReward`/`finalizeGame`. |
| Backend | **Node.js + TypeScript + Express** | Small, simple REST + WebSocket API; matches "small backend" scope in the spec. |
| Realtime sync | **Socket.IO** | Server-driven countdown/reveal ticks so refreshing never restarts the game. |
| Database | **SQLite via `better-sqlite3`** (swappable for Postgres) | Zero-ops for a first version; stores accounts, nicknames, game content, answers, scores. |
| Auth | **JWT session + SIWE-style wallet signature (`viem`/`ethers`)** | Email verified via signed link/code; wallet ownership proven by signing a nonce, never a private key. |
| Email | **Nodemailer** (SMTP, pluggable provider) | Sends verification links/codes. |
| Frontend | **React + TypeScript + Vite** | Fast dev loop, minimal 4-screen SPA per the spec. |
| Wallet connection | **wagmi + viem + RainbowKit/ConnectKit** | Standard React wallet-connect stack with first-class custom-chain (Monad) support. |
| Styling | **Tailwind CSS** | Quick, consistent styling for 4 simple screens. |

## Repository layout

```
contracts/   Hardhat project — MemoryGame.sol, deploy scripts, tests
backend/     Express API + Socket.IO server, SQLite models, game scheduler
frontend/    React SPA — Account, Games, Lobby/Play, Results screens
```

Each folder has its own README with setup details specific to that piece.

## Getting started

```bash
# 1. Contracts — deploy MemoryGame to Monad testnet
cd contracts && npm install && npx hardhat compile
cp .env.example .env   # fill in MONAD_TESTNET_RPC_URL + PRIVATE_KEY
npx hardhat run scripts/deploy.ts --network monadTestnet

# 2. Backend
cd ../backend && npm install
cp .env.example .env   # fill in RPC URL, contract address, SMTP creds, JWT secret
npm run dev

# 3. Frontend
cd ../frontend && npm install
cp .env.example .env   # fill in API URL + contract address
npm run dev
```

## Status

Version 1, built against **Monad testnet** with test MON, per the spec: registration, timing, and reward flows first — funded/mainnet games come after those are verified working end to end.

## Rules published before registration opens

- Registration closes at the scheduled start time; no late entry.
- Joining requires an on-chain transaction (network fee), even for free-entry games.
- The funded prize pool is split equally among every player who scores 5/5.
- If nobody scores 5/5, the pool is returned to the organizer after finalization.
