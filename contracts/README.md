# contracts

Hardhat project for `MemoryGame.sol`, the on-chain piece of the Monad Memory Challenge.

## Setup

```bash
npm install
cp .env.example .env   # fill in MONAD_TESTNET_RPC_URL and PRIVATE_KEY
npx hardhat compile
npx hardhat test
```

## Deploy to Monad testnet

```bash
npm run deploy:monad
```

The deploy script prints the deployed address — put it in `backend/.env` (`CONTRACT_ADDRESS`) and `frontend/.env` (`VITE_CONTRACT_ADDRESS`).

## Design

- `createGame(startTime)` — operator-only, `payable`; funds the prize pool and creates a game entry.
- `joinGame(gameId)` — anyone can call before `startTime`; registers `msg.sender`, reverts on duplicate or late join. A game may optionally require an entry fee (0 by default), but joining always costs at least the network's gas fee.
- `finalizeGame(gameId, rewardsRoot)` — operator-only; publishes a Merkle root committing to the `(wallet, amount)` reward allocation computed off-chain by the backend after grading.
- `claimReward(gameId, amount, proof)` — anyone can call; verifies `msg.sender`+`amount` against the published Merkle root and pays out once per wallet per game.
- `cancelGame(gameId)` / `refund(gameId)` — operator can cancel an unstarted game; registered players (or the organizer, if nobody joined) can withdraw the pool pro-rata.
- `getGame(gameId)` — view returning schedule, pool, participant count, and status.

Funds move only through the contract; the backend can never move MON on its own — it only signs off on *who* gets *how much*, and the contract enforces the payout and blocks double-claims.
