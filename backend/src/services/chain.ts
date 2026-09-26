import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";

export const monadTestnet = defineChain({
  id: Number(process.env.CHAIN_ID ?? 10143),
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } }
});

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(config.rpcUrl)
});

// Only needed for finalizeGame/createGame calls made by the backend's operator key.
export const operatorAccount = config.operatorPrivateKey
  ? privateKeyToAccount(config.operatorPrivateKey)
  : undefined;

export const walletClient = operatorAccount
  ? createWalletClient({ account: operatorAccount, chain: monadTestnet, transport: http(config.rpcUrl) })
  : undefined;

// Minimal ABI — keep in sync with contracts/contracts/MemoryGame.sol
export const memoryGameAbi = [
  {
    type: "function",
    name: "getGame",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "startTime", type: "uint64" },
      { name: "pool", type: "uint256" },
      { name: "claimed", type: "uint256" },
      { name: "participantCount", type: "uint32" },
      { name: "entryFee", type: "uint128" },
      { name: "status", type: "uint8" }
    ]
  },
  {
    type: "function",
    name: "createGame",
    stateMutability: "payable",
    inputs: [
      { name: "startTime", type: "uint64" },
      { name: "entryFee", type: "uint128" }
    ],
    outputs: [{ name: "gameId", type: "uint256" }]
  },
  {
    type: "function",
    name: "finalizeGame",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "rewardsRoot", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "isRegistered",
    stateMutability: "view",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "wallet", type: "address" }
    ],
    outputs: [{ type: "bool" }]
  }
] as const;

export async function getOnchainGame(onchainGameId: bigint) {
  return publicClient.readContract({
    address: config.contractAddress,
    abi: memoryGameAbi,
    functionName: "getGame",
    args: [onchainGameId]
  });
}

export async function getWalletBalance(address: `0x${string}`) {
  return publicClient.getBalance({ address });
}

export async function finalizeOnchain(onchainGameId: bigint, rewardsRoot: `0x${string}`) {
  if (!walletClient || !operatorAccount) {
    throw new Error("OPERATOR_PRIVATE_KEY not configured — cannot finalize on-chain");
  }
  return walletClient.writeContract({
    address: config.contractAddress,
    abi: memoryGameAbi,
    functionName: "finalizeGame",
    args: [onchainGameId, rewardsRoot],
    account: operatorAccount,
    chain: monadTestnet
  });
}
