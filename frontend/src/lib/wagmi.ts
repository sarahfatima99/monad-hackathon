import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

export const monadTestnet = defineChain({
  id: Number(import.meta.env.VITE_CHAIN_ID ?? 10143),
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_MONAD_RPC_URL as string] }
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" }
  },
  testnet: true
});

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http(import.meta.env.VITE_MONAD_RPC_URL as string)
  }
});

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`;

// Minimal ABI for the calls the frontend makes directly.
export const memoryGameAbi = [
  {
    type: "function",
    name: "joinGame",
    stateMutability: "payable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "claimReward",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" }
    ],
    outputs: []
  },
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
  }
] as const;
