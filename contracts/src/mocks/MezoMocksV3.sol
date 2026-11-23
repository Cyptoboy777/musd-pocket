// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice v3 test doubles. They copy the behaviour of the real Mezo contracts that matter
///         to MUSD Pocket: MUSDSavingsRate's yield index, BorrowerOperations' min-net-debt
///         and repayment rules, and TroveManager's Recovery Mode flag.

interface IMUSDMock {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}

/// @dev Same accounting as mezo MUSDSavingsRate (verified source on the Mezo explorer):
///      1:1 deposit, global yieldIndex, per-holder supplyYieldIndex, withdraw auto-claims.
contract MockSavingsRate {
    IMUSDMock public immutable musdToken;
    uint256 public yieldIndex;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public supplyYieldIndex;
    mapping(address => uint256) public claimableYield;

    constructor(address musd_) {
        musdToken = IMUSDMock(musd_);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "ZeroAmount");
        require(musdToken.transferFrom(msg.sender, address(this), amount), "pull");
        _update(msg.sender);
        balanceOf[msg.sender] += amount;
        totalSupply += amount;
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "ZeroAmount");
        require(balanceOf[msg.sender] >= amount, "InsufficientBalance");
        _claim(msg.sender);
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        require(musdToken.transfer(msg.sender, amount), "send");
    }

    function claimYield() external returns (uint256) {
        return _claim(msg.sender);
    }

    /// @dev Stand-in for PCV.distributeMUSD -> receiveProtocolYield. Caller must hold `amount` MUSD.
    function receiveProtocolYield(uint256 amount) external {
        require(musdToken.transferFrom(msg.sender, address(this), amount), "pull");
        if (totalSupply > 0) yieldIndex += (amount * 1e18) / totalSupply;
    }

    function _claim(address who) internal returns (uint256 c) {
        require(balanceOf[who] > 0, "NoShares");
        _update(who);
        c = claimableYield[who];
        if (c > 0) {
            claimableYield[who] = 0;
            require(musdToken.transfer(who, c), "send");
        }
    }

    function _update(address who) internal {
        uint256 s = balanceOf[who];
        uint256 d = yieldIndex - supplyYieldIndex[who];
        supplyYieldIndex[who] = yieldIndex;
        if (s > 0 && d > 0) claimableYield[who] += (s * d) / 1e18;
    }
}

contract MockBorrowerOpsV3 {
    uint256 public minNetDebt = 1800e18;

    function setMinNetDebt(uint256 v) external {
        minNetDebt = v;
    }
}

/// @dev Trove state is set directly. Debt includes the 200 MUSD gas compensation, like Mezo.
contract MockTroveManagerV3 {
    struct T {
        uint256 coll;
        uint256 debt;
        uint256 icr;
        bool active;
    }

    mapping(address => T) public troves;
    bool public recoveryMode;
    uint256 public pendingPrincipalShown; // reported in the pending slot, already folded into principal

    function setTrove(address b, uint256 coll, uint256 debt, uint256 icr) external {
        troves[b] = T(coll, debt, icr, debt > 0);
    }

    function setIcr(address b, uint256 icr) external {
        troves[b].icr = icr;
    }

    function setRecoveryMode(bool on) external {
        recoveryMode = on;
    }

    function setPendingShown(uint256 v) external {
        pendingPrincipalShown = v;
    }

    function checkRecoveryMode(uint256) external view returns (bool) {
        return recoveryMode;
    }

    function getCurrentICR(address b, uint256) external view returns (uint256) {
        return troves[b].icr;
    }

    function getEntireDebtAndColl(address b)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256)
    {
        T memory t = troves[b];
        // principal already includes pending principal (as in Mezo); the pending slot is informational.
        return (t.coll, t.debt, 0, 0, pendingPrincipalShown, 0);
    }

    function reduceDebt(address b, uint256 amount) external {
        troves[b].debt -= amount;
    }

    function close(address b) external {
        delete troves[b];
    }
}

/// @dev BorrowerOperationsSignatures stand-in: "verifies" with a flag, mints on withdraw,
///      burns from msg.sender on repay/close, and enforces Mezo's repayment rules.
contract MockBorrowerOpsSigV3 {
    IMUSDMock public immutable musd;
    MockTroveManagerV3 public immutable tm;
    MockBorrowerOpsV3 public immutable bo;
    bool public rejectSignatures;
    mapping(address => uint256) public nonces;
    address public lastCloseRecipient;

    constructor(address musd_, address tm_, address bo_) {
        musd = IMUSDMock(musd_);
        tm = MockTroveManagerV3(tm_);
        bo = MockBorrowerOpsV3(bo_);
    }

    function setReject(bool r) external {
        rejectSignatures = r;
    }

    function getNonce(address u) external view returns (uint256) {
        return nonces[u];
    }

    function _verify(address borrower, uint256 deadline) internal {
        require(block.timestamp <= deadline, "Signature expired");
        require(!rejectSignatures, "BorrowerOperationsSignatures: Invalid signature");
        nonces[borrower]++;
    }

    function withdrawMUSDWithSignature(uint256 amount, address, address, address borrower, address recipient, bytes memory, uint256 deadline)
        external
    {
        _verify(borrower, deadline);
        musd.mint(recipient, amount);
        (bool ok,) = recipient.call{value: 0}("");
        require(ok, "Sending BTC failed");
    }

    function repayMUSDWithSignature(uint256 amount, address, address, address borrower, bytes memory, uint256 deadline)
        external
    {
        _verify(borrower, deadline);
        (, uint256 debt,,,,) = tm.getEntireDebtAndColl(borrower);
        require(debt - 200e18 - amount >= bo.minNetDebt(), "BorrowerOps: Trove's net debt must be greater than minimum");
        require(musd.balanceOf(msg.sender) >= amount, "BorrowerOps: Caller doesnt have enough mUSD to make repayment");
        musd.burn(msg.sender, amount);
        tm.reduceDebt(borrower, amount);
    }

    function closeTroveWithSignature(address borrower, address recipient, bytes memory, uint256 deadline) external {
        _verify(borrower, deadline);
        require(!tm.recoveryMode(), "BorrowerOps: Operation not permitted during Recovery Mode");
        (, uint256 debt,,,,) = tm.getEntireDebtAndColl(borrower);
        musd.burn(msg.sender, debt - 200e18);
        lastCloseRecipient = recipient;
        tm.close(borrower);
    }
}
