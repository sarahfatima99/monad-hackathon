// Convenience script for local/manual testing: funds a game on-chain and
// registers its off-chain content (photos/questions) in one step, so it
// shows up immediately on the Games screen, ready to join and play.
//
// Usage (from backend/):
//   CONTRACT_ADDRESS=0x... DEPLOYER_PK=0x... npx tsx src/scripts/create-game.ts
//
// Optional env vars: API_URL (default http://localhost:4000), RPC_URL
// (default http://127.0.0.1:8545), CHAIN_ID (default 31337), ADMIN_KEY
// (default dev-admin-key), START_IN_SECONDS (default 30), POOL_ETH (default 10),
// GAME_NAME (default "Memory Challenge #1").
import { createPublicClient, createWalletClient, http, defineChain, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;
const DEPLOYER_PK = process.env.DEPLOYER_PK as `0x${string}`;
const ADMIN_KEY = process.env.ADMIN_KEY ?? "dev-admin-key";
const START_IN_SECONDS = Number(process.env.START_IN_SECONDS ?? 30);
const POOL_ETH = process.env.POOL_ETH ?? "10";
const GAME_NAME = process.env.GAME_NAME ?? "Memory Challenge #1";

if (!CONTRACT_ADDRESS) throw new Error("Set CONTRACT_ADDRESS");
if (!DEPLOYER_PK) throw new Error("Set DEPLOYER_PK (the account that deployed/operates the contract)");

const chain = defineChain({
  id: Number(process.env.CHAIN_ID ?? 31337),
  name: "local",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } }
});

const abi = [
  {
    type: "function", name: "createGame", stateMutability: "payable",
    inputs: [{ name: "startTime", type: "uint64" }, { name: "entryFee", type: "uint128" }],
    outputs: [{ name: "gameId", type: "uint256" }]
  },
  {
    type: "function", name: "nextGameId", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }]
  }
] as const;

async function main() {
  const account = privateKeyToAccount(DEPLOYER_PK);
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

  const startTime = Math.floor(Date.now() / 1000) + START_IN_SECONDS;

  // The contract assigns ids sequentially from nextGameId, so read it before
  // sending the tx to know which id this game will get.
  const onchainGameId = await publicClient.readContract({
    address: CONTRACT_ADDRESS, abi, functionName: "nextGameId"
  });

  console.log(`Funding game #${onchainGameId} with ${POOL_ETH} ETH, starting in ${START_IN_SECONDS}s...`);
  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS, abi, functionName: "createGame",
    args: [BigInt(startTime), 0n], value: parseEther(POOL_ETH)
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`On-chain game created (tx ${hash})`);

  // Real 5-photo / 5-question content, matching the spec's default timing.
  const rounds = [
    { photoUrl: "https://picsum.photos/seed/mg1/600/400", question: "What color stood out most in the photo?", options: ["Red", "Blue", "Green", "Yellow"], correctOptionIndex: 1 },
    { photoUrl: "https://picsum.photos/seed/mg2/600/400", question: "How many people were in the photo?", options: ["0", "1", "2", "3+"], correctOptionIndex: 0 },
    { photoUrl: "https://picsum.photos/seed/mg3/600/400", question: "Was the scene indoors or outdoors?", options: ["Indoors", "Outdoors"], correctOptionIndex: 1 },
    { photoUrl: "https://picsum.photos/seed/mg4/600/400", question: "Was there any water visible?", options: ["Yes", "No"], correctOptionIndex: 0 },
    { photoUrl: "https://picsum.photos/seed/mg5/600/400", question: "What time of day did it look like?", options: ["Day", "Night"], correctOptionIndex: 0 }
  ];

  const res = await fetch(`${API_URL}/admin/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
    body: JSON.stringify({ name: GAME_NAME, startTime, onchainGameId: Number(onchainGameId), rounds })
  });
  if (!res.ok) throw new Error(`admin/games failed: ${res.status} ${await res.text()}`);
  const { id } = await res.json();

  console.log(`\n✅ Game created: "${GAME_NAME}" (id ${id}), starts in ${START_IN_SECONDS}s`);
  console.log("It should now appear on the Games screen.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
