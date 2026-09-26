import { encodeAbiParameters, keccak256, parseAbiParameters } from "viem";
import { MerkleTree } from "merkletreejs";

export interface RewardEntry {
  wallet: `0x${string}`;
  amountWei: bigint;
}

/**
 * Builds a Merkle tree whose leaves match MemoryGame.sol's
 * keccak256(bytes.concat(keccak256(abi.encode(wallet, amount)))) double-hash,
 * and returns the root plus a per-wallet proof for claimReward().
 */
export function buildRewardsTree(entries: RewardEntry[]) {
  const leaf = (e: RewardEntry) =>
    Buffer.from(
      keccak256(encodeAbiParameters(parseAbiParameters("address, uint256"), [e.wallet, e.amountWei])).slice(2),
      "hex"
    );

  // Contract hashes the ABI-encoded leaf once more (bytes.concat(keccak256(...)))
  const doubleHashedLeaf = (e: RewardEntry) => Buffer.from(keccak256(`0x${leaf(e).toString("hex")}`).slice(2), "hex");

  const leaves = entries.map(doubleHashedLeaf);
  const tree = new MerkleTree(leaves, keccak256Buffer, { sortPairs: true });

  const root = `0x${tree.getRoot().toString("hex")}` as `0x${string}`;
  const proofFor = (e: RewardEntry) =>
    tree.getProof(doubleHashedLeaf(e)).map((p) => `0x${p.data.toString("hex")}` as `0x${string}`);

  return { root, proofFor };
}

function keccak256Buffer(data: Buffer): Buffer {
  return Buffer.from(keccak256(`0x${data.toString("hex")}`).slice(2), "hex");
}
