// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title MUSDPocket
/// @notice India-first goal savings + family remittance vault for Mezo's Bitcoin-backed MUSD.
/// @dev Soft-locks MUSD until an unlock timestamp. Early exit pays a fee that stays in the
///      protocol fee pool (claimable by owner for community treasury / Wave 2 yield).
contract MUSDPocket {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Goal {
        address owner;
        string name;           // e.g. "Sister wedding", "Emergency FD"
        uint256 targetAmount;  // aspirational target (18 decimals)
        uint256 balance;       // current locked MUSD
        uint64 unlockTime;     // unix seconds; withdraw after this
        bool active;
        bool isFamily;         // if true, allowlisted contributors may deposit
    }

    // -------------------------------------------------------------------------
    // Immutables / config
    // -------------------------------------------------------------------------

    IERC20 public immutable musd;
    address public owner;

    /// @notice Early-withdrawal fee in basis points (100 = 1%). Default 2%.
    uint16 public earlyFeeBps = 200;
    uint16 public constant MAX_EARLY_FEE_BPS = 500; // 5% hard cap
    uint256 public constant MIN_LOCK = 1 days;
    uint256 public constant MAX_LOCK = 730 days; // ~2 years (FD-style)

    uint256 public feePool;
    uint256 public nextGoalId = 1;

    mapping(uint256 => Goal) public goals;
    mapping(uint256 => mapping(address => bool)) public familyMember;
    mapping(address => uint256[]) private _goalsByOwner;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event GoalCreated(
        uint256 indexed goalId,
        address indexed owner,
        string name,
        uint256 targetAmount,
        uint64 unlockTime,
        bool isFamily
    );
    event Deposited(uint256 indexed goalId, address indexed from, uint256 amount);
    event Withdrawn(uint256 indexed goalId, address indexed to, uint256 amount);
    event EarlyWithdrawn(uint256 indexed goalId, address indexed to, uint256 net, uint256 fee);
    event FamilyMemberUpdated(uint256 indexed goalId, address indexed member, bool allowed);
    event RemittanceSent(
        address indexed from,
        address indexed to,
        uint256 amount,
        string memo,
        bytes32 indexed tag
    );
    event FeeClaimed(address indexed to, uint256 amount);
    event EarlyFeeUpdated(uint16 bps);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotGoalOwner();
    error NotContributor();
    error GoalInactive();
    error BadLock();
    error BadAmount();
    error StillLocked();
    error AlreadyUnlocked();
    error TransferFailed();
    error FeeTooHigh();
    error ZeroAddress();
    error EmptyName();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address musdToken, address initialOwner) {
        if (musdToken == address(0) || initialOwner == address(0)) revert ZeroAddress();
        musd = IERC20(musdToken);
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // -------------------------------------------------------------------------
    // Goal lifecycle
    // -------------------------------------------------------------------------

    /// @notice Create a personal or family savings goal locked until `unlockTime`.
    function createGoal(
        string calldata name,
        uint256 targetAmount,
        uint64 unlockTime,
        bool isFamily
    ) external returns (uint256 goalId) {
        if (bytes(name).length == 0 || bytes(name).length > 64) revert EmptyName();
        uint256 lock = uint256(unlockTime) - block.timestamp;
        if (unlockTime <= block.timestamp || lock < MIN_LOCK || lock > MAX_LOCK) revert BadLock();

        goalId = nextGoalId++;
        goals[goalId] = Goal({
            owner: msg.sender,
            name: name,
            targetAmount: targetAmount,
            balance: 0,
            unlockTime: unlockTime,
            active: true,
            isFamily: isFamily
        });
        _goalsByOwner[msg.sender].push(goalId);

        if (isFamily) {
            familyMember[goalId][msg.sender] = true;
            emit FamilyMemberUpdated(goalId, msg.sender, true);
        }

        emit GoalCreated(goalId, msg.sender, name, targetAmount, unlockTime, isFamily);
    }

    /// @notice Deposit MUSD into a goal. Caller must approve this contract first.
    function deposit(uint256 goalId, uint256 amount) external {
        Goal storage g = goals[goalId];
        if (!g.active) revert GoalInactive();
        if (amount == 0) revert BadAmount();
        if (g.isFamily) {
            if (!familyMember[goalId][msg.sender] && msg.sender != g.owner) revert NotContributor();
        } else if (msg.sender != g.owner) {
            revert NotGoalOwner();
        }

        if (!musd.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        g.balance += amount;
        emit Deposited(goalId, msg.sender, amount);
    }

    /// @notice Withdraw full balance after unlock. Closes the goal.
    function withdraw(uint256 goalId) external {
        Goal storage g = goals[goalId];
        if (!g.active) revert GoalInactive();
        if (msg.sender != g.owner) revert NotGoalOwner();
        if (block.timestamp < g.unlockTime) revert StillLocked();

        uint256 amount = g.balance;
        if (amount == 0) revert BadAmount();
        g.balance = 0;
        g.active = false;

        if (!musd.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(goalId, msg.sender, amount);
    }

    /// @notice Early exit before unlock. Pays `earlyFeeBps` into the fee pool.
    function earlyWithdraw(uint256 goalId) external {
        Goal storage g = goals[goalId];
        if (!g.active) revert GoalInactive();
        if (msg.sender != g.owner) revert NotGoalOwner();
        if (block.timestamp >= g.unlockTime) revert AlreadyUnlocked(); // use withdraw()

        uint256 amount = g.balance;
        if (amount == 0) revert BadAmount();

        uint256 fee = (amount * earlyFeeBps) / 10_000;
        uint256 net = amount - fee;

        g.balance = 0;
        g.active = false;
        feePool += fee;

        if (!musd.transfer(msg.sender, net)) revert TransferFailed();
        emit EarlyWithdrawn(goalId, msg.sender, net, fee);
    }

    // -------------------------------------------------------------------------
    // Family members
    // -------------------------------------------------------------------------

    function setFamilyMember(uint256 goalId, address member, bool allowed) external {
        Goal storage g = goals[goalId];
        if (!g.active) revert GoalInactive();
        if (msg.sender != g.owner) revert NotGoalOwner();
        if (!g.isFamily) revert NotContributor();
        if (member == address(0)) revert ZeroAddress();

        familyMember[goalId][member] = allowed;
        emit FamilyMemberUpdated(goalId, member, allowed);
    }

    // -------------------------------------------------------------------------
    // Remittance helper (direct MUSD send with on-chain memo)
    // -------------------------------------------------------------------------

    /// @notice Transfer MUSD to family with a public memo (e.g. "Ma rent Oct").
    /// @dev Pure convenience wrapper + indexed tag for explorers/indexers.
    function sendRemittance(address to, uint256 amount, string calldata memo) external {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert BadAmount();
        if (bytes(memo).length > 96) revert EmptyName();

        if (!musd.transferFrom(msg.sender, to, amount)) revert TransferFailed();
        bytes32 tag = keccak256(bytes(memo));
        emit RemittanceSent(msg.sender, to, amount, memo, tag);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getGoal(uint256 goalId)
        external
        view
        returns (
            address goalOwner,
            string memory name,
            uint256 targetAmount,
            uint256 balance,
            uint64 unlockTime,
            bool active,
            bool isFamily
        )
    {
        Goal storage g = goals[goalId];
        return (g.owner, g.name, g.targetAmount, g.balance, g.unlockTime, g.active, g.isFamily);
    }

    function goalsOf(address user) external view returns (uint256[] memory) {
        return _goalsByOwner[user];
    }

    function progressBps(uint256 goalId) external view returns (uint256) {
        Goal storage g = goals[goalId];
        if (g.targetAmount == 0) return 0;
        return (g.balance * 10_000) / g.targetAmount;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setEarlyFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_EARLY_FEE_BPS) revert FeeTooHigh();
        earlyFeeBps = bps;
        emit EarlyFeeUpdated(bps);
    }

    function claimFees(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = feePool;
        if (amount == 0) revert BadAmount();
        feePool = 0;
        if (!musd.transfer(to, amount)) revert TransferFailed();
        emit FeeClaimed(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
