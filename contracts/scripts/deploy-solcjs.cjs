// Deploys the solcjs-compiled MemoryGame using viem directly, for environments
// where `hardhat run --network ...` can't be used (see compile-solcjs.cjs).
const fs = require("fs");
const path = require("path");
const { createPublicClient, createWalletClient, http, defineChain } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const DEPLOYER_PK = process.env.DEPLOYER_PK;
if (!DEPLOYER_PK) throw new Error("Set DEPLOYER_PK");

const build = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "build", "MemoryGame.json"), "utf8"));

const chain = defineChain({
  id: Number(process.env.CHAIN_ID || 31337),
  name: "local",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } }
});

async function main() {
  const account = privateKeyToAccount(DEPLOYER_PK);
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

  const hash = await walletClient.deployContract({
    abi: build.abi,
    bytecode: build.bytecode,
    args: [account.address] // constructor(address initialOperator)
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("MemoryGame deployed to:", receipt.contractAddress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
