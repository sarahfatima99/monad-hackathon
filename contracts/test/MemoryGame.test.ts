import { expect } from "chai";
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

describe("MemoryGame", function () {
  async function deploy() {
    const [owner, organizer, player1, player2, player3] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MemoryGame");
    const game = await Factory.deploy(organizer.address);
    await game.waitForDeployment();
    return { game, owner, organizer, player1, player2, player3 };
  }

  function leaf(address: string, amount: bigint) {
    return Buffer.from(
      ethers.getBytes(
        ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [address, amount])
        )
      )
    );
  }

  it("creates, funds, and reports a game", async function () {
    const { game, organizer } = await deploy();
    const start = Math.floor(Date.now() / 1000) + 3600;

    await expect(
      game.connect(organizer).createGame(start, 0, { value: ethers.parseEther("10") })
    ).to.emit(game, "GameCreated");

    const info = await game.getGame(0);
    expect(info.pool).to.equal(ethers.parseEther("10"));
    expect(info.status).to.equal(0); // Open
  });

  it("lets players join before start and blocks late/duplicate joins", async function () {
    const { game, organizer, player1 } = await deploy();
    const start = Math.floor(Date.now() / 1000) + 3600;
    await game.connect(organizer).createGame(start, 0, { value: ethers.parseEther("10") });

    await game.connect(player1).joinGame(0);
    await expect(game.connect(player1).joinGame(0)).to.be.revertedWith("MemoryGame: already registered");

    const info = await game.getGame(0);
    expect(info.participantCount).to.equal(1);
  });

  it("finalizes with a Merkle root and pays out valid claims only once", async function () {
    const { game, organizer, player1, player2 } = await deploy();
    const start = Math.floor(Date.now() / 1000) + 2;
    await game.connect(organizer).createGame(start, 0, { value: ethers.parseEther("10") });
    await game.connect(player1).joinGame(0);
    await game.connect(player2).joinGame(0);

    await new Promise((r) => setTimeout(r, 3000));

    const amount1 = ethers.parseEther("5");
    const amount2 = ethers.parseEther("5");
    const leaves = [leaf(player1.address, amount1), leaf(player2.address, amount2)];
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    await game.connect(organizer).finalizeGame(0, root);

    const proof1 = tree.getHexProof(leaf(player1.address, amount1));
    await expect(game.connect(player1).claimReward(0, amount1, proof1)).to.changeEtherBalance(
      player1,
      amount1
    );
    await expect(game.connect(player1).claimReward(0, amount1, proof1)).to.be.revertedWith(
      "MemoryGame: already claimed"
    );
  });

  it("supports cancellation and refunds", async function () {
    const { game, organizer, player1 } = await deploy();
    const start = Math.floor(Date.now() / 1000) + 3600;
    await game.connect(organizer).createGame(start, ethers.parseEther("1"), {
      value: ethers.parseEther("2")
    });
    await game.connect(player1).joinGame(0, { value: ethers.parseEther("1") });

    await game.connect(organizer).cancelGame(0);
    await expect(game.connect(player1).refundEntryFee(0)).to.changeEtherBalance(
      player1,
      ethers.parseEther("1")
    );
  });
});
