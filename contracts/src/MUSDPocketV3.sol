// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {
    IERC20Permit,
    IBorrowerOperationsSignatures,
    IBorrowerOperationsSignaturesRepay,
    IBorrowerOperationsView,
    ITroveManagerV3,
    IPriceFeed,
    IMUSDSavingsRate
} from "./interfaces/IMezo.sol";

/// @title MUSDPocket v3
/// @notice Dated MUSD savings goals on Mezo that work with the saver's own trove.
///         v3 answers the Wave 2 review (and adds an optional, capped performance fee on yield only):
///         - Earn mode: a goal can park its MUSD in Mezo's MUSD Savings Vault (sMUSD) and
///           collect the vault's MUSD yield while it is locked.
///         - Emergency repay / close: a goal can pay down, or fully close, its owner's trove
///           through BorrowerOperationsSignatures, so the lock lowers loan risk.
///         - Borrow-into-goal is refused while Mezo is in Recovery Mode.
///         - Repay pre-checks Mezo's minimum net debt (1,800 MUSD today, read live).
/// @dev Everything from v2 is kept: per-goal fee snapshot, two-step ownership, strict
///      accounting, reentrancy lock, checked token calls, 150% floor on borrow-to-goal.
///
///      Accounting
///      - goals[id].balance  = what the goal owns (principal + yield already credited).
///      - earnPrincipal[id]  = part of that balance sitting in the vault as sMUSD (1:1 MUSD).
///      - totalLocked        = sum of goal balances.  totalInVault = sum of earnPrincipal.
///      - yieldPool          = vault yield already collected by the Pocket but not yet
///                             credited to a goal. Never claimable by the owner.
///      The vault tracks yield with a global yieldIndex. Each goal stores the index it last
///      settled at, so goal yield = earnPrincipal * (index - snapshot) / 1e18: the same
///      formula the vault uses for the Pocket as a whole, so goals can never be owed more
///      than the Pocket is owed.
contract MUSDPocketV3 {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Goal {
        address owner;
        string name;
        uint256 targetAmount;
        uint256 balance;
        uint64 unlockTime;
        bool active;
        bool isFamily;
    }

    struct Config {
        address musd;
        address borrowerOperations;
        address borrowerOperationsSignatures;
        address troveManager;
        address priceFeed;
        address savingsVault; // address(0) turns earn mode off (config flag)
        address owner;
    }

    // -------------------------------------------------------------------------
    // Config
    // -------------------------------------------------------------------------

    IERC20 public immutable musd;
    IBorrowerOperationsView public immutable borrowerOps;
    address public immutable borrowerOpsSig;
    ITroveManagerV3 public immutable troveManager;
    IPriceFeed public immutable priceFeed;
    IMUSDSavingsRate public immutable savingsVault;

    address public owner;
    address public pendingOwner;

    uint16 public earlyFeeBps = 200;
    uint16 public constant MAX_EARLY_FEE_BPS = 500;
    /// @notice Performance fee on vault YIELD only, never on principal. Off (0) by default.
    ///         Hard cap 10%. Changed only by the owner, which is the 2-day timelock.
    uint16 public yieldFeeBps;
    uint16 public constant MAX_YIELD_FEE_BPS = 1000;
    /// @notice Where `claimFeesToRecipient` sends collected fees. Shown in the app.
    address public feeRecipient;
    uint256 public constant MIN_LOCK = 1 days;
    uint256 public constant MAX_LOCK = 730 days;
    uint256 public constant MIN_ICR_AFTER_BORROW = 1.5e18;
    /// @notice Mezo's gas compensation: part of every trove's debt, not repayable by the borrower.
    uint256 public constant GAS_COMPENSATION = 200e18;
    /// @notice A trove below this ratio (or any trove in Recovery Mode) counts as "at risk":
    ///         emergency repay / close from a locked goal is then free of the early-exit fee.
    uint256 public constant AT_RISK_ICR = 2e18;

    uint256 public feePool;
    uint256 public totalLocked;
    uint256 public totalBorrowedToGoals;
    uint256 public totalRepaidFromGoals;
    uint256 public totalInVault;
    uint256 public yieldPool;
    uint256 public nextGoalId = 1;

    mapping(uint256 => Goal) public goals;
    mapping(uint256 => uint16) public goalEarlyFeeBps;
    mapping(uint256 => mapping(address => bool)) public familyMember;
    mapping(address => uint256[]) private _goalsByOwner;

    mapping(uint256 => bool) public goalEarning;
    mapping(uint256 => uint256) public earnPrincipal;
    mapping(uint256 => uint256) public earnIndexSnap;
    mapping(uint256 => uint256) public goalYieldEarned;

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
    event YieldFeeUpdated(uint16 bps);
    event YieldFeeTaken(uint256 indexed goalId, uint256 fee);
    event FeeRecipientUpdated(address indexed recipient);
    event GoalFeeSnapshotted(uint256 indexed goalId, uint16 feeBps);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event EarnModeSet(uint256 indexed goalId, bool on);
    event ParkedInVault(uint256 indexed goalId, uint256 amount);
    event UnparkedFromVault(uint256 indexed goalId, uint256 amount);
    event YieldCredited(uint256 indexed goalId, uint256 amount);
    event EmergencyRepaid(uint256 indexed goalId, address indexed borrower, uint256 amount, uint256 fee, uint256 netDebtAfter);
    event EmergencyClosed(uint256 indexed goalId, address indexed borrower, uint256 debtPaid, uint256 fee);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotPendingOwner();
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
    error RecoveryModeActive();
    error EarnUnavailable();
    error VaultMismatch();
    error NoActiveTrove();
    error BelowMinNetDebt(uint256 maxRepayable);
    error RepayMismatch(uint256 expected, uint256 burned);
    error InsufficientGoalBalance(uint256 needed, uint256 available);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(Config memory c) {
        if (
            c.musd == address(0) || c.borrowerOperations == address(0) || c.borrowerOperationsSignatures == address(0)
                || c.troveManager == address(0) || c.priceFeed == address(0) || c.owner == address(0)
        ) revert ZeroAddress();
        musd = IERC20(c.musd);
        borrowerOps = IBorrowerOperationsView(c.borrowerOperations);
        borrowerOpsSig = c.borrowerOperationsSignatures;
        troveManager = ITroveManagerV3(c.troveManager);
        priceFeed = IPriceFeed(c.priceFeed);
        savingsVault = IMUSDSavingsRate(c.savingsVault);
        if (c.savingsVault != address(0) && IMUSDSavingsRate(c.savingsVault).musdToken() != c.musd) {
            revert VaultMismatch();
        }
        owner = c.owner;
        emit OwnershipTransferred(address(0), c.owner);
    }

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

    /// @dev Mezo's ActivePool makes a value-0 call to the recipient. Accept it, never hold BTC.
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
        goalEarlyFeeBps[goalId] = earlyFeeBps;
        emit GoalFeeSnapshotted(goalId, earlyFeeBps);

        if (isFamily) {
            familyMember[goalId][msg.sender] = true;
            emit FamilyMemberUpdated(goalId, msg.sender, true);
        }
        emit GoalCreated(goalId, msg.sender, name, targetAmount, unlockTime, isFamily);
    }

    function deposit(uint256 goalId, uint256 amount) external nonReentrant {
        _checkContributor(goalId, amount);
        _credit(goalId, msg.sender, amount);
        _pullTo(msg.sender, address(this), amount);
        _autoPark(goalId, amount);
    }

    function depositWithPermit(uint256 goalId, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
    {
        _checkContributor(goalId, amount);
        _credit(goalId, msg.sender, amount);
        _permit(amount, deadline, v, r, s);
        _pullTo(msg.sender, address(this), amount);
        _autoPark(goalId, amount);
    }

    /// @notice Borrow from the caller's own Mezo trove straight into a goal (one EIP-712 signature).
    /// @dev Refused while Mezo is in Recovery Mode, and if the trove would end below 150%.
    function borrowToGoal(
        uint256 goalId,
        uint256 amount,
        address upperHint,
        address lowerHint,
        bytes calldata signature,
        uint256 deadline
    ) external nonReentrant {
        _checkContributor(goalId, amount);
        uint256 price = priceFeed.fetchPrice();
        if (troveManager.checkRecoveryMode(price)) revert RecoveryModeActive();

        uint256 before = musd.balanceOf(address(this));
        totalBorrowedToGoals += amount;
        _credit(goalId, msg.sender, amount);
        IBorrowerOperationsSignatures(borrowerOpsSig).withdrawMUSDWithSignature(
            amount, upperHint, lowerHint, msg.sender, address(this), signature, deadline
        );
        uint256 received = musd.balanceOf(address(this)) - before;
        if (received != amount) revert BorrowMismatch(amount, received);

        uint256 icrAfter = troveManager.getCurrentICR(msg.sender, price);
        if (icrAfter < MIN_ICR_AFTER_BORROW) revert LoanTooRisky(icrAfter);

        emit BorrowedToGoal(goalId, msg.sender, amount, icrAfter);
        _autoPark(goalId, amount);
    }

    /// @notice Withdraw everything (principal + vault yield) after the unlock date. Closes the goal.
    function withdraw(uint256 goalId) external nonReentrant {
        Goal storage g = _ownedActive(goalId);
        if (block.timestamp < g.unlockTime) revert StillLocked();
        _exitVault(goalId);

        uint256 amount = g.balance;
        if (amount == 0) revert BadAmount();
        g.balance = 0;
        g.active = false;
        totalLocked -= amount;

        emit Withdrawn(goalId, msg.sender, amount);
        _send(msg.sender, amount);
    }

    /// @notice Leave before the unlock date. Fee = snapshotted bps of the whole balance (as in v2).
    function earlyWithdraw(uint256 goalId) external nonReentrant {
        Goal storage g = _ownedActive(goalId);
        if (block.timestamp >= g.unlockTime) revert AlreadyUnlocked();
        _exitVault(goalId);

        uint256 amount = g.balance;
        if (amount == 0) revert BadAmount();
        uint256 fee = (amount * goalEarlyFeeBps[goalId]) / 10_000;
        uint256 net = amount - fee;

        g.balance = 0;
        g.active = false;
        totalLocked -= amount;
        feePool += fee;

        emit EarlyWithdrawn(goalId, msg.sender, net, fee);
        _send(msg.sender, net);
    }

    // -------------------------------------------------------------------------
    // Earn mode (MUSD Savings Vault)
    // -------------------------------------------------------------------------

    /// @notice Turn earn mode on or off for a goal. On: the goal's MUSD moves into the vault
    ///         and future deposits follow. Off: principal and yield come back to the Pocket.
    function setEarn(uint256 goalId, bool on) external nonReentrant {
        _ownedActive(goalId);
        if (address(savingsVault) == address(0)) revert EarnUnavailable();
        goalEarning[goalId] = on;
        emit EarnModeSet(goalId, on);
        if (on) {
            _settle(goalId);
            uint256 liquid = goals[goalId].balance - earnPrincipal[goalId];
            if (liquid > 0) _park(goalId, liquid);
        } else {
            _exitVault(goalId);
        }
    }

    /// @notice Pull this goal's vault yield into its balance now (anyone may call; it only credits the goal).
    function settleYield(uint256 goalId) external nonReentrant {
        if (!goals[goalId].active) revert GoalInactive();
        _settle(goalId);
    }

    // -------------------------------------------------------------------------
    // Emergency: let a goal protect its owner's trove
    // -------------------------------------------------------------------------

    /// @notice Repay part of the caller's own trove from their goal.
    /// @dev The caller signs Mezo's EIP-712 RepayMUSD(amount, borrower, nonce, deadline).
    ///      Mezo burns the MUSD from this contract. Pre-checks mirror Mezo: the repayment
    ///      must leave at least minNetDebt (1,800 MUSD today) of net debt; to clear the whole
    ///      loan use emergencyClose. Fee: none if the goal is unlocked, the trove is under
    ///      200%, or Mezo is in Recovery Mode; otherwise the goal's early-exit fee applies
    ///      to the amount, so repay is not a free way around the lock.
    function emergencyRepay(
        uint256 goalId,
        uint256 amount,
        address upperHint,
        address lowerHint,
        bytes calldata signature,
        uint256 deadline
    ) external nonReentrant {
        _ownedActive(goalId);
        if (amount == 0) revert BadAmount();
        uint256 netDebt = _netDebtOf(msg.sender);
        uint256 minNet = borrowerOps.minNetDebt();
        if (netDebt < minNet + amount) revert BelowMinNetDebt(netDebt > minNet ? netDebt - minNet : 0);

        uint256 fee = _emergencyFee(goalId, msg.sender, amount);
        feePool += fee;
        totalRepaidFromGoals += amount;
        _settle(goalId);
        _debit(goalId, amount + fee);

        uint256 before = musd.balanceOf(address(this));
        IBorrowerOperationsSignaturesRepay(borrowerOpsSig).repayMUSDWithSignature(
            amount, upperHint, lowerHint, msg.sender, signature, deadline
        );
        uint256 burned = before - musd.balanceOf(address(this));
        if (burned != amount) revert RepayMismatch(amount, burned);

        emit EmergencyRepaid(goalId, msg.sender, amount, fee, netDebt - amount);
    }

    /// @notice Fully close the caller's trove using the goal. Collateral BTC goes straight to the caller.
    /// @dev The caller signs Mezo's EIP-712 CloseTrove(borrower, recipient=borrower, nonce, deadline).
    ///      Mezo burns debt minus the 200 MUSD gas compensation from this contract and does
    ///      not allow closing in Recovery Mode, so we check that first. Same fee rule as repay.
    function emergencyClose(uint256 goalId, bytes calldata signature, uint256 deadline) external nonReentrant {
        _ownedActive(goalId);
        uint256 netDebt = _netDebtOf(msg.sender);
        if (troveManager.checkRecoveryMode(priceFeed.fetchPrice())) revert RecoveryModeActive();

        uint256 fee = _emergencyFee(goalId, msg.sender, netDebt);
        feePool += fee;
        totalRepaidFromGoals += netDebt;
        _settle(goalId);
        _debit(goalId, netDebt + fee);

        uint256 before = musd.balanceOf(address(this));
        IBorrowerOperationsSignaturesRepay(borrowerOpsSig).closeTroveWithSignature(
            msg.sender, msg.sender, signature, deadline
        );
        uint256 burned = before - musd.balanceOf(address(this));
        if (burned != netDebt) revert RepayMismatch(netDebt, burned);

        emit EmergencyClosed(goalId, msg.sender, netDebt, fee);
    }

    // -------------------------------------------------------------------------
    // Shared goals and payments (unchanged from v2)
    // -------------------------------------------------------------------------

    function setFamilyMember(uint256 goalId, address member, bool allowed) external {
        Goal storage g = _ownedActive(goalId);
        if (!g.isFamily) revert NotContributor();
        if (member == address(0)) revert ZeroAddress();
        familyMember[goalId][member] = allowed;
        emit FamilyMemberUpdated(goalId, member, allowed);
    }

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

    /// @notice Earn-mode state for the UI. `pending` is vault yield not yet credited.
    function earnInfo(uint256 goalId)
        external
        view
        returns (bool earning, uint256 inVault, uint256 pending, uint256 earnedToDate)
    {
        return (goalEarning[goalId], earnPrincipal[goalId], pendingYield(goalId), goalYieldEarned[goalId]);
    }

    function pendingYield(uint256 goalId) public view returns (uint256) {
        uint256 p = earnPrincipal[goalId];
        if (p == 0 || address(savingsVault) == address(0)) return 0;
        uint256 idx = savingsVault.yieldIndex();
        uint256 snap = earnIndexSnap[goalId];
        return idx > snap ? (p * (idx - snap)) / 1e18 : 0;
    }

    /// @notice Pending yield after the performance fee, i.e. what the goal would actually be credited.
    function pendingYieldAfterFee(uint256 goalId) external view returns (uint256) {
        uint256 gross = pendingYield(goalId);
        return gross - (gross * yieldFeeBps) / 10_000;
    }

    function earnAvailable() external view returns (bool) {
        return address(savingsVault) != address(0);
    }

    function goalsOf(address user) external view returns (uint256[] memory) {
        return _goalsByOwner[user];
    }

    function progressBps(uint256 goalId) external view returns (uint256) {
        Goal storage g = goals[goalId];
        if (g.targetAmount == 0) return 0;
        return (g.balance * 10_000) / g.targetAmount;
    }

    /// @notice MUSD in this contract that belongs to no goal, no fee and no uncredited yield.
    function strayBalance() public view returns (uint256) {
        uint256 bal = musd.balanceOf(address(this));
        uint256 owed = (totalLocked - totalInVault) + feePool + yieldPool;
        return bal > owed ? bal - owed : 0;
    }

    // -------------------------------------------------------------------------
    // Admin (can never touch goal balances or uncredited yield)
    // -------------------------------------------------------------------------

    function setEarlyFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_EARLY_FEE_BPS) revert FeeTooHigh();
        earlyFeeBps = bps;
        emit EarlyFeeUpdated(bps);
    }

    /// @notice Set the performance fee on yield, in basis points. Capped at 10%. 0 turns it off.
    /// @dev Applies to yield credited after the change. Yield already credited keeps the old rate.
    function setYieldFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_YIELD_FEE_BPS) revert FeeTooHigh();
        yieldFeeBps = bps;
        emit YieldFeeUpdated(bps);
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        feeRecipient = recipient;
        emit FeeRecipientUpdated(recipient);
    }

    /// @notice Send all collected fees to `feeRecipient`. Anyone may call it: the money can only go there.
    function claimFeesToRecipient() external nonReentrant {
        address to = feeRecipient;
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = feePool;
        if (amount == 0) revert BadAmount();
        feePool = 0;
        emit FeeClaimed(to, amount);
        _send(to, amount);
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
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address previous = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    function _ownedActive(uint256 goalId) internal view returns (Goal storage g) {
        g = goals[goalId];
        if (!g.active) revert GoalInactive();
        if (msg.sender != g.owner) revert NotGoalOwner();
    }

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

    /// @dev Take `amount` out of a goal, pulling it from the vault first if needed.
    function _debit(uint256 goalId, uint256 amount) internal {
        Goal storage g = goals[goalId];
        if (amount > g.balance) revert InsufficientGoalBalance(amount, g.balance);
        uint256 liquid = g.balance - earnPrincipal[goalId];
        if (amount > liquid) _unpark(goalId, amount - liquid);
        g.balance -= amount;
        totalLocked -= amount;
    }

    /// @dev Net debt = total debt (getEntireDebtAndColl already includes pending rewards
    ///      and accrued interest) minus Mezo's 200 MUSD gas compensation.
    function _netDebtOf(address borrower) internal view returns (uint256) {
        (, uint256 principal, uint256 interest,,,) = troveManager.getEntireDebtAndColl(borrower);
        uint256 debt = principal + interest;
        if (debt <= GAS_COMPENSATION) revert NoActiveTrove();
        return debt - GAS_COMPENSATION;
    }

    function _emergencyFee(uint256 goalId, address borrower, uint256 amount) internal view returns (uint256) {
        if (block.timestamp >= goals[goalId].unlockTime) return 0;
        uint256 price = priceFeed.fetchPrice();
        if (troveManager.checkRecoveryMode(price)) return 0;
        if (troveManager.getCurrentICR(borrower, price) < AT_RISK_ICR) return 0;
        return (amount * goalEarlyFeeBps[goalId]) / 10_000;
    }

    function _autoPark(uint256 goalId, uint256 amount) internal {
        if (goalEarning[goalId]) {
            _settle(goalId);
            _park(goalId, amount);
        }
    }

    function _park(uint256 goalId, uint256 amount) internal {
        _approve(address(savingsVault), amount);
        savingsVault.deposit(amount);
        earnPrincipal[goalId] += amount;
        totalInVault += amount;
        emit ParkedInVault(goalId, amount);
    }

    /// @dev vault.withdraw also pays out all of the Pocket's claimable yield; the extra goes to yieldPool.
    function _unpark(uint256 goalId, uint256 amount) internal {
        _settle(goalId);
        uint256 before = musd.balanceOf(address(this));
        savingsVault.withdraw(amount);
        uint256 got = musd.balanceOf(address(this)) - before;
        if (got < amount) revert TransferFailed();
        yieldPool += got - amount;
        earnPrincipal[goalId] -= amount;
        totalInVault -= amount;
        emit UnparkedFromVault(goalId, amount);
    }

    function _exitVault(uint256 goalId) internal {
        uint256 p = earnPrincipal[goalId];
        if (p > 0) _unpark(goalId, p);
    }

    /// @dev Credit the goal with vault yield since its last snapshot.
    function _settle(uint256 goalId) internal {
        if (address(savingsVault) == address(0)) return;
        uint256 idx = savingsVault.yieldIndex();
        uint256 p = earnPrincipal[goalId];
        uint256 snap = earnIndexSnap[goalId];
        earnIndexSnap[goalId] = idx;
        if (p == 0 || idx <= snap) return;
        uint256 earned = (p * (idx - snap)) / 1e18;
        if (earned == 0) return;
        if (yieldPool < earned) {
            uint256 before = musd.balanceOf(address(this));
            // Return value ignored on purpose: the balance delta is the source of truth.
            // slither-disable-next-line unused-return
            savingsVault.claimYield();
            yieldPool += musd.balanceOf(address(this)) - before;
        }
        if (earned > yieldPool) earned = yieldPool; // rounding guard, never pay what was not received
        yieldPool -= earned;
        // Performance fee: a share of this yield only. Rounds down, so rounding favours the saver.
        uint256 fee = (earned * yieldFeeBps) / 10_000;
        uint256 credit = earned - fee;
        if (fee != 0) {
            feePool += fee;
            emit YieldFeeTaken(goalId, fee);
        }
        goals[goalId].balance += credit;
        totalLocked += credit;
        goalYieldEarned[goalId] += credit;
        emit YieldCredited(goalId, credit);
    }

    function _permit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) internal {
        try IERC20Permit(address(musd)).permit(msg.sender, address(this), amount, deadline, v, r, s) {}
        catch {
            if (musd.allowance(msg.sender, address(this)) < amount) revert TransferFailed();
        }
    }

    function _approve(address spender, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(musd).call(abi.encodeWithSelector(IERC20.approve.selector, spender, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
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
