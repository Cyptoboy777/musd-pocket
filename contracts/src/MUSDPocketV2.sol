// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {
    IERC20Permit,
    IBorrowerOperationsSignatures,
    ITroveManager,
    IPriceFeed
} from "./interfaces/IMezo.sol";

/// @title MUSDPocket v2
/// @notice Dated savings goals for Mezo's Bitcoin-backed MUSD, now wired into the MUSD
///         protocol itself: a borrower can draw MUSD from their own trove straight into a
///         goal with one signature, so BTC holders save without selling BTC.
/// @dev What changed from v1 (0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8):
///      - borrowToGoal: calls Mezo's BorrowerOperationsSignatures.withdrawMUSDWithSignature
///        with recipient = this contract, credits the goal with the MUSD actually received,
///        then re-reads the trove (TroveManager + PriceFeed) and reverts the whole thing if
///        the loan would end below 150% collateral (Mezo's critical ratio).
///      - depositWithPermit / sendWithPermit: MUSD's EIP-2612 permit, so one signature + one
///        transaction instead of approve + deposit.
///      - Strict accounting (totalLocked) so the owner can only ever touch the fee pool and
///        stray tokens, never goal balances.
///      - Reentrancy lock and checked low-level token transfers.
contract MUSDPocketV2 {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Goal {
        address owner;
        string name; // e.g. "Emergency fund", "School fees"
        uint256 targetAmount; // 18 decimals
        uint256 balance; // MUSD held for this goal
        uint64 unlockTime; // unix seconds
        bool active;
        bool isFamily; // allowlisted contributors may deposit
    }

    // -------------------------------------------------------------------------
    // Config
    // -------------------------------------------------------------------------

    IERC20 public immutable musd;
    IBorrowerOperationsSignatures public immutable borrowerOpsSig;
    ITroveManager public immutable troveManager;
    IPriceFeed public immutable priceFeed;
    address public owner;

    uint16 public earlyFeeBps = 200; // 2%
    uint16 public constant MAX_EARLY_FEE_BPS = 500; // 5% hard cap
    uint256 public constant MIN_LOCK = 1 days;
    uint256 public constant MAX_LOCK = 730 days;
    /// @notice A borrow into a goal must leave the trove at or above this ratio (150%).
    uint256 public constant MIN_ICR_AFTER_BORROW = 1.5e18;

    uint256 public feePool;
    uint256 public totalLocked;
    uint256 public totalBorrowedToGoals;
    uint256 public nextGoalId = 1;

    mapping(uint256 => Goal) public goals;
    mapping(uint256 => mapping(address => bool)) public familyMember;
    mapping(address => uint256[]) private _goalsByOwner;

    uint256 private _lock = 1;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event GoalCreated(
        uint256 indexed goalId, address indexed owner, string name, uint256 targetAmount, uint64 unlockTime, bool isFamily
    );
    event Deposited(uint256 indexed goalId, address indexed from, uint256 amount);
    event BorrowedToGoal(uint256 indexed goalId, address indexed borrower, uint256 amount, uint256 icrAfter);
    event Withdrawn(uint256 indexed goalId, address indexed to, uint256 amount);
    event EarlyWithdrawn(uint256 indexed goalId, address indexed to, uint256 net, uint256 fee);
    event FamilyMemberUpdated(uint256 indexed goalId, address indexed member, bool allowed);
    event RemittanceSent(address indexed from, address indexed to, uint256 amount, string memo, bytes32 indexed tag);
    event FeeClaimed(address indexed to, uint256 amount);
    event StrayRecovered(address indexed to, uint256 amount);
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
    error MemoTooLong();
    error Reentrant();
    error BorrowMismatch(uint256 expected, uint256 received);
    error LoanTooRisky(uint256 icrAfter);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address musdToken,
        address borrowerOperationsSignatures,
        address troveManager_,
        address priceFeed_,
        address initialOwner
    ) {
        if (
            musdToken == address(0) || borrowerOperationsSignatures == address(0) || troveManager_ == address(0)
                || priceFeed_ == address(0) || initialOwner == address(0)
        ) revert ZeroAddress();
        musd = IERC20(musdToken);
        borrowerOpsSig = IBorrowerOperationsSignatures(borrowerOperationsSignatures);
        troveManager = ITroveManager(troveManager_);
        priceFeed = IPriceFeed(priceFeed_);
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

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrant();
        _lock = 2;
        _;
        _lock = 1;
    }

    /// @dev Mezo's ActivePool always "sends" the collateral change to the recipient, even when
    ///      it is zero (a value-0 call). We must accept that call, but never hold BTC.
    receive() external payable {
        if (msg.value != 0) revert BadAmount();
    }

    // -------------------------------------------------------------------------
    // Goal lifecycle
    // -------------------------------------------------------------------------

    function createGoal(string calldata name, uint256 targetAmount, uint64 unlockTime, bool isFamily)
        external
        returns (uint256 goalId)
    {
        if (bytes(name).length == 0 || bytes(name).length > 64) revert EmptyName();
        if (unlockTime <= block.timestamp) revert BadLock();
        uint256 lock = uint256(unlockTime) - block.timestamp;
        if (lock < MIN_LOCK || lock > MAX_LOCK) revert BadLock();

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

    /// @notice Deposit MUSD (needs a prior approve).
    function deposit(uint256 goalId, uint256 amount) external nonReentrant {
        _checkContributor(goalId, amount);
        _pullFrom(msg.sender, amount);
        _credit(goalId, msg.sender, amount);
    }

    /// @notice Deposit MUSD with an EIP-2612 permit: one signature, one transaction.
    function depositWithPermit(uint256 goalId, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
    {
        _checkContributor(goalId, amount);
        _permit(amount, deadline, v, r, s);
        _pullFrom(msg.sender, amount);
        _credit(goalId, msg.sender, amount);
    }

    /// @notice Borrow MUSD against the caller's own Mezo trove straight into a goal.
    /// @dev The caller signs Mezo's EIP-712 `WithdrawMUSD(amount, borrower, recipient=this,
    ///      nonce, deadline)`. Mezo checks the signature and nonce; we only accept
    ///      borrower == msg.sender, credit what actually arrived, and refuse to leave the
    ///      trove below MIN_ICR_AFTER_BORROW.
    function borrowToGoal(
        uint256 goalId,
        uint256 amount,
        address upperHint,
        address lowerHint,
        bytes calldata signature,
        uint256 deadline
    ) external nonReentrant {
        _checkContributor(goalId, amount);

        uint256 before = musd.balanceOf(address(this));
        borrowerOpsSig.withdrawMUSDWithSignature(
            amount, upperHint, lowerHint, msg.sender, address(this), signature, deadline
        );
        uint256 received = musd.balanceOf(address(this)) - before;
        if (received != amount) revert BorrowMismatch(amount, received);

        uint256 icrAfter = troveManager.getCurrentICR(msg.sender, priceFeed.fetchPrice());
        if (icrAfter < MIN_ICR_AFTER_BORROW) revert LoanTooRisky(icrAfter);

        totalBorrowedToGoals += amount;
        _credit(goalId, msg.sender, amount);
        emit BorrowedToGoal(goalId, msg.sender, amount, icrAfter);
    }

    /// @notice Withdraw the full balance after the unlock date. Closes the goal.
    function withdraw(uint256 goalId) external nonReentrant {
        Goal storage g = goals[goalId];
        if (!g.active) revert GoalInactive();
        if (msg.sender != g.owner) revert NotGoalOwner();
        if (block.timestamp < g.unlockTime) revert StillLocked();

        uint256 amount = g.balance;
        if (amount == 0) revert BadAmount();
        g.balance = 0;
        g.active = false;
        totalLocked -= amount;

        emit Withdrawn(goalId, msg.sender, amount);
        _send(msg.sender, amount);
    }

    /// @notice Leave before the unlock date and pay `earlyFeeBps` into the fee pool.
    function earlyWithdraw(uint256 goalId) external nonReentrant {
        Goal storage g = goals[goalId];
        if (!g.active) revert GoalInactive();
        if (msg.sender != g.owner) revert NotGoalOwner();
        if (block.timestamp >= g.unlockTime) revert AlreadyUnlocked();

        uint256 amount = g.balance;
        if (amount == 0) revert BadAmount();
        uint256 fee = (amount * earlyFeeBps) / 10_000;
        uint256 net = amount - fee;

        g.balance = 0;
        g.active = false;
        totalLocked -= amount;
        feePool += fee;

        emit EarlyWithdrawn(goalId, msg.sender, net, fee);
        _send(msg.sender, net);
    }

    // -------------------------------------------------------------------------
    // Shared goals
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
    // Payments with a note
    // -------------------------------------------------------------------------

    function sendRemittance(address to, uint256 amount, string calldata memo) external nonReentrant {
        _checkSend(to, amount, memo);
        _pullTo(msg.sender, to, amount);
        emit RemittanceSent(msg.sender, to, amount, memo, keccak256(bytes(memo)));
    }

    function sendWithPermit(
        address to,
        uint256 amount,
        string calldata memo,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        _checkSend(to, amount, memo);
        _permit(amount, deadline, v, r, s);
        _pullTo(msg.sender, to, amount);
        emit RemittanceSent(msg.sender, to, amount, memo, keccak256(bytes(memo)));
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

    /// @notice MUSD held here that belongs to no goal and is not fees (e.g. sent by mistake).
    function strayBalance() public view returns (uint256) {
        uint256 bal = musd.balanceOf(address(this));
        uint256 owed = totalLocked + feePool;
        return bal > owed ? bal - owed : 0;
    }

    // -------------------------------------------------------------------------
    // Admin (can never touch goal balances)
    // -------------------------------------------------------------------------

    function setEarlyFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_EARLY_FEE_BPS) revert FeeTooHigh();
        earlyFeeBps = bps;
        emit EarlyFeeUpdated(bps);
    }

    function claimFees(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = feePool;
        if (amount == 0) revert BadAmount();
        feePool = 0;
        emit FeeClaimed(to, amount);
        _send(to, amount);
    }

    function recoverStray(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = strayBalance();
        if (amount == 0) revert BadAmount();
        emit StrayRecovered(to, amount);
        _send(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    function _checkContributor(uint256 goalId, uint256 amount) internal view {
        Goal storage g = goals[goalId];
        if (!g.active) revert GoalInactive();
        if (amount == 0) revert BadAmount();
        if (g.isFamily) {
            if (!familyMember[goalId][msg.sender] && msg.sender != g.owner) revert NotContributor();
        } else if (msg.sender != g.owner) {
            revert NotGoalOwner();
        }
    }

    function _checkSend(address to, uint256 amount, string calldata memo) internal pure {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert BadAmount();
        if (bytes(memo).length > 96) revert MemoTooLong();
    }

    function _credit(uint256 goalId, address from, uint256 amount) internal {
        goals[goalId].balance += amount;
        totalLocked += amount;
        emit Deposited(goalId, from, amount);
    }

    /// @dev A permit that was already used (e.g. front-run) is fine as long as the allowance is there.
    function _permit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) internal {
        try IERC20Permit(address(musd)).permit(msg.sender, address(this), amount, deadline, v, r, s) {}
        catch {
            if (musd.allowance(msg.sender, address(this)) < amount) revert TransferFailed();
        }
    }

    function _pullFrom(address from, uint256 amount) internal {
        _pullTo(from, address(this), amount);
    }

    function _pullTo(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(musd).call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _send(address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(musd).call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
