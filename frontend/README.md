# frontend

React + Vite SPA with the app's 4 screens: Account, Games, Lobby/Play, Results.

## Setup

```bash
npm install
cp .env.example .env   # fill in VITE_API_URL, VITE_CONTRACT_ADDRESS, VITE_MONAD_RPC_URL
npm run dev
```

## Notes

- Wallet connection uses `wagmi` + `viem` (`src/lib/wagmi.ts`) targeting the Monad testnet chain (id `10143`, adjust if the network changes).
- Wallet **balance** and the on-chain **prize pool** are read straight from the chain via `wagmi`/`viem`, never from the backend, so a player can trust the numbers independently.
- Game timing (`src/pages/LobbyPage.tsx`) is driven by a Socket.IO `phase` event from the backend, not a client-side timer, so refreshing never restarts a game.
- `joinGame` and `claimReward` are sent directly from the browser wallet to `MemoryGame.sol`; the backend is only told about the join afterwards (`POST /games/:id/join`) so it can show accurate participant counts even before the chain event indexes.
