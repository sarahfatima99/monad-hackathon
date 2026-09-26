#!/usr/bin/env bash
# One-shot local dev runner: starts a local chain, deploys the contract,
# creates a funded demo game, starts the backend, then starts the frontend
# in the foreground. Run this in ONE terminal and leave it open; Ctrl+C
# stops everything cleanly.
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

# Hardhat's well-known local test account #0 (safe for local testing only).
DEPLOYER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

cleanup() {
  echo ""
  echo ">>> Stopping background processes..."
  kill "$HARDHAT_PID" "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo ">>> Freeing ports 8545/4000/5173 if anything stale is holding them"
lsof -ti :8545 | xargs kill 2>/dev/null || true
lsof -ti :4000 | xargs kill 2>/dev/null || true
lsof -ti :5173 | xargs kill 2>/dev/null || true
sleep 1

echo ">>> [1/5] Starting local Hardhat node"
cd "$ROOT/contracts"
if [ ! -d node_modules ]; then npm install; fi
nohup npx hardhat node > "$ROOT/hardhat.log" 2>&1 &
HARDHAT_PID=$!
for i in $(seq 1 30); do
  curl -s -X POST http://127.0.0.1:8545 -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | grep -q result && break
  sleep 1
done
echo "    node ready (pid $HARDHAT_PID, log: hardhat.log)"

echo ">>> [2/5] Compiling + deploying MemoryGame"
node scripts/compile-solcjs.cjs
DEPLOY_OUT=$(DEPLOYER_PK=$DEPLOYER_PK node scripts/deploy-solcjs.cjs)
echo "$DEPLOY_OUT"
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUT" | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)
echo "    CONTRACT_ADDRESS=$CONTRACT_ADDRESS"

echo ">>> [3/5] Starting backend"
cd "$ROOT/backend"
if [ ! -d node_modules ]; then npm install; fi
cat > .env <<ENVEOF
PORT=4000
JWT_SECRET=local-dev-secret
DATABASE_PATH=$ROOT/backend/data.sqlite
CHAIN_ID=31337
MONAD_TESTNET_RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=$CONTRACT_ADDRESS
OPERATOR_PRIVATE_KEY=$DEPLOYER_PK
ADMIN_KEY=dev-admin-key
FRONTEND_ORIGIN=http://localhost:5173
DEV_CODE_FILE=$ROOT/backend/dev-codes.log
ENVEOF
nohup npx tsx src/index.ts > "$ROOT/backend.log" 2>&1 &
BACKEND_PID=$!
for i in $(seq 1 30); do
  curl -s http://localhost:4000/health | grep -q ok && break
  sleep 1
done
echo "    backend ready (pid $BACKEND_PID, log: backend.log)"

echo ">>> [4/5] Creating a funded demo game (starts in 45s)"
CONTRACT_ADDRESS=$CONTRACT_ADDRESS DEPLOYER_PK=$DEPLOYER_PK START_IN_SECONDS=45 \
  npx tsx src/scripts/create-game.ts

echo ">>> [5/5] Starting frontend (foreground — leave this running)"
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then npm install; fi
cat > .env <<ENVEOF
VITE_API_URL=http://localhost:4000
VITE_CHAIN_ID=31337
VITE_MONAD_RPC_URL=http://127.0.0.1:8545
VITE_CONTRACT_ADDRESS=$CONTRACT_ADDRESS
ENVEOF

cat <<MSG

============================================================
Everything is up. MetaMask setup:
  Network:  RPC http://127.0.0.1:8545, chain ID 31337, currency ETH
  Import a test account (NOT the operator key above), e.g.:
    0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
    (address 0x70997970C51812dc3A010C7d01b50e0d17dc79C8, 10000 ETH)

Once the frontend URL below is up, open it, go to /account to register,
then /games to join the demo game (starts ~45s after this script ran).
============================================================

MSG
npm run dev
