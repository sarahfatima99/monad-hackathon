import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "11".repeat(32);
const MONAD_TESTNET_RPC_URL =
  process.env.MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    monadTestnet: {
      url: MONAD_TESTNET_RPC_URL,
      chainId: 10143,
      accounts: [PRIVATE_KEY]
    },
    hardhat: {}
  }
};

export default config;
