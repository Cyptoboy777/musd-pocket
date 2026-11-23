// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The slice of Mezo's MUSD protocol (github.com/mezo-org/musd) that MUSD Pocket uses.

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// @dev BorrowerOperationsSignatures: lets a borrower authorise a trove action with an
///      EIP-712 signature that someone else submits. We use WithdrawMUSD with
///      recipient = MUSD Pocket, so the newly minted MUSD lands straight in a goal.
interface IBorrowerOperationsSignatures {
    function withdrawMUSDWithSignature(
        uint256 _amount,
        address _upperHint,
        address _lowerHint,
        address _borrower,
        address _recipient,
        bytes memory _signature,
        uint256 _deadline
    ) external;

    function getNonce(address user) external view returns (uint256);
}

interface ITroveManager {
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);
}

interface IPriceFeed {
    function fetchPrice() external view returns (uint256);
}

// -----------------------------------------------------------------------------
// Added for MUSD Pocket v3 (Wave 3)
// -----------------------------------------------------------------------------

/// @dev The repay / close half of BorrowerOperationsSignatures. Both burn MUSD from
///      msg.sender (the Pocket), so a goal can pay down its owner's trove.
///      Source: mezo-org/musd solidity/contracts/BorrowerOperationsSignatures.sol
interface IBorrowerOperationsSignaturesRepay {
    function repayMUSDWithSignature(
        uint256 _amount,
        address _upperHint,
        address _lowerHint,
        address _borrower,
        bytes memory _signature,
        uint256 _deadline
    ) external;

    function closeTroveWithSignature(address _borrower, address _recipient, bytes memory _signature, uint256 _deadline)
        external;
}

/// @dev Read-only slice of BorrowerOperations used for the 1,800 MUSD minimum net debt check.
interface IBorrowerOperationsView {
    function minNetDebt() external view returns (uint256);
}

/// @dev TroveManager reads used by v3. getEntireDebtAndColl already folds pending
///      rewards into coll/principal/interest; the pending fields are informational only.
interface ITroveManagerV3 {
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);
    function checkRecoveryMode(uint256 _price) external view returns (bool);
    function getEntireDebtAndColl(address _borrower)
        external
        view
        returns (
            uint256 coll,
            uint256 principal,
            uint256 interest,
            uint256 pendingCollateral,
            uint256 pendingPrincipal,
            uint256 pendingInterest
        );
}

/// @dev Mezo's MUSD Savings Vault (sMUSD, contract name MUSDSavingsRate).
///      Mainnet proxy 0xb4D498029af77680cD1eF828b967f010d06C51CC, testnet proxy
///      0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16 (both = PCV.feeRecipient()).
///      deposit/withdraw are 1:1 in MUSD; yield is tracked with a global yieldIndex and
///      paid in MUSD by claimYield() (withdraw claims automatically).
interface IMUSDSavingsRate {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function claimYield() external returns (uint256);
    function yieldIndex() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function musdToken() external view returns (address);
    function claimableYield(address account) external view returns (uint256);
    function supplyYieldIndex(address account) external view returns (uint256);
}
