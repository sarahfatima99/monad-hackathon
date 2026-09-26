// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title MemoryGame
/// @notice Manages scheduled memory-challenge games: funded MON prize pools,
///         wallet registration, finalization of rewards via a Merkle commitment,
///         and reward claims. The contract never sees questions/answers — the
///         backend judges gameplay off-chain and publishes only the payout.
contract MemoryGame is Ownable, ReentrancyGuard {
    enum Status {
        Open, // registration open, before startTime
        Live, // startTime has passed, not yet finalized
        Finalized, // rewardsRoot published, claims open
        Cancelled // organizer cancelled before start; refunds open
    }

    struct Game {
        uint64 startTime;
        uint128 pool; // MON funded by the organizer, in wei
        uint128 claimed; // amount already paid out via claimReward
        uint32 participantCount;
        uint128 entryFee; // optional per-player entry fee, 0 by default
        bytes32 rewardsRoot; // Merkle root of (wallet, amount) leaves, set on finalize
        bool finalized;
        bool cancelled;
        address organizer;
    }

    uint256 public nextGameId;
    mapping(uint256 => Game) public games;
    mapping(uint256 => mapping(address => bool)) public isRegistered;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    /// @notice Address allowed to call finalizeGame (the backend's signer/operator).
    address public operator;

    event GameCreated(uint256 indexed gameId, uint64 startTime, uint256 pool, address organizer);
    event PlayerJoined(uint256 indexed gameId, address indexed player, uint32 participantCount);
    event GameFinalized(uint256 indexed gameId, bytes32 rewardsRoot);
    event RewardClaimed(uint256 indexed gameId, address indexed player, uint256 amount);
    event GameCancelled(uint256 indexed gameId);
    event Refunded(uint256 indexed gameId, address indexed to, uint256 amount);
    event OperatorUpdated(address indexed newOperator);

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner(), "MemoryGame: not operator");
        _;
    }

    constructor(address initialOperator) Ownable(msg.sender) {
        operator = initialOperator == address(0) ? msg.sender : initialOperator;
    }

    function setOperator(address newOperator) external onlyOwner {
        operator = newOperator;
        emit OperatorUpdated(newOperator);
    }

    /// @notice Create and fund a new game. The organizer's `msg.value` becomes the prize pool.
    /// @param startTime Unix timestamp when the game starts; registration closes then.
    /// @param entryFee Optional per-player entry fee in wei (0 for a free game).
    function createGame(uint64 startTime, uint128 entryFee) external payable onlyOperator returns (uint256 gameId) {
        require(startTime > block.timestamp, "MemoryGame: startTime must be in the future");

        gameId = nextGameId++;
        Game storage g = games[gameId];
        g.startTime = startTime;
        g.pool = uint128(msg.value);
        g.entryFee = entryFee;
        g.organizer = msg.sender;

        emit GameCreated(gameId, startTime, msg.value, msg.sender);
    }

    /// @notice Register the caller's wallet for a game before it starts.
    function joinGame(uint256 gameId) external payable nonReentrant {
        Game storage g = games[gameId];
        require(g.organizer != address(0), "MemoryGame: game does not exist");
        require(!g.cancelled, "MemoryGame: game cancelled");
        require(block.timestamp < g.startTime, "MemoryGame: registration closed");
        require(!isRegistered[gameId][msg.sender], "MemoryGame: already registered");
        require(msg.value == g.entryFee, "MemoryGame: incorrect entry fee");

        isRegistered[gameId][msg.sender] = true;
        g.participantCount += 1;
        g.pool += uint128(msg.value);

        emit PlayerJoined(gameId, msg.sender, g.participantCount);
    }

    /// @notice Publish the authorized reward allocation for a finished game as a Merkle root
    ///         over leaves of keccak256(abi.encodePacked(wallet, amount)).
    function finalizeGame(uint256 gameId, bytes32 rewardsRoot) external onlyOperator {
        Game storage g = games[gameId];
        require(g.organizer != address(0), "MemoryGame: game does not exist");
        require(!g.cancelled, "MemoryGame: game cancelled");
        require(block.timestamp >= g.startTime, "MemoryGame: game has not started");
        require(!g.finalized, "MemoryGame: already finalized");

        g.finalized = true;
        g.rewardsRoot = rewardsRoot;

        emit GameFinalized(gameId, rewardsRoot);
    }

    /// @notice Claim a reward allocated in finalizeGame's Merkle root.
    function claimReward(uint256 gameId, uint256 amount, bytes32[] calldata proof) external nonReentrant {
        Game storage g = games[gameId];
        require(g.finalized, "MemoryGame: not finalized");
        require(!hasClaimed[gameId][msg.sender], "MemoryGame: already claimed");

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        require(MerkleProof.verify(proof, g.rewardsRoot, leaf), "MemoryGame: invalid proof");
        require(g.claimed + amount <= g.pool, "MemoryGame: exceeds pool");

        hasClaimed[gameId][msg.sender] = true;
        g.claimed += uint128(amount);

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "MemoryGame: transfer failed");

        emit RewardClaimed(gameId, msg.sender, amount);
    }

    /// @notice Cancel a game before it starts. Registration fees/pool become refundable.
    function cancelGame(uint256 gameId) external onlyOperator {
        Game storage g = games[gameId];
        require(g.organizer != address(0), "MemoryGame: game does not exist");
        require(block.timestamp < g.startTime, "MemoryGame: already started");
        require(!g.cancelled, "MemoryGame: already cancelled");

        g.cancelled = true;
        emit GameCancelled(gameId);
    }

    /// @notice Withdraw the organizer's unclaimed pool after finalization with no 5/5 winners,
    ///         or the full pool after cancellation (organizer only in both cases).
    function withdrawUnclaimed(uint256 gameId) external nonReentrant {
        Game storage g = games[gameId];
        require(msg.sender == g.organizer, "MemoryGame: not organizer");
        require(g.cancelled || g.finalized, "MemoryGame: game still open");

        uint256 remaining = g.pool - g.claimed;
        require(remaining > 0, "MemoryGame: nothing to withdraw");

        g.claimed = g.pool; // mark pool as fully settled
        (bool sent, ) = msg.sender.call{value: remaining}("");
        require(sent, "MemoryGame: transfer failed");

        emit Refunded(gameId, msg.sender, remaining);
    }

    /// @notice A registered player can reclaim their entry fee if the game was cancelled.
    function refundEntryFee(uint256 gameId) external nonReentrant {
        Game storage g = games[gameId];
        require(g.cancelled, "MemoryGame: not cancelled");
        require(isRegistered[gameId][msg.sender], "MemoryGame: not registered");
        require(!hasClaimed[gameId][msg.sender], "MemoryGame: already refunded");
        require(g.entryFee > 0, "MemoryGame: no entry fee to refund");

        hasClaimed[gameId][msg.sender] = true;
        g.claimed += g.entryFee;

        (bool sent, ) = msg.sender.call{value: g.entryFee}("");
        require(sent, "MemoryGame: transfer failed");

        emit Refunded(gameId, msg.sender, g.entryFee);
    }

    function getGame(uint256 gameId)
        external
        view
        returns (
            uint64 startTime,
            uint256 pool,
            uint256 claimed,
            uint32 participantCount,
            uint128 entryFee,
            Status status
        )
    {
        Game storage g = games[gameId];
        require(g.organizer != address(0), "MemoryGame: game does not exist");

        Status s;
        if (g.cancelled) {
            s = Status.Cancelled;
        } else if (g.finalized) {
            s = Status.Finalized;
        } else if (block.timestamp >= g.startTime) {
            s = Status.Live;
        } else {
            s = Status.Open;
        }

        return (g.startTime, g.pool, g.claimed, g.participantCount, g.entryFee, s);
    }
}
