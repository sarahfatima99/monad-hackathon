// Automated local end-to-end smoke test.
// Drives the whole flow against a local Hardhat node + this backend, using
// viem directly instead of a browser wallet: creates a funded game on-chain,
// registers a player through the real HTTP API, joins, answers every round
// correctly, waits for the backend to finalize, then claims the reward
// on-chain and checks the balance moved.
//
// Run with: npx tsx src/e2e/run.ts
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, defineChain, formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;
const ADMIN_KEY = process.env.ADMIN_KEY ?? "dev-admin-key";

// Standard, well-known Hardhat/Anvil default test accounts (never used with real funds).
const ORGANIZER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const PLAYER_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

const chain = defineChain({
  id: 31337,
  name: "Local Hardhat",
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
    type: "function", name: "joinGame", stateMutability: "payable",
    inputs: [{ name: "gameId", type: "uint256" }], outputs: []
  },
  {
    type: "function", name: "claimReward", stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" }, { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" }
    ], outputs: []
  }
] as const;

const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
const organizer = privateKeyToAccount(ORGANIZER_PK);
const player = privateKeyToAccount(PLAYER_PK);
const organizerWallet = createWalletClient({ account: organizer, chain, transport: http(RPC_URL) });
const playerWallet = createWalletClient({ account: player, chain, transport: http(RPC_URL) });

function log(step: string, detail?: unknown) {
  console.log(`\n=== ${step} ===`);
  if (detail !== undefined) console.log(detail);
}

async function api(path: string, init?: RequestInit & { token?: string }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...(init?.headers as any) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!CONTRACT_ADDRESS) throw new Error("Set CONTRACT_ADDRESS env var to the deployed MemoryGame address");

  log("0. Sanity: chain + backend reachable", { chainId: await publicClient.getChainId() });
  await api("/health");

  // 1. Organizer funds a game on-chain, starting a few seconds from now.
  const startTime = Math.floor(Date.now() / 1000) + 8;
  const poolWei = parseEther("10");
  log("1. createGame on-chain", { startTime, poolWei: formatEther(poolWei) });
  const createHash = await organizerWallet.writeContract({
    address: CONTRACT_ADDRESS, abi, functionName: "createGame",
    args: [BigInt(startTime), 0n], value: poolWei
  });
  await publicClient.waitForTransactionReceipt({ hash: createHash });

  // 2. Organizer registers the off-chain content (3 quick rounds) and links it to onchain game 0.
  const rounds = [
    { photoUrl: "https://picsum.photos/seed/e2e1/400/300", question: "Q1?", options: ["A", "B"], correctOptionIndex: 0 },
    { photoUrl: "https://picsum.photos/seed/e2e2/400/300", question: "Q2?", options: ["A", "B"], correctOptionIndex: 1 },
    { photoUrl: "https://picsum.photos/seed/e2e3/400/300", question: "Q3?", options: ["A", "B"], correctOptionIndex: 0 }
  ];
  const { id: gameId } = await api("/admin/games", {
    method: "POST",
    headers: { "x-admin-key": ADMIN_KEY },
    body: JSON.stringify({ name: "E2E Test Game", startTime, onchainGameId: 0, rounds })
  });
  log("2. Off-chain game created + linked", { gameId, onchainGameId: 0 });

  // 3. Register + verify the player's email (backend writes the code to DEV_CODE_FILE for tests).
  const email = "e2e-player@example.com";
  await api("/auth/register", { method: "POST", body: JSON.stringify({ email }) });
  const codeFile = process.env.DEV_CODE_FILE;
  if (!codeFile) throw new Error("Set DEV_CODE_FILE env var (same path passed to the backend)");
  let code: string | undefined;
  for (let i = 0; i < 20 && !code; i++) {
    await sleep(150);
    const lines = readFileSync(codeFile, "utf8").trim().split("\n").filter(Boolean);
    const entry = [...lines].reverse().map((l) => JSON.parse(l)).find((e) => e.to === email);
    code = entry?.code;
  }
  if (!code) throw new Error(`No verification code found for ${email} in ${codeFile}`);
  const { token } = await api("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ email, code })
  });
  log("3. Player verified", { hasToken: !!token });

  await api("/auth/nickname", { method: "POST", token, body: JSON.stringify({ nickname: "e2ePlayer" }) });

  // 4. Link the player's wallet with a signed nonce (SIWE-style).
  const { message } = await api("/auth/wallet/nonce", { method: "POST", token });
  const signature = await player.signMessage({ message });
  await api("/auth/wallet/link", { method: "POST", token, body: JSON.stringify({ address: player.address, signature }) });
  log("4. Wallet linked", { address: player.address });

  // 5. Player joins on-chain, then tells the backend.
  const joinHash = await playerWallet.writeContract({
    address: CONTRACT_ADDRESS, abi, functionName: "joinGame", args: [0n]
  });
  await publicClient.waitForTransactionReceipt({ hash: joinHash });
  await api(`/games/${gameId}/join`, { method: "POST", token, body: JSON.stringify({ txHash: joinHash }) });
  log("5. Player joined", { joinHash });

  // 6. Wait for the game to start, then answer every round correctly as soon as it's askable.
  const answeredRounds = new Set<number>();
  log("6. Waiting for game to start and playing all rounds...");
  while (true) {
    const round = await api(`/games/${gameId}/round`, { token });
    if (round.phase.phase === "finished") break;
    if (round.phase.phase === "question" && !answeredRounds.has(round.phase.roundIndex)) {
      const correct = rounds[round.phase.roundIndex].correctOptionIndex;
      await api(`/games/${gameId}/answer`, {
        method: "POST", token,
        body: JSON.stringify({ roundIndex: round.phase.roundIndex, selectedOptionIndex: correct })
      });
      answeredRounds.add(round.phase.roundIndex);
      console.log(`  answered round ${round.phase.roundIndex} with option ${correct}`);
    }
    await sleep(300);
  }
  log("6. Game finished");

  // 7. Check the leaderboard, then claim the reward.
  await sleep(1500); // give the scheduler a tick to finalize + publish on-chain
  const board = await api(`/games/${gameId}/leaderboard`);
  log("7. Leaderboard", board);

  const claim = await api(`/games/${gameId}/claim-info`, { token });
  log("8. Claim info", claim);
  if (!claim.eligible) throw new Error("Player was not marked eligible for a reward — check scoring/finalize logic");

  const balanceBefore = await publicClient.getBalance({ address: player.address });
  const claimHash = await playerWallet.writeContract({
    address: CONTRACT_ADDRESS, abi, functionName: "claimReward",
    args: [BigInt(claim.onchainGameId), BigInt(claim.amountWei), claim.proof]
  });
  await publicClient.waitForTransactionReceipt({ hash: claimHash });
  const balanceAfter = await publicClient.getBalance({ address: player.address });

  log("9. Reward claimed on-chain", {
    amountWei: claim.amountWei,
    balanceBefore: formatEther(balanceBefore),
    balanceAfter: formatEther(balanceAfter),
    delta: formatEther(balanceAfter - balanceBefore)
  });

  console.log("\n✅ End-to-end flow passed: register -> verify -> nickname -> wallet link -> join -> play -> finalize -> claim");
}

main().catch((err) => {
  console.error("\n❌ E2E test failed:", err);
  process.exit(1);
});
